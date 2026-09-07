import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogNotFoundError,
  CatalogValidationError,
  creditEdition,
} from '../../../../lib/catalog';
import {
  getAuthenticatedUserId,
  jsonResponse,
  unauthorizedResponse,
} from '../../../../lib/api-auth';

export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  const { id } = params;
  if (!id) {
    return jsonResponse({ error: 'Edition ID is required' }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid contribution data' }, 400);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid contribution data' }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    const edition = await creditEdition(
      id,
      { name: payload.name, role: payload.role },
      env
    );
    return jsonResponse(edition, 201);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error crediting Edition:', error);
    return jsonResponse({ error: 'Failed to credit Edition' }, 500);
  }
};
