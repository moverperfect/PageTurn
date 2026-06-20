export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

export function getAuthenticatedUserId(locals: App.Locals): string | null {
  return locals.session?.User?.id ?? null;
}

export function unauthorizedResponse(): Response {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

export function forbiddenResponse(): Response {
  return jsonResponse({ error: 'Forbidden' }, 403);
}
