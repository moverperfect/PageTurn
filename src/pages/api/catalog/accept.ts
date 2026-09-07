import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  acceptCatalogSuggestion,
  CatalogValidationError,
  CatalogNotFoundError,
  CatalogConflictError,
} from '../../../lib/catalog';
import {
  getAuthenticatedUserId,
  jsonResponse,
  unauthorizedResponse,
} from '../../../lib/api-auth';

export const POST: APIRoute = async ({ request, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid suggestion' }, 400);
  }

  try {
    const accepted = await acceptCatalogSuggestion(body, env);
    return jsonResponse(accepted, 201);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    if (error instanceof CatalogConflictError) {
      return jsonResponse({ error: error.message }, 409);
    }
    console.error('Error accepting catalog suggestion:', error);
    return jsonResponse({ error: 'Failed to accept suggestion' }, 500);
  }
};
