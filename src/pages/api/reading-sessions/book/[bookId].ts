import type { APIRoute } from 'astro';
import { getReadingSessionsForBook } from '../../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { bookId } = params;
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
