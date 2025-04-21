import type { APIRoute } from 'astro';
import { getReadingSessionsForBook } from '../../../../lib/store';

export const GET: APIRoute = async ({ params }) => {
  const { bookId } = params;
  const bookSessions = getReadingSessionsForBook(bookId!);

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
