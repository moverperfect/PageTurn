import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { CatalogNotFoundError, loadEditionResource } from '../../../lib/catalog';
import { getEditionById } from '../../../lib/db';
import {
  getAuthenticatedUserId,
  jsonResponse,
  unauthorizedResponse,
} from '../../../lib/api-auth';

export const GET: APIRoute = async ({ params, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  const { id } = params;
  if (!id) {
    return jsonResponse({ error: 'Edition ID is required' }, 400);
  }

  const edition = await getEditionById(id, env);
  if (!edition) {
    return jsonResponse({ error: 'Edition not found' }, 404);
  }

  try {
    return jsonResponse(await loadEditionResource(edition, env));
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error loading Edition:', error);
    return jsonResponse({ error: 'Failed to load Edition' }, 500);
  }
};
