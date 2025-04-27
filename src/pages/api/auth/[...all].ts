import { getAuth } from "../../../lib/auth";
import type { APIRoute } from "astro";

export const ALL: APIRoute = async (ctx) => {
  const auth = getAuth(ctx.locals.runtime.env);
  try {
    return await auth.handler(ctx.request);
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
