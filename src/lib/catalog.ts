import { eq, sql, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDbClient } from './db-client';
import { works, type Work } from './schema';

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

export interface WorkResource {
  id: string;
  title: string;
  firstPublicationDate: string | null;
}

export function toWorkResource(work: Work): WorkResource {
  return {
    id: work.id,
    title: work.title,
    firstPublicationDate: work.firstPublicationDate ?? null,
  };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseTitle(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CatalogValidationError('Title is required');
  }
  const title = value.trim();
  if (!title) {
    throw new CatalogValidationError('Title is required');
  }
  return title;
}

function parseFirstPublicationDate(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new CatalogValidationError(
      'First publication date must be an ISO date (YYYY-MM-DD) or unknown'
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    throw new CatalogValidationError(
      'First publication date must be an ISO date (YYYY-MM-DD) or unknown'
    );
  }
  const iso = `${trimmed}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new CatalogValidationError(
      'First publication date must be an ISO date (YYYY-MM-DD) or unknown'
    );
  }
  return trimmed;
}

export async function createWork(
  input: { title?: unknown; firstPublicationDate?: unknown },
  env: Env
): Promise<Work> {
  const work: Work = {
    id: uuidv4(),
    title: parseTitle(input.title),
    firstPublicationDate: parseFirstPublicationDate(input.firstPublicationDate),
  };

  const db = getDbClient(env);
  await db.insert(works).values(work);
  return work;
}

export async function getWorkById(id: string, env: Env): Promise<Work | undefined> {
  const db = getDbClient(env);
  const results = await db.select().from(works).where(eq(works.id, id)).limit(1);
  return results[0];
}

export async function searchWorks(query: string, env: Env): Promise<Work[]> {
  const db = getDbClient(env);
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return db.select().from(works).orderBy(asc(works.title));
  }
  return db
    .select()
    .from(works)
    .where(sql`instr(lower(${works.title}), ${needle}) > 0`)
    .orderBy(asc(works.title));
}
