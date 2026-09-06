import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogValidationError,
  createWork,
  searchWorks,
  toWorkResource,
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

  const query = url.searchParams.get('q') ?? '';
  const found = await searchWorks(query, env);
  return jsonResponse({ works: found.map(toWorkResource) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid work data' }, 400);
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Invalid work data' }, 400);
  }

  const payload = body as Record<string, unknown>;
  try {
    const work = await createWork(
      {
        title: payload.title,
        firstPublicationDate: payload.firstPublicationDate,
      },
      env
    );
    return jsonResponse(toWorkResource(work), 201);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    console.error('Error creating Work:', error);
    return jsonResponse({ error: 'Failed to create Work' }, 500);
  }
};
