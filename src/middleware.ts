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

  // Allow API routes to handle their own authentication (e.g., token-based auth for mobile)
  const isApiRoute = (path: string) => {
    return path.startsWith("/api/");
  };

  // If the user is not authenticated and the path is not /login or /api/*, redirect to /login
  if (!isPublicPath(context.url.pathname) && !isApiRoute(context.url.pathname) && !isAuthed) {
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
