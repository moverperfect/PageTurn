import type { APIRoute } from 'astro';
import { getCurrentlyReadingBooks } from '../../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const currentlyReading = await getCurrentlyReadingBooks(locals.runtime.env);

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
