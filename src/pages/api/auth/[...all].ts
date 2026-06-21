import { env } from 'cloudflare:workers';
import { getAuth, isTrustedAuthOrigin } from "../../../lib/auth";
import type { APIRoute } from "astro";

function getCorsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin");

  if (!isTrustedAuthOrigin(env, origin)) {
    return null;
  }

  const requestedHeaders = request.headers.get("Access-Control-Request-Headers");

  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders || "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function withCorsHeaders(response: Response, corsHeaders: Record<string, string> | null) {
  if (!corsHeaders) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const ALL: APIRoute = async (ctx) => {
  const corsHeaders = getCorsHeaders(ctx.request, env);

  if (ctx.request.method === "OPTIONS") {
    return new Response(null, {
      status: corsHeaders ? 204 : 403,
      headers: corsHeaders ?? undefined,
    });
  }

  const auth = getAuth(env);
  try {
    return withCorsHeaders(await auth.handler(ctx.request), corsHeaders);
  } catch (error) {
    console.error('Authentication error:', error);
    return withCorsHeaders(new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }), corsHeaders);
  }
};
