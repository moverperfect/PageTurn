import { getAuth } from "./lib/auth";
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

  const isPublicPath = (path: string) => {
    return path === "/login" || path.startsWith("/api/auth");
  };

  // If the user is not authenticated and the path is not /login or /api/auth/*, redirect to /login
  if (!isPublicPath(context.url.pathname) && !isAuthed) {
    return context.redirect("/login");
  }
  if (isAuthed) {
    context.locals.session = {
      Session: isAuthed.session,
      User: isAuthed.user
    };
  }
  return next();
});
