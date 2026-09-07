import {
  classifyWorkWithSubject,
  findIdentifier,
  findIdentifiersByNormalizedValue,
  foldSearchText,
  getCreditsForEdition,
  getCreditsForWork,
  getEditionById,
  getEditionContents,
  getIdentifiersForEdition,
  getSubjectClassificationsForWork,
  getWorkById,
  IdentifierConflictError,
  insertEditionIdentifier,
  insertEditionWithContent,
  deleteContribution,
  getContributionById,
  insertContribution,
  insertContributor,
  insertSubject,
  insertWork,
  searchWorks,
  type ContributionCredit,
  type SubjectClassification,
} from './db';
import {
  CatalogProviderError,
  searchOpenLibrary,
  type CatalogSuggestion,
} from './catalog-provider';
import {
  CONTRIBUTION_ROLES,
  EDITION_FORMATS,
  IDENTIFIER_NAMESPACES,
  PROGRESS_UNITS,
  type ContributionRole,
  type Edition,
  type EditionContent,
  type EditionFormat,
  type EditionIdentifier,
  type IdentifierNamespace,
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

export class CatalogConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogConflictError';
  }
}

export interface WorkResource {
  id: string;
  title: string;
  firstPublicationDate: string | null;
  subjects: SubjectClassification[];
  contributions: ContributionCredit[];
}

export interface EditionContentResource {
  workId: string;
  sortOrder: number;
}

export interface EditionIdentifierResource {
  namespace: IdentifierNamespace;
  value: string;
  provenance: string | null;
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
  identifiers: EditionIdentifierResource[];
  contributions: ContributionCredit[];
}

export const ROLE_LABELS: Record<ContributionRole, string> = {
  author: 'Author',
  editor: 'Editor',
  translator: 'Translator',
  illustrator: 'Illustrator',
  narrator: 'Narrator',
};

export const NAMESPACE_LABELS: Record<IdentifierNamespace, string> = {
  isbn_10: 'ISBN-10',
  isbn_13: 'ISBN-13',
  asin: 'ASIN',
  oclc: 'OCLC',
  open_library: 'Open Library',
};

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

export function toWorkResource(
  work: Work,
  subjects: SubjectClassification[] = [],
  contributions: ContributionCredit[] = []
): WorkResource {
  return {
    id: work.id,
    title: work.title,
    firstPublicationDate: work.firstPublicationDate ?? null,
    subjects,
    contributions,
  };
}

export async function loadWorkResource(work: Work, env: Env): Promise<WorkResource> {
  const [subjects, contributions] = await Promise.all([
    getSubjectClassificationsForWork(work.id, env),
    getCreditsForWork(work.id, env),
  ]);
  return toWorkResource(work, subjects, contributions);
}

export async function loadWorkResources(works: Work[], env: Env): Promise<WorkResource[]> {
  return Promise.all(works.map((work) => loadWorkResource(work, env)));
}

export function toEditionResource(
  edition: Edition,
  contents: EditionContent[],
  identifiers: EditionIdentifier[] = [],
  contributions: ContributionCredit[] = []
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
    identifiers: identifiers.map((identifier) => ({
      namespace: identifier.namespace,
      value: identifier.value,
      provenance: identifier.provenance ?? null,
    })),
    contributions,
  };
}

export async function loadEditionResource(edition: Edition, env: Env): Promise<EditionResource> {
  const [contents, identifiers, contributions] = await Promise.all([
    getEditionContents(edition.id, env),
    getIdentifiersForEdition(edition.id, env),
    getCreditsForEdition(edition.id, env),
  ]);
  return toEditionResource(edition, contents, identifiers, contributions);
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

function normalizeSubjectName(name: string): string {
  return foldSearchText(name.trim().replace(/\s+/g, ' '));
}

function parseSubjectName(value: unknown): { name: string; nameNormalized: string } {
  if (typeof value !== 'string') {
    throw new CatalogValidationError('Subject name is required');
  }
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new CatalogValidationError('Subject name is required');
  }
  return { name, nameNormalized: normalizeSubjectName(name) };
}

export async function classifyWork(
  workId: string,
  input: { name?: unknown; provenance?: unknown },
  env: Env
): Promise<WorkResource> {
  const work = await getWorkById(workId, env);
  if (!work) {
    throw new CatalogNotFoundError('Work not found');
  }

  const { name, nameNormalized } = parseSubjectName(input.name);
  const provenance = parseOptionalText(input.provenance, 'Provenance');
  const subject = await insertSubject(name, nameNormalized, env);
  await classifyWorkWithSubject(work.id, subject.id, provenance, env);
  return loadWorkResource(work, env);
}

function parseNamespace(value: unknown): IdentifierNamespace {
  if (value === undefined || value === null || value === '') {
    throw new CatalogValidationError('Identifier namespace is required');
  }
  if (typeof value !== 'string' || !IDENTIFIER_NAMESPACES.includes(value as IdentifierNamespace)) {
    throw new CatalogValidationError(
      'Identifier namespace must be isbn_10, isbn_13, asin, oclc, or open_library'
    );
  }
  return value as IdentifierNamespace;
}

export function normalizeIdentifierValue(
  namespace: IdentifierNamespace,
  value: string
): string {
  const trimmed = value.trim();
  switch (namespace) {
    case 'isbn_10':
    case 'isbn_13':
    case 'asin':
      return trimmed.replace(/[-\s]/g, '').toUpperCase();
    case 'oclc':
      return trimmed.replace(/\s+/g, '').replace(/^oc[mn]/i, '');
    case 'open_library':
      return trimmed.replace(/^\/?(books|works)\//i, '').toUpperCase();
  }
}

function parseIdentifierValue(
  namespace: IdentifierNamespace,
  value: unknown
): { value: string; valueNormalized: string } {
  if (typeof value !== 'string') {
    throw new CatalogValidationError('Identifier value is required');
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CatalogValidationError('Identifier value is required');
  }
  const valueNormalized = normalizeIdentifierValue(namespace, trimmed);
  if (!valueNormalized) {
    throw new CatalogValidationError('Identifier value is required');
  }
  return { value: trimmed, valueNormalized };
}

export async function assignEditionIdentifier(
  editionId: string,
  input: { namespace?: unknown; value?: unknown; provenance?: unknown },
  env: Env
): Promise<EditionResource> {
  const edition = await getEditionById(editionId, env);
  if (!edition) {
    throw new CatalogNotFoundError('Edition not found');
  }

  const namespace = parseNamespace(input.namespace);
  const { value, valueNormalized } = parseIdentifierValue(namespace, input.value);
  try {
    await insertEditionIdentifier(
      {
        editionId,
        namespace,
        value,
        valueNormalized,
        provenance: parseOptionalText(input.provenance, 'Provenance'),
      },
      env
    );
  } catch (error) {
    if (error instanceof IdentifierConflictError) {
      throw new CatalogConflictError(error.message);
    }
    throw error;
  }

  return loadEditionResource(edition, env);
}

export async function lookupEditionByIdentifier(
  namespace: unknown,
  value: unknown,
  env: Env
): Promise<EditionResource> {
  const parsedNamespace = parseNamespace(namespace);
  const { valueNormalized } = parseIdentifierValue(parsedNamespace, value);
  const identifier = await findIdentifier(parsedNamespace, valueNormalized, env);
  if (!identifier) {
    throw new CatalogNotFoundError('Edition not found');
  }
  const edition = await getEditionById(identifier.editionId, env);
  if (!edition) {
    throw new CatalogNotFoundError('Edition not found');
  }
  return loadEditionResource(edition, env);
}

async function worksForIdentifiers(
  identifiers: EditionIdentifier[],
  env: Env
): Promise<WorkResource[]> {
  const editionIds = [...new Set(identifiers.map((identifier) => identifier.editionId))];
  const workIds: string[] = [];
  for (const editionId of editionIds) {
    const contents = await getEditionContents(editionId, env);
    for (const content of contents) {
      if (!workIds.includes(content.workId)) {
        workIds.push(content.workId);
      }
    }
  }
  const works = (
    await Promise.all(workIds.map((id) => getWorkById(id, env)))
  ).flatMap((work) => (work ? [work] : []));
  return loadWorkResources(works, env);
}

export interface CatalogSearchResult {
  works: WorkResource[];
  suggestions: CatalogSuggestion[];
  providerError: boolean;
}

async function searchLocalCatalog(query: string, env: Env): Promise<WorkResource[]> {
  const needle = query.trim();
  if (needle) {
    const candidates = [
      ...new Set(
        IDENTIFIER_NAMESPACES.map((namespace) =>
          normalizeIdentifierValue(namespace, needle)
        ).filter(Boolean)
      ),
    ];
    for (const candidate of candidates) {
      const identifiers = await findIdentifiersByNormalizedValue(candidate, env);
      if (identifiers.length > 0) {
        return worksForIdentifiers(identifiers, env);
      }
    }
  }

  return loadWorkResources(await searchWorks(query, env), env);
}

export async function searchCatalog(query: string, env: Env): Promise<CatalogSearchResult> {
  const works = await searchLocalCatalog(query, env);
  const needle = query.trim();
  if (!needle) {
    return { works, suggestions: [], providerError: false };
  }

  try {
    const suggestions = await searchOpenLibrary(needle, env);
    const unseen: CatalogSuggestion[] = [];
    for (const suggestion of suggestions) {
      const existing = await findIdentifier(
        'open_library',
        normalizeIdentifierValue('open_library', suggestion.workKey),
        env
      );
      if (!existing) {
        unseen.push(suggestion);
      }
    }
    return { works, suggestions: unseen, providerError: false };
  } catch (error) {
    if (error instanceof CatalogProviderError) {
      return { works, suggestions: [], providerError: true };
    }
    throw error;
  }
}

function parseContributorName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new CatalogValidationError('Contributor name is required');
  }
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new CatalogValidationError('Contributor name is required');
  }
  return name;
}

function parseRole(value: unknown): ContributionRole {
  if (value === undefined || value === null || value === '') {
    throw new CatalogValidationError('Contribution role is required');
  }
  if (typeof value !== 'string' || !CONTRIBUTION_ROLES.includes(value as ContributionRole)) {
    throw new CatalogValidationError(
      'Contribution role must be author, editor, translator, illustrator, or narrator'
    );
  }
  return value as ContributionRole;
}

export async function creditWork(
  workId: string,
  input: { name?: unknown; role?: unknown },
  env: Env
): Promise<WorkResource> {
  const work = await getWorkById(workId, env);
  if (!work) {
    throw new CatalogNotFoundError('Work not found');
  }
  const contributor = await insertContributor(parseContributorName(input.name), env);
  await insertContribution(
    {
      contributorId: contributor.id,
      workId: work.id,
      editionId: null,
      role: parseRole(input.role),
    },
    env
  );
  return loadWorkResource(work, env);
}

export async function creditEdition(
  editionId: string,
  input: { name?: unknown; role?: unknown },
  env: Env
): Promise<EditionResource> {
  const edition = await getEditionById(editionId, env);
  if (!edition) {
    throw new CatalogNotFoundError('Edition not found');
  }
  const contributor = await insertContributor(parseContributorName(input.name), env);
  await insertContribution(
    {
      contributorId: contributor.id,
      workId: null,
      editionId: edition.id,
      role: parseRole(input.role),
    },
    env
  );
  return loadEditionResource(edition, env);
}

export async function removeContribution(id: string, env: Env): Promise<void> {
  const contribution = await getContributionById(id, env);
  if (!contribution) {
    throw new CatalogNotFoundError('Contribution not found');
  }
  await deleteContribution(id, env);
}

function parseSuggestion(value: unknown): CatalogSuggestion {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new CatalogValidationError('A catalog suggestion is required');
  }
  const payload = value as Record<string, unknown>;
  if (payload.provider !== 'open_library') {
    throw new CatalogValidationError('Unsupported catalog provider');
  }
  const workKey = asRequiredText(payload.workKey, 'Work key');
  const title = asRequiredText(payload.title, 'Title');
  return {
    provider: 'open_library',
    workKey,
    editionKey: parseOptionalText(payload.editionKey, 'Edition key'),
    title,
    authors: Array.isArray(payload.authors)
      ? payload.authors.flatMap((author) =>
          typeof author === 'string' && author.trim() ? [author.trim()] : []
        )
      : [],
    firstPublishYear:
      typeof payload.firstPublishYear === 'number' && Number.isInteger(payload.firstPublishYear)
        ? payload.firstPublishYear
        : null,
    coverUrl: parseOptionalText(payload.coverUrl, 'Cover URL'),
    isbn13: parseOptionalText(payload.isbn13, 'ISBN-13'),
  };
}

function asRequiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CatalogValidationError(`${field} is required`);
  }
  return value.trim();
}

export async function acceptCatalogSuggestion(
  input: unknown,
  env: Env
): Promise<{ work: WorkResource; edition: EditionResource }> {
  const suggestion = parseSuggestion(
    input !== null && typeof input === 'object' && !Array.isArray(input) && 'suggestion' in input
      ? (input as { suggestion: unknown }).suggestion
      : input
  );

  const existing = await findIdentifier(
    'open_library',
    normalizeIdentifierValue('open_library', suggestion.workKey),
    env
  );
  if (existing) {
    const edition = await getEditionById(existing.editionId, env);
    if (!edition) {
      throw new CatalogNotFoundError('Edition not found');
    }
    const resource = await loadEditionResource(edition, env);
    const workId = resource.contents[0]?.workId;
    const work = workId ? await getWorkById(workId, env) : undefined;
    if (!work) {
      throw new CatalogNotFoundError('Work not found');
    }
    return { work: await loadWorkResource(work, env), edition: resource };
  }

  const work = await createWork({ title: suggestion.title }, env);
  for (const author of suggestion.authors) {
    await creditWork(work.id, { name: author, role: 'author' }, env);
  }

  const { edition } = await createEdition(
    {
      workId: work.id,
      displayedTitle: suggestion.title,
      format: 'print',
      progressUnit: 'page',
      coverUrl: suggestion.coverUrl,
    },
    env
  );

  await assignEditionIdentifier(edition.id, {
    namespace: 'open_library',
    value: suggestion.workKey,
    provenance: 'open_library',
  }, env);

  if (suggestion.isbn13) {
    await assignEditionIdentifier(edition.id, {
      namespace: 'isbn_13',
      value: suggestion.isbn13,
      provenance: 'open_library',
    }, env);
  }

  if (suggestion.editionKey) {
    await assignEditionIdentifier(edition.id, {
      namespace: 'open_library',
      value: suggestion.editionKey,
      provenance: 'open_library',
    }, env);
  }

  return {
    work: await loadWorkResource(work, env),
    edition: await loadEditionResource(edition, env),
  };
}
