import type { APIRoute } from 'astro';
import type { Book } from '../../../lib/schema';
import { getBookById, updateBook, deleteBook } from '../../../lib/db';
import { forbiddenResponse, getAuthenticatedUserId, jsonResponse, unauthorizedResponse } from '../../../lib/api-auth';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!id) {
    return jsonResponse({ error: 'Book ID is required' }, 400);
  }

  const book = await getBookById(id, locals.runtime.env);

  if (!book) {
    return jsonResponse({ error: 'Book not found' }, 404);
  }
  if (book.userId !== userId) {
    return forbiddenResponse();
  }

  return jsonResponse(book);
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
  const userId = getAuthenticatedUserId(locals);

  if (!userId) {
    return unauthorizedResponse();
  }
  if (!id) {
    return jsonResponse({ error: 'Book ID is required' }, 400);
  }

  const book = await getBookById(id, locals.runtime.env);

  if (!book) {
    return jsonResponse({ error: 'Book not found' }, 404);
  }
  if (book.userId !== userId) {
    return forbiddenResponse();
  }

  try {
    const updates = await request.json() as Partial<Book>;
    const { id: _ignoredId, userId: _ignoredUserId, ...bookUpdates } = updates;
    const updatedBook = await updateBook(id, bookUpdates, locals.runtime.env);

    if (!updatedBook) {
      return jsonResponse({ error: 'Book not found' }, 404);
    }

    return jsonResponse(updatedBook);
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
    return jsonResponse({ error: 'Book ID is required' }, 400);
  }

  const book = await getBookById(id, locals.runtime.env);

  if (!book) {
    return jsonResponse({ error: 'Book not found' }, 404);
  }
  if (book.userId !== userId) {
    return forbiddenResponse();
  }

  const deleted = await deleteBook(id, locals.runtime.env);

  return jsonResponse(deleted, deleted ? 200 : 404);
}; 
