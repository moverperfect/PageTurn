import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogNotFoundError,
  CatalogValidationError,
  createEdition,
  lookupEditionByIdentifier,
  toEditionResource,
} from '../../lib/catalog';
import {
  getAuthenticatedUserId,
  jsonResponse,
  unauthorizedResponse,
} from '../../lib/api-auth';

export const GET: APIRoute = async ({ url, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  const namespace = url.searchParams.get('namespace');
  const value = url.searchParams.get('value');
  if (!namespace || !value) {
    return jsonResponse(
      { error: 'Identifier namespace and value are required' },
      400
    );
  }

  try {
    const edition = await lookupEditionByIdentifier(namespace, value, env);
    return jsonResponse(edition);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error looking up Edition:', error);
    return jsonResponse({ error: 'Failed to look up Edition' }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid edition data' }, 400);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid edition data' }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    const { edition, contents } = await createEdition(
      {
        workId: payload.workId,
        displayedTitle: payload.displayedTitle,
        language: payload.language,
        publisher: payload.publisher,
        publicationDate: payload.publicationDate,
        format: payload.format,
        progressUnit: payload.progressUnit,
        coverUrl: payload.coverUrl,
        editionLength: payload.editionLength,
      },
      env
    );
    return jsonResponse(toEditionResource(edition, contents), 201);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error creating Edition:', error);
    return jsonResponse({ error: 'Failed to create Edition' }, 500);
  }
};
