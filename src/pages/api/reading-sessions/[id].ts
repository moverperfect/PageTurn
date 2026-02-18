import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../../lib/schema';
import { updateReadingSession, deleteReadingSession, getReadingSessionById, getBookById, updateBook } from '../../../lib/db';
import { forbiddenResponse, getAuthenticatedUserId, jsonResponse, unauthorizedResponse } from '../../../lib/api-auth';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!id) {
    return jsonResponse({ error: 'Reading session ID is required' }, 400);
  }

  const session = await getReadingSessionById(id, locals.runtime.env);

  if (!session) {
    return jsonResponse({ error: 'Reading session not found' }, 404);
  }
  if (session.userId !== userId) {
    return forbiddenResponse();
  }

  return jsonResponse(session);
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!id) {
    return jsonResponse({ error: 'Reading session ID is required' }, 400);
  }

  const existingSession = await getReadingSessionById(id, locals.runtime.env);

  if (!existingSession) {
    return jsonResponse({ error: 'Reading session not found' }, 404);
  }
  if (existingSession.userId !== userId) {
    return forbiddenResponse();
  }

  try {
    const updates = await request.json() as Partial<ReadingSession>;
    if (updates.pagesRead !== undefined && (typeof updates.pagesRead !== 'number' || updates.pagesRead < 0)) {
      return jsonResponse({ error: 'Pages read must be a positive number' }, 400);
    }
    if (updates.duration !== undefined && (typeof updates.duration !== 'number' || updates.duration < 0)) {
      return jsonResponse({ error: 'Duration must be a positive number of seconds' }, 400);
    }

    const targetBookId = updates.bookId ?? existingSession.bookId;
    const targetBook = await getBookById(targetBookId, locals.runtime.env);

    if (!targetBook) {
      return jsonResponse({ error: 'Book not found' }, 404);
    }
    if (targetBook.userId !== userId) {
      return forbiddenResponse();
    }

    const { id: _ignoredId, userId: _ignoredUserId, ...sessionUpdates } = updates;
    const updatedSession = await updateReadingSession(id, sessionUpdates, locals.runtime.env);

    if (!updatedSession) {
      return jsonResponse({ error: 'Reading session not found' }, 404);
    }

    // If the session was marked as finished, update the book's finished status
    if (updates.finished === true) {
      try {
        if (!targetBook.finished) {
          // Update the book's finished status
          await updateBook(updatedSession.bookId, { finished: true }, locals.runtime.env);
        }
      } catch (error) {
        console.error('Error updating book finished status:', error);
      }
    }

    return jsonResponse(updatedSession);
  } catch (error) {
    return jsonResponse({ error: 'Invalid update data' }, 400);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!id) {
    return jsonResponse({ error: 'Reading session ID is required' }, 400);
  }

  const session = await getReadingSessionById(id, locals.runtime.env);

  if (!session) {
    return jsonResponse({ error: 'Reading session not found' }, 404);
  }
  if (session.userId !== userId) {
    return forbiddenResponse();
  }

  const deleted = await deleteReadingSession(id, locals.runtime.env);

  return jsonResponse(deleted, deleted ? 200 : 404);
}; 
