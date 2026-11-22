import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogNotFoundError,
  CatalogValidationError,
  classifyWork,
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
    return jsonResponse({ error: 'Work ID is required' }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid subject data' }, 400);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid subject data' }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    const work = await classifyWork(
      id,
      { name: payload.name, provenance: payload.provenance },
      env
    );
    return jsonResponse(work, 201);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error classifying Work:', error);
    return jsonResponse({ error: 'Failed to classify Work' }, 500);
  }
};
