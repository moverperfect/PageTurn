import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface SubjectClassification {
  id: string;
  name: string;
  provenance: string | null;
}

interface WorkResource {
  id: string;
  title: string;
  firstPublicationDate: string | null;
  subjects: SubjectClassification[];
}

interface WorkListResponse {
  works: WorkResource[];
}

describe('provenanced Subjects', () => {
  let reader: Fixture;
  let otherReader: Fixture;
  let work: WorkResource;
  let otherWork: WorkResource;
  const title = `Subject Work ${crypto.randomUUID()}`;
  const otherTitle = `Unclassified Work ${crypto.randomUUID()}`;

  beforeAll(async () => {
    reader = await signUpFixture('subjects-reader');
    otherReader = await signUpFixture('subjects-other');

    const created = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title },
    });
    expect(created.status).toBe(201);
    work = (await created.json()) as WorkResource;

    const other = await request('/api/works', {
      method: 'POST',
      cookie: otherReader.cookie,
      body: { title: otherTitle },
    });
    expect(other.status).toBe(201);
    otherWork = (await other.json()) as WorkResource;
  });

  afterAll(() => {
    deleteFixtures([reader, otherReader]);
  });

  it('leaves an unclassified Work without Subjects', async () => {
    expect(work.subjects).toEqual([]);

    const detail = await request(`/api/works/${work.id}`, {
      cookie: reader.cookie,
    });
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: work.id, subjects: [] });

    const page = await request(`/works/${work.id}`, { cookie: reader.cookie });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('This Work has no Subjects.');
  });

  it('rejects a Subject without a name', async () => {
    const response = await request(`/api/works/${work.id}/subjects`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: '   ' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Subject name is required' });
  });

  it('classifies a Work with multiple provenanced Subjects', async () => {
    const first = await request(`/api/works/${work.id}/subjects`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Science Fiction', provenance: 'reader' },
    });
    expect(first.status).toBe(201);
    const afterFirst = (await first.json()) as WorkResource;
    expect(afterFirst.subjects).toEqual([
      {
        id: afterFirst.subjects[0].id,
        name: 'Science Fiction',
        provenance: 'reader',
      },
    ]);

    const second = await request(`/api/works/${work.id}/subjects`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Climate', provenance: 'open-library' },
    });
    expect(second.status).toBe(201);
    work = (await second.json()) as WorkResource;
    expect(work.subjects.map((subject) => subject.name).sort()).toEqual([
      'Climate',
      'Science Fiction',
    ]);
    expect(
      work.subjects.find((subject) => subject.name === 'Climate')?.provenance
    ).toBe('open-library');
  });

  it('reuses an equivalent Subject instead of duplicating by case or whitespace', async () => {
    const duplicate = await request(`/api/works/${work.id}/subjects`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: '  science   fiction ', provenance: 'ignored' },
    });
    expect(duplicate.status).toBe(201);
    const updated = (await duplicate.json()) as WorkResource;
    const science = updated.subjects.filter(
      (subject) => subject.name.toLowerCase() === 'science fiction'
    );
    expect(science).toHaveLength(1);
    expect(science[0].id).toBe(
      work.subjects.find((subject) => subject.name === 'Science Fiction')?.id
    );
    expect(science[0].name).toBe('Science Fiction');
    expect(science[0].provenance).toBe('reader');

    const other = await request(`/api/works/${otherWork.id}/subjects`, {
      method: 'POST',
      cookie: otherReader.cookie,
      body: { name: 'SCIENCE FICTION', provenance: 'import' },
    });
    expect(other.status).toBe(201);
    otherWork = (await other.json()) as WorkResource;
    expect(otherWork.subjects).toEqual([
      {
        id: science[0].id,
        name: 'Science Fiction',
        provenance: 'import',
      },
    ]);
  });

  it('exposes Subjects on Work search and detail without treating them as Edition metadata', async () => {
    const search = await request(`/api/works?q=${encodeURIComponent(title)}`, {
      cookie: otherReader.cookie,
    });
    expect(search.status).toBe(200);
    const found = (await search.json()) as WorkListResponse;
    const match = found.works.find((item) => item.id === work.id);
    expect(match?.subjects.map((subject) => subject.name).sort()).toEqual([
      'Climate',
      'Science Fiction',
    ]);

    const catalogPage = await request(
      `/works?q=${encodeURIComponent(title)}`,
      { cookie: reader.cookie }
    );
    expect(catalogPage.status).toBe(200);
    const catalogHtml = await catalogPage.text();
    expect(catalogHtml).toContain('Science Fiction');
    expect(catalogHtml).toContain('Climate');

    const detail = await request(`/works/${work.id}`, { cookie: reader.cookie });
    expect(detail.status).toBe(200);
    const html = await detail.text();
    expect(html).toContain('Science Fiction');
    expect(html).toContain('reader');
    expect(html).toContain('Climate');
    expect(html).toContain('open-library');
    expect(html).not.toContain('This Work has no Subjects.');
    expect(html).not.toMatch(/Edition Subject/i);
  });

  it('adds a Subject from the Work detail form', async () => {
    const response = await request(`/works/${otherWork.id}`, {
      method: 'POST',
      cookie: otherReader.cookie,
      form: new URLSearchParams({
        name: 'Memoir',
        provenance: 'reader',
      }),
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Memoir');
    expect(html).toContain('reader');
  });
});
