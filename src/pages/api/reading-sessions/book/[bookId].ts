import type { APIRoute } from 'astro';
import { getBookById, getReadingSessionsForBook } from '../../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { bookId } = params;
  const userId = locals.session?.User?.id;
  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  const book = await getBookById(bookId!, locals.runtime.env);
  if (!book) {
    return new Response(
      JSON.stringify({ error: 'Book not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  if (book.userId !== userId) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  const bookSessions = await getReadingSessionsForBook(bookId!, locals.runtime.env);

  return new Response(
    JSON.stringify(bookSessions),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}; 
