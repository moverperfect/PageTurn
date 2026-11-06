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
  firstPublicationDate: string | null;
}

interface EditionResource {
  id: string;
  displayedTitle: string | null;
  language: string | null;
  publisher: string | null;
  publicationDate: string | null;
  format: string;
  progressUnit: string;
  coverUrl: string | null;
  editionLength: number | null;
  contents: { workId: string; sortOrder: number }[];
}

describe('create Editions for a Work', () => {
  let reader: Fixture;
  let work: WorkResource;
  let printEdition: EditionResource;
  const workTitle = `Edition Work ${crypto.randomUUID()}`;

  beforeAll(async () => {
    reader = await signUpFixture('editions-reader');
    const created = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: workTitle },
    });
    expect(created.status).toBe(201);
    work = (await created.json()) as WorkResource;
  });

  afterAll(() => {
    deleteFixtures([reader]);
  });

  it('rejects Edition creation without a session', async () => {
    const response = await request('/api/editions', {
      method: 'POST',
      body: { workId: work.id, format: 'print', progressUnit: 'page' },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('requires a Work, format, and Progress Unit', async () => {
    const missingWork = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { format: 'print', progressUnit: 'page' },
    });
    expect(missingWork.status).toBe(400);
    expect(await missingWork.json()).toEqual({ error: 'Work is required' });

    const missingFormat = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { workId: work.id, progressUnit: 'page' },
    });
    expect(missingFormat.status).toBe(400);
    expect(await missingFormat.json()).toEqual({ error: 'Format is required' });

    const missingUnit = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { workId: work.id, format: 'print' },
    });
    expect(missingUnit.status).toBe(400);
    expect(await missingUnit.json()).toEqual({ error: 'Progress Unit is required' });
  });

  it('rejects a missing Work', async () => {
    const response = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        workId: crypto.randomUUID(),
        format: 'print',
        progressUnit: 'page',
      },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Work not found' });
  });

  it('rejects a Progress Unit that does not match the format', async () => {
    const response = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        workId: work.id,
        format: 'audiobook',
        progressUnit: 'page',
      },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Audiobook Editions use the Time Position Progress Unit',
    });
  });

  it('lets a Reader create a sparse print Edition of an existing Work', async () => {
    const response = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        workId: work.id,
        format: 'print',
        progressUnit: 'page',
        author: 'Fabricated Author',
        pageCount: 0,
      },
    });
    expect(response.status).toBe(201);
    printEdition = (await response.json()) as EditionResource;
    expect(printEdition.id).toBeTruthy();
    expect(printEdition).toEqual({
      id: printEdition.id,
      displayedTitle: null,
      language: null,
      publisher: null,
      publicationDate: null,
      format: 'print',
      progressUnit: 'page',
      coverUrl: null,
      editionLength: null,
      contents: [{ workId: work.id, sortOrder: 0 }],
    });
  });

  it('creates an e-book Edition with Page and an audiobook Edition with Time Position', async () => {
    const ebook = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        workId: work.id,
        format: 'ebook',
        progressUnit: 'page',
        displayedTitle: `${workTitle} ebook`,
        editionLength: 240,
      },
    });
    expect(ebook.status).toBe(201);
    expect(await ebook.json()).toMatchObject({
      format: 'ebook',
      progressUnit: 'page',
      displayedTitle: `${workTitle} ebook`,
      editionLength: 240,
    });

    const audiobook = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: {
        workId: work.id,
        format: 'audiobook',
        progressUnit: 'time_position',
      },
    });
    expect(audiobook.status).toBe(201);
    expect(await audiobook.json()).toMatchObject({
      format: 'audiobook',
      progressUnit: 'time_position',
      editionLength: null,
    });
  });

  it('keeps omitted Edition facts unknown on the Edition detail view', async () => {
    const response = await request(`/editions/${printEdition.id}`, {
      cookie: reader.cookie,
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/data-field="displayed-title"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="language"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="publisher"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="publication-date"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="cover"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="edition-length"[^>]*>\s*Unknown\s*</);
    expect(html).toMatch(/data-field="format"[^>]*>\s*Print\s*</);
    expect(html).toMatch(/data-field="progress-unit"[^>]*>\s*Page\s*</);
    expect(html).toContain(workTitle);
    expect(html).toContain(`/works/${work.id}`);
    expect(html).not.toContain('Fabricated Author');
    expect(html).not.toMatch(/>\s*Book\s*</);
  });

  it('links the Work detail view to its Editions without using the Book concept', async () => {
    const response = await request(`/works/${work.id}`, {
      cookie: reader.cookie,
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`/editions/${printEdition.id}`);
    expect(html).toContain(`/works/${work.id}/editions/new`);
    expect(html).not.toContain('This Work has no Editions yet.');
    expect(html.toLowerCase()).not.toMatch(/>\s*book\s*</);
  });

  it('creates an Edition from the Work form', async () => {
    const response = await request(`/works/${work.id}/editions/new`, {
      method: 'POST',
      cookie: reader.cookie,
      form: new URLSearchParams({
        format: 'print',
        progressUnit: 'page',
        displayedTitle: `${workTitle} trade paper`,
        publisher: 'A Press',
      }),
    });
    expect(response.status).toBe(302);
    const location = response.headers.get('location');
    expect(location).toBeTruthy();
    const detailPath = new URL(location!, 'http://acceptance.invalid').pathname;
    expect(detailPath).toMatch(/^\/editions\/[0-9a-f-]{36}$/i);

    const detail = await request(detailPath, { cookie: reader.cookie });
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain(`${workTitle} trade paper`);
    expect(html).toMatch(/data-field="publisher"[^>]*>\s*A Press\s*</);
    expect(html).toContain(workTitle);
  });
});
