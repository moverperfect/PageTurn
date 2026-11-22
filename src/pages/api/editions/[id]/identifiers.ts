import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogConflictError,
  CatalogNotFoundError,
  CatalogValidationError,
  assignEditionIdentifier,
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
    return jsonResponse({ error: 'Invalid identifier data' }, 400);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid identifier data' }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    const edition = await assignEditionIdentifier(
      id,
      {
        namespace: payload.namespace,
        value: payload.value,
        provenance: payload.provenance,
      },
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
    if (error instanceof CatalogConflictError) {
      return jsonResponse({ error: error.message }, 409);
    }
    console.error('Error assigning identifier:', error);
    return jsonResponse({ error: 'Failed to assign identifier' }, 500);
  }
};
