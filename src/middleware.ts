import { getAuth } from "./lib/auth";
import { jsonResponse } from "./lib/api-auth";
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  let isAuthed;
  try {
    isAuthed = await getAuth(context.locals.runtime.env).api
      .getSession({
        headers: context.request.headers,
      });
  } catch (error) {
    console.error('Session validation error:', error);
    isAuthed = null;
  }

  if (isAuthed) {
    context.locals.session = {
      Session: isAuthed.session,
      User: isAuthed.user
    };
    return next();
  }

  const path = context.url.pathname;
  const isLoginPath = path === "/login";
  const isAuthApiRoute = path === "/api/auth" || path.startsWith("/api/auth/");
  const isApiRoute = path.startsWith("/api/");

  if (isLoginPath || isAuthApiRoute) {
    return next();
  }

  if (isApiRoute) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  return context.redirect("/login");
});
