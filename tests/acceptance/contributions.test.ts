import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteFixtures,
  request,
  signUpFixture,
  type Fixture,
} from './helpers';

interface Credit {
  id: string;
  role: string;
  contributor: { id: string; name: string };
}

interface WorkResource {
  id: string;
  title: string;
  contributions: Credit[];
}

interface EditionResource {
  id: string;
  contributions: Credit[];
}

describe('role-qualified Contributions', () => {
  let reader: Fixture;
  let work: WorkResource;
  let edition: EditionResource;
  const title = `Credit Work ${crypto.randomUUID()}`;

  beforeAll(async () => {
    reader = await signUpFixture('credits-reader');
    const createdWork = await request('/api/works', {
      method: 'POST',
      cookie: reader.cookie,
      body: { title },
    });
    expect(createdWork.status).toBe(201);
    work = (await createdWork.json()) as WorkResource;

    const createdEdition = await request('/api/editions', {
      method: 'POST',
      cookie: reader.cookie,
      body: { workId: work.id, format: 'audiobook', progressUnit: 'time_position' },
    });
    expect(createdEdition.status).toBe(201);
    edition = (await createdEdition.json()) as EditionResource;
  });

  afterAll(() => {
    deleteFixtures([reader]);
  });

  it('credits multiple Contributors on a Work with distinct roles', async () => {
    const author = await request(`/api/works/${work.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Ada Lovelace', role: 'author' },
    });
    expect(author.status).toBe(201);
    const coauthor = await request(`/api/works/${work.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Charles Babbage', role: 'author' },
    });
    expect(coauthor.status).toBe(201);
    const editor = await request(`/api/works/${work.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Mary Editor', role: 'editor' },
    });
    expect(editor.status).toBe(201);
    work = (await editor.json()) as WorkResource;
    expect(work.contributions.map((credit) => credit.role).sort()).toEqual([
      'author',
      'author',
      'editor',
    ]);
    expect(work.contributions.map((credit) => credit.contributor.name).sort()).toEqual([
      'Ada Lovelace',
      'Charles Babbage',
      'Mary Editor',
    ]);
  });

  it('credits Edition-specific roles without collapsing them into the Work', async () => {
    const narrator = await request(`/api/editions/${edition.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Jo Narrator', role: 'narrator' },
    });
    expect(narrator.status).toBe(201);
    const translator = await request(`/api/editions/${edition.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Ada Lovelace', role: 'translator' },
    });
    expect(translator.status).toBe(201);
    const illustrator = await request(`/api/editions/${edition.id}/contributions`, {
      method: 'POST',
      cookie: reader.cookie,
      body: { name: 'Ink Illustrator', role: 'illustrator' },
    });
    expect(illustrator.status).toBe(201);
    edition = (await illustrator.json()) as EditionResource;

    expect(edition.contributions.map((credit) => credit.role).sort()).toEqual([
      'illustrator',
      'narrator',
      'translator',
    ]);

    const workDetail = await request(`/api/works/${work.id}`, {
      cookie: reader.cookie,
    });
    expect(workDetail.status).toBe(200);
    const workResource = (await workDetail.json()) as WorkResource;
    expect(workResource.contributions.map((credit) => credit.role)).not.toContain(
      'narrator'
    );
    expect(workResource.contributions.map((credit) => credit.role)).not.toContain(
      'translator'
    );

    const adaOnWork = workResource.contributions.find(
      (credit) => credit.contributor.name === 'Ada Lovelace'
    );
    const adaOnEdition = edition.contributions.find(
      (credit) => credit.contributor.name === 'Ada Lovelace'
    );
    expect(adaOnWork?.contributor.id).toBe(adaOnEdition?.contributor.id);
    expect(adaOnWork?.role).toBe('author');
    expect(adaOnEdition?.role).toBe('translator');
  });

  it('shows role-qualified credits on Work and Edition views', async () => {
    const workPage = await request(`/works/${work.id}`, { cookie: reader.cookie });
    expect(workPage.status).toBe(200);
    const workHtml = await workPage.text();
    expect(workHtml).toContain('Ada Lovelace');
    expect(workHtml).toContain('Author');
    expect(workHtml).toContain('Charles Babbage');
    expect(workHtml).toContain('Mary Editor');
    expect(workHtml).toContain('Editor');
    expect(workHtml).not.toContain('Jo Narrator');

    const editionPage = await request(`/editions/${edition.id}`, {
      cookie: reader.cookie,
    });
    expect(editionPage.status).toBe(200);
    const editionHtml = await editionPage.text();
    expect(editionHtml).toContain('Jo Narrator');
    expect(editionHtml).toContain('Narrator');
    expect(editionHtml).toContain('Ink Illustrator');
    expect(editionHtml).toContain('Illustrator');
    expect(editionHtml).toContain('Translator');
    expect(editionHtml).not.toContain('Charles Babbage');
  });

  it('removing one Contribution keeps the shared Contributor and unrelated credits', async () => {
    const editor = work.contributions.find((credit) => credit.role === 'editor');
    expect(editor).toBeTruthy();
    const removed = await request(`/api/contributions/${editor!.id}`, {
      method: 'DELETE',
      cookie: reader.cookie,
    });
    expect(removed.status).toBe(200);

    const workDetail = await request(`/api/works/${work.id}`, {
      cookie: reader.cookie,
    });
    const updatedWork = (await workDetail.json()) as WorkResource;
    expect(updatedWork.contributions.map((credit) => credit.role)).toEqual([
      'author',
      'author',
    ]);
    expect(updatedWork.contributions.map((credit) => credit.contributor.name)).toContain(
      'Ada Lovelace'
    );

    const editionDetail = await request(`/api/editions/${edition.id}`, {
      cookie: reader.cookie,
    });
    const updatedEdition = (await editionDetail.json()) as EditionResource;
    expect(updatedEdition.contributions.map((credit) => credit.contributor.name)).toContain(
      'Ada Lovelace'
    );
    expect(updatedEdition.contributions.map((credit) => credit.role)).toContain(
      'translator'
    );
  });
});
