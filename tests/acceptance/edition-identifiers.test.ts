import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface WorkResource {
  id: string;
  title: string;
}

interface EditionResource {
  id: string;
  identifiers: { namespace: string; value: string; provenance: string | null }[];
}

interface WorkListResponse {
  works: WorkResource[];
}

describe('typed Edition identifiers', () => {
  let reader: Fixture;
  let work: WorkResource;
  let otherWork: WorkResource;
  let edition: EditionResource;
  let otherEdition: EditionResource;
  const title = `Identifier Work ${crypto.randomUUID()}`;
  const isbn13 = '978-0-143-12774-1';

  beforeAll(async () => {
    reader = await signUpFixture('identifiers-reader');

    const createdWork = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title },
    });
    expect(createdWork.status).toBe(201);
    work = (await createdWork.json()) as WorkResource;

    const otherCreatedWork = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: `Other ${crypto.randomUUID()}` },
    });
    expect(otherCreatedWork.status).toBe(201);
    otherWork = (await otherCreatedWork.json()) as WorkResource;

    const createdEdition = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { workId: work.id, format: 'print', progressUnit: 'page' },
    });
    expect(createdEdition.status).toBe(201);
    edition = (await createdEdition.json()) as EditionResource;

    const createdOtherEdition = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { workId: otherWork.id, format: 'ebook', progressUnit: 'page' },
    });
    expect(createdOtherEdition.status).toBe(201);
    otherEdition = (await createdOtherEdition.json()) as EditionResource;
  });

  afterAll(() => {
    deleteFixtures([reader]);
  });

  it('lets an Edition retain multiple distinguishable identifiers', async () => {
    const isbn = await request(`/api/editions/${edition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'isbn_13', value: isbn13, provenance: 'reader' },
    });
    expect(isbn.status).toBe(201);
    const afterIsbn = (await isbn.json()) as EditionResource;
    expect(afterIsbn.identifiers).toEqual([
      { namespace: 'isbn_13', value: isbn13, provenance: 'reader' },
    ]);

    const asin = await request(`/api/editions/${edition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'asin', value: 'B00EXAMPLE', provenance: 'import' },
    });
    expect(asin.status).toBe(201);
    const oclc = await request(`/api/editions/${edition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'oclc', value: 'ocm12345678' },
    });
    expect(oclc.status).toBe(201);
    const isbn10 = await request(`/api/editions/${edition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'isbn_10', value: '0143127748' },
    });
    expect(isbn10.status).toBe(201);
    const openLibrary = await request(`/api/editions/${edition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'open_library', value: '/books/OL123M' },
    });
    expect(openLibrary.status).toBe(201);
    edition = (await openLibrary.json()) as EditionResource;
    expect(edition.identifiers.map((identifier) => identifier.namespace).sort()).toEqual(
      ['asin', 'isbn_10', 'isbn_13', 'oclc', 'open_library']
    );
  });

  it('rejects assigning a namespace/value pair already used by another Edition', async () => {
    const conflict = await request(`/api/editions/${otherEdition.id}/identifiers`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { namespace: 'isbn_13', value: '9780143127741' },
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: 'That identifier is already assigned to another Edition',
    });
  });

  it('resolves an Edition by typed identifier before title search', async () => {
    const lookup = await request(
      `/api/editions?namespace=isbn_13&value=${encodeURIComponent(isbn13)}`,
      { cookie: reader.cookie }
    );
    expect(lookup.status).toBe(200);
    const foundEdition = (await lookup.json()) as EditionResource;
    expect(foundEdition.id).toBe(edition.id);

    const hyphenless = await request(
      '/api/editions?namespace=isbn_13&value=9780143127741',
      { cookie: reader.cookie }
    );
    expect(hyphenless.status).toBe(200);
    expect(((await hyphenless.json()) as EditionResource).id).toBe(edition.id);

    const catalog = await request(
      `/api/works?q=${encodeURIComponent('9780143127741')}`,
      { cookie: reader.cookie }
    );
    expect(catalog.status).toBe(200);
    const found = (await catalog.json()) as WorkListResponse;
    expect(found.works.map((item) => item.id)).toEqual([work.id]);
    expect(found.works.map((item) => item.id)).not.toContain(otherWork.id);

    const titleSearch = await request(
      `/api/works?q=${encodeURIComponent(title)}`,
      { cookie: reader.cookie }
    );
    expect(titleSearch.status).toBe(200);
    const titled = (await titleSearch.json()) as WorkListResponse;
    expect(titled.works.map((item) => item.id)).toContain(work.id);
  });

  it('shows identifier values and provenance on the Edition detail view', async () => {
    const page = await request(`/editions/${edition.id}`, {
      cookie: reader.cookie,
    });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('ISBN-13');
    expect(html).toContain(isbn13);
    expect(html).toContain('reader');
    expect(html).toContain('ASIN');
    expect(html).toContain('B00EXAMPLE');
    expect(html).toContain('OCLC');
    expect(html).toContain('Open Library');
    expect(html).not.toContain('This Edition has no identifiers.');
  });
});
