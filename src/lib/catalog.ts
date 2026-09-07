import { getWorkById, insertEditionWithContent, insertWork } from './db';
import {
  EDITION_FORMATS,
  PROGRESS_UNITS,
  type Edition,
  type EditionContent,
  type EditionFormat,
  type ProgressUnit,
  type Work,
} from './schema';

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

export class CatalogNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogNotFoundError';
  }
}

export interface WorkResource {
  id: string;
  title: string;
  firstPublicationDate: string | null;
}

export interface EditionContentResource {
  workId: string;
  sortOrder: number;
}

export interface EditionResource {
  id: string;
  displayedTitle: string | null;
  language: string | null;
  publisher: string | null;
  publicationDate: string | null;
  format: EditionFormat;
  progressUnit: ProgressUnit;
  coverUrl: string | null;
  editionLength: number | null;
  contents: EditionContentResource[];
}

export const FORMAT_LABELS: Record<EditionFormat, string> = {
  print: 'Print',
  ebook: 'E-book',
  audiobook: 'Audiobook',
};

export const PROGRESS_UNIT_LABELS: Record<ProgressUnit, string> = {
  page: 'Page',
  time_position: 'Time Position',
};

const FORMAT_PROGRESS_UNIT: Record<EditionFormat, ProgressUnit> = {
  print: 'page',
  ebook: 'page',
  audiobook: 'time_position',
};

export function toWorkResource(work: Work): WorkResource {
  return {
    id: work.id,
    title: work.title,
    firstPublicationDate: work.firstPublicationDate ?? null,
  };
}

export function toEditionResource(
  edition: Edition,
  contents: EditionContent[]
): EditionResource {
  return {
    id: edition.id,
    displayedTitle: edition.displayedTitle ?? null,
    language: edition.language ?? null,
    publisher: edition.publisher ?? null,
    publicationDate: edition.publicationDate ?? null,
    format: edition.format,
    progressUnit: edition.progressUnit,
    coverUrl: edition.coverUrl ?? null,
    editionLength: edition.editionLength ?? null,
    contents: contents
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((content) => ({
        workId: content.workId,
        sortOrder: content.sortOrder,
      })),
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

function parseOptionalText(
  value: unknown,
  field: string
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new CatalogValidationError(`${field} must be text or unknown`);
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function parseIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new CatalogValidationError(
      `${field} must be an ISO date (YYYY-MM-DD) or unknown`
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    throw new CatalogValidationError(
      `${field} must be an ISO date (YYYY-MM-DD) or unknown`
    );
  }
  const iso = `${trimmed}T00:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed) {
    throw new CatalogValidationError(
      `${field} must be an ISO date (YYYY-MM-DD) or unknown`
    );
  }
  return trimmed;
}

function parseCoverUrl(value: unknown): string | null {
  const text = parseOptionalText(value, 'Cover URL');
  if (!text) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new CatalogValidationError('Cover URL must be an http(s) URL or unknown');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new CatalogValidationError('Cover URL must be an http(s) URL or unknown');
  }
  return text;
}

function parseEditionLength(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new CatalogValidationError('Edition Length must be a positive integer or unknown');
  }
  const parsed = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CatalogValidationError('Edition Length must be a positive integer or unknown');
  }
  return parsed;
}

function parseFormat(value: unknown): EditionFormat {
  if (value === undefined || value === null || value === '') {
    throw new CatalogValidationError('Format is required');
  }
  if (typeof value !== 'string' || !EDITION_FORMATS.includes(value as EditionFormat)) {
    throw new CatalogValidationError('Format must be print, ebook, or audiobook');
  }
  return value as EditionFormat;
}

function parseProgressUnit(value: unknown): ProgressUnit {
  if (value === undefined || value === null || value === '') {
    throw new CatalogValidationError('Progress Unit is required');
  }
  if (typeof value !== 'string' || !PROGRESS_UNITS.includes(value as ProgressUnit)) {
    throw new CatalogValidationError('Progress Unit must be page or time_position');
  }
  return value as ProgressUnit;
}

function parseWorkId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogValidationError('Work is required');
  }
  return value.trim();
}

export async function createWork(
  input: { title?: unknown; firstPublicationDate?: unknown },
  env: Env
): Promise<Work> {
  return insertWork(
    {
      title: parseTitle(input.title),
      firstPublicationDate: parseIsoDate(
        input.firstPublicationDate,
        'First publication date'
      ),
    },
    env
  );
}

export async function createEdition(
  input: {
    workId?: unknown;
    displayedTitle?: unknown;
    language?: unknown;
    publisher?: unknown;
    publicationDate?: unknown;
    format?: unknown;
    progressUnit?: unknown;
    coverUrl?: unknown;
    editionLength?: unknown;
  },
  env: Env
): Promise<{ edition: Edition; contents: EditionContent[] }> {
  const workId = parseWorkId(input.workId);
  const format = parseFormat(input.format);
  const progressUnit = parseProgressUnit(input.progressUnit);
  if (FORMAT_PROGRESS_UNIT[format] !== progressUnit) {
    throw new CatalogValidationError(
      `${FORMAT_LABELS[format]} Editions use the ${PROGRESS_UNIT_LABELS[FORMAT_PROGRESS_UNIT[format]]} Progress Unit`
    );
  }

  const work = await getWorkById(workId, env);
  if (!work) {
    throw new CatalogNotFoundError('Work not found');
  }

  return insertEditionWithContent(
    {
      displayedTitle: parseOptionalText(input.displayedTitle, 'Displayed title'),
      language: parseOptionalText(input.language, 'Language'),
      publisher: parseOptionalText(input.publisher, 'Publisher'),
      publicationDate: parseIsoDate(input.publicationDate, 'Publication date'),
      format,
      progressUnit,
      coverUrl: parseCoverUrl(input.coverUrl),
      editionLength: parseEditionLength(input.editionLength),
    },
    workId,
    env
  );
}
