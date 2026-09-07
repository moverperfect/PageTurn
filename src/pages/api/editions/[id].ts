import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { toEditionResource } from '../../../lib/catalog';
import { getEditionById, getEditionContents } from '../../../lib/db';
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

  const contents = await getEditionContents(id, env);
  return jsonResponse(toEditionResource(edition, contents));
};
