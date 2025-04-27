import type { APIRoute } from 'astro';
import { getCurrentlyReadingBooksForUser } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const currentlyReading = await getCurrentlyReadingBooksForUser(locals.session.User.id, locals.runtime.env);

  return new Response(
    JSON.stringify(currentlyReading),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}; 
