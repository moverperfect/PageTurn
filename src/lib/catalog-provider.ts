import { getProviderCache, setProviderCache } from './db';

export class CatalogProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogProviderError';
  }
}

export interface CatalogSuggestion {
  provider: 'open_library';
  workKey: string;
  editionKey: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverUrl: string | null;
  isbn13: string | null;
}

const USER_AGENT = 'PageTurn/0.0.1 (https://github.com/moverperfect/PageTurn)';
const DEFAULT_PROVIDER_BASE = 'https://openlibrary.org';
const SEARCH_LIMIT = 5;
const FETCH_TIMEOUT_MS = 5_000;

export function providerBaseUrl(env: Env): string {
  const configured = env.OPEN_LIBRARY_BASE_URL?.trim();
  return (configured || DEFAULT_PROVIDER_BASE).replace(/\/$/, '');
}

interface OpenLibrarySearchDoc {
  key?: unknown;
  title?: unknown;
  author_name?: unknown;
  first_publish_year?: unknown;
  cover_i?: unknown;
  edition_key?: unknown;
  isbn?: unknown;
}

function parseCachedSuggestions(cached: string): CatalogSuggestion[] | null {
  try {
    const parsed: unknown = JSON.parse(cached);
    return Array.isArray(parsed) ? (parsed as CatalogSuggestion[]) : null;
  } catch {
    return null;
  }
}

function parseSearchDocs(body: unknown): OpenLibrarySearchDoc[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new CatalogProviderError('Open Library is unavailable');
  }
  if (!('docs' in body) || body.docs === undefined || body.docs === null) {
    return [];
  }
  if (!Array.isArray(body.docs)) {
    throw new CatalogProviderError('Open Library is unavailable');
  }
  return body.docs.flatMap((doc) =>
    doc && typeof doc === 'object' && !Array.isArray(doc) ? [doc as OpenLibrarySearchDoc] : []
  );
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((entry) => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []))
    : [];
}

function coverUrlFromId(coverId: unknown): string | null {
  return typeof coverId === 'number' && Number.isInteger(coverId) && coverId > 0
    ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
    : null;
}

function isbn13FromDoc(doc: OpenLibrarySearchDoc): string | null {
  const isbns = asStringArray(doc.isbn);
  return isbns.find((isbn) => isbn.replace(/[-\s]/g, '').length === 13) ?? null;
}

function toSuggestion(doc: OpenLibrarySearchDoc): CatalogSuggestion | null {
  const workKey = asString(doc.key);
  const title = asString(doc.title);
  if (!workKey || !title) {
    return null;
  }
  const editionKeys = asStringArray(doc.edition_key);
  return {
    provider: 'open_library',
    workKey,
    editionKey: editionKeys[0] ? `/books/${editionKeys[0].replace(/^\/books\//, '')}` : null,
    title,
    authors: asStringArray(doc.author_name),
    firstPublishYear:
      typeof doc.first_publish_year === 'number' && Number.isInteger(doc.first_publish_year)
        ? doc.first_publish_year
        : null,
    coverUrl: coverUrlFromId(doc.cover_i),
    isbn13: isbn13FromDoc(doc),
  };
}

export async function searchOpenLibrary(
  query: string,
  env: Env
): Promise<CatalogSuggestion[]> {
  const needle = query.trim();
  if (!needle) {
    return [];
  }

  const cacheKey = `ol:search:${needle.toLowerCase()}`;
  const cached = await getProviderCache(cacheKey, env);
  if (cached) {
    const suggestions = parseCachedSuggestions(cached);
    if (suggestions) {
      return suggestions;
    }
  }

  const url = `${providerBaseUrl(env)}/search.json?q=${encodeURIComponent(needle)}&limit=${SEARCH_LIMIT}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new CatalogProviderError('Open Library is unavailable');
  }

  if (!response.ok) {
    throw new CatalogProviderError('Open Library is unavailable');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CatalogProviderError('Open Library is unavailable');
  }

  const suggestions = parseSearchDocs(body)
    .map(toSuggestion)
    .flatMap((suggestion) => (suggestion ? [suggestion] : []));
  await setProviderCache(cacheKey, JSON.stringify(suggestions), env);
  return suggestions;
}
