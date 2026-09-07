import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { toWorkResource } from '../../../lib/catalog';
import { getWorkById } from '../../../lib/db';
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
    return jsonResponse({ error: 'Work ID is required' }, 400);
  }

  const work = await getWorkById(id, env);
  if (!work) {
    return jsonResponse({ error: 'Work not found' }, 404);
  }

  return jsonResponse(toWorkResource(work));
};
