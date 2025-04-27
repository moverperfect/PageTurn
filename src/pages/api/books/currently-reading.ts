import type { APIRoute } from 'astro';
import { getCurrentlyReadingBooksForUser } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session?.User?.id) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
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
  } catch (error) {
    console.error('Error fetching currently reading books:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch currently reading books' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}; 
