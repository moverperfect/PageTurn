import type { APIRoute } from 'astro';
import { getBookById, getReadingSessionsForBook } from '../../../../lib/db';
import { forbiddenResponse, getAuthenticatedUserId, jsonResponse, unauthorizedResponse } from '../../../../lib/api-auth';

export const GET: APIRoute = async ({ params, locals }) => {
  const { bookId } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!bookId) {
    return jsonResponse({ error: 'Book ID is required' }, 400);
  }

  const book = await getBookById(bookId, locals.runtime.env);

  if (!book) {
    return jsonResponse({ error: 'Book not found' }, 404);
  }
  if (book.userId !== userId) {
    return forbiddenResponse();
  }

  const bookSessions = await getReadingSessionsForBook(bookId, locals.runtime.env);

  return jsonResponse(bookSessions.filter(session => session.userId === userId));
}; 
