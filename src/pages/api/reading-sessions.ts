import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../lib/schema';
import { getAllReadingSessionsForUser, addReadingSession, updateBook, getBookById } from '../../lib/db';
import { forbiddenResponse, getAuthenticatedUserId, jsonResponse, unauthorizedResponse } from '../../lib/api-auth';

export const GET: APIRoute = async ({ locals }) => {
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }

  const sessions = await getAllReadingSessionsForUser(userId, env);

  return jsonResponse(sessions);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }

  try {
    const sessionData = await request.json() as Omit<ReadingSession, 'id'>;

    if (!sessionData.bookId) {
      return jsonResponse({ error: 'Book ID is required' }, 400);
    }
    if (typeof sessionData.pagesRead !== 'number' || sessionData.pagesRead < 0) {
      return jsonResponse({ error: 'Pages read must be a non-negative number' }, 400);
    }
    if (typeof sessionData.duration !== 'number' || sessionData.duration < 0) {
      return jsonResponse({ error: 'Duration must be a non-negative number of seconds' }, 400);
    }

    const book = await getBookById(sessionData.bookId, env);

    if (!book) {
      return jsonResponse({ error: 'Book not found' }, 404);
    }
    if (book.userId !== userId) {
      return forbiddenResponse();
    }

    const newSession = await addReadingSession(
      { ...sessionData, userId },
      env,
      userId
    );

    // If the session marks the book as finished, update the book's finished status
    if (sessionData.finished) {
      try {
        if (book && !book.finished) {
          // Update the book's finished status
          await updateBook(sessionData.bookId, { finished: true }, env);
        }
      } catch (error) {
        console.error('Error updating book finished status:', error);
      }
    }

    return jsonResponse(newSession, 201);
  } catch (error) {
    return jsonResponse({ error: 'Invalid session data' }, 400);
  }
}; 
