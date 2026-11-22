import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import {
  CatalogNotFoundError,
  removeContribution,
} from '../../../lib/catalog';
import {
  getAuthenticatedUserId,
  jsonResponse,
  unauthorizedResponse,
} from '../../../lib/api-auth';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!getAuthenticatedUserId(locals)) {
    return unauthorizedResponse();
  }

  const { id } = params;
  if (!id) {
    return jsonResponse({ error: 'Contribution ID is required' }, 400);
  }

  try {
    await removeContribution(id, env);
    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof CatalogNotFoundError) {
      return jsonResponse({ error: error.message }, 404);
    }
    console.error('Error removing contribution:', error);
    return jsonResponse({ error: 'Failed to remove contribution' }, 500);
  }
};
