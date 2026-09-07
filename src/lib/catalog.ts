import { insertWork } from './db';
import type { Work } from './schema';

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
  return insertWork(
    {
      title: parseTitle(input.title),
      firstPublicationDate: parseFirstPublicationDate(input.firstPublicationDate),
    },
    env
  );
}
