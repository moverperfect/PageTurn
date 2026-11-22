import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface CatalogSuggestion {
  provider: string;
  workKey: string;
  title: string;
  authors: string[];
}

interface CatalogSearchResponse {
  works: { id: string; title: string }[];
  suggestions: CatalogSuggestion[];
  providerError: boolean;
}

interface AcceptResponse {
  work: { id: string; title: string; contributions: { contributor: { name: string } }[] };
  edition: {
    id: string;
    identifiers: { namespace: string; value: string; provenance: string | null }[];
  };
}

describe('Open Library catalog suggestions', () => {
  let reader: Fixture;

  beforeAll(async () => {
    reader = await signUpFixture('openlibrary-reader');
  });

  afterAll(() => {
    deleteFixtures([reader]);
  });

  it('keeps local search working when the provider is down', async () => {
    const localTitle = `provider-outage ${crypto.randomUUID()}`;
    const created = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: localTitle },
    });
    expect(created.status).toBe(201);

    const search = await request(
      `/api/works?q=${encodeURIComponent('provider-outage')}`,
      { cookie: reader.cookie }
    );
    expect(search.status).toBe(200);
    const found = (await search.json()) as CatalogSearchResponse;
    expect(found.providerError).toBe(true);
    expect(found.suggestions).toEqual([]);
    expect(found.works.map((work) => work.title)).toContain(localTitle);

    const page = await request(
      `/works?q=${encodeURIComponent('provider-outage')}`,
      { cookie: reader.cookie }
    );
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('Open Library is unavailable');
    expect(html).toContain('Open Library');
  });

  it('keeps local search working when the provider returns a malformed payload', async () => {
    const localTitle = `provider-malformed ${crypto.randomUUID()}`;
    const created = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title: localTitle },
    });
    expect(created.status).toBe(201);

    const search = await request(
      `/api/works?q=${encodeURIComponent('provider-malformed')}`,
      { cookie: reader.cookie }
    );
    expect(search.status).toBe(200);
    const found = (await search.json()) as CatalogSearchResponse;
    expect(found.providerError).toBe(true);
    expect(found.suggestions).toEqual([]);
    expect(found.works.map((work) => work.title)).toContain(localTitle);
  });

  it('returns provider suggestions without mutating the local catalog', async () => {
    const before = await request('/api/works?q=Dispossessed', {
      cookie: reader.cookie,
    });
    expect(before.status).toBe(200);
    const found = (await before.json()) as CatalogSearchResponse;
    expect(found.providerError).toBe(false);
    expect(found.suggestions.map((suggestion) => suggestion.workKey)).toContain(
      '/works/OL82586W'
    );
    expect(found.works.map((work) => work.title)).not.toContain('The Dispossessed');

    const page = await request('/works?q=Dispossessed', { cookie: reader.cookie });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('The Dispossessed');
    expect(html).toContain('Accept into catalog');
    expect(html).toContain('Ursula K. Le Guin');
  });

  it('stores accepted Work and Edition metadata locally with provenance', async () => {
    const search = await request('/api/works?q=Dispossessed', {
      cookie: reader.cookie,
    });
    const found = (await search.json()) as CatalogSearchResponse;
    const suggestion = found.suggestions.find(
      (item) => item.workKey === '/works/OL82586W'
    );
    expect(suggestion).toBeTruthy();

    const accepted = await request('/api/catalog/accept', {
      method: 'POST',
      cookie: reader.cookie,
      body: { suggestion },
    });
    expect(accepted.status).toBe(201);
    const body = (await accepted.json()) as AcceptResponse;
    expect(body.work.title).toBe('The Dispossessed');
    expect(body.work.contributions.map((credit) => credit.contributor.name)).toContain(
      'Ursula K. Le Guin'
    );
    expect(
      body.edition.identifiers.some(
        (identifier) =>
          identifier.namespace === 'open_library' &&
          identifier.value === '/works/OL82586W' &&
          identifier.provenance === 'open_library'
      )
    ).toBe(true);
    expect(
      body.edition.identifiers.some(
        (identifier) => identifier.namespace === 'isbn_13'
      )
    ).toBe(true);

    const after = await request('/api/works?q=Dispossessed', {
      cookie: reader.cookie,
    });
    const afterFound = (await after.json()) as CatalogSearchResponse;
    expect(afterFound.works.map((work) => work.id)).toContain(body.work.id);
    expect(afterFound.suggestions.map((item) => item.workKey)).not.toContain(
      '/works/OL82586W'
    );
  });
});
