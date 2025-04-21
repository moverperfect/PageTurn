import type { APIRoute } from 'astro';
import { getCurrentlyReadingBooks } from '../../../lib/store';

export const GET: APIRoute = async () => {
  const currentlyReading = getCurrentlyReadingBooks();

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
