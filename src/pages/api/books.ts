import type { APIRoute } from 'astro';
import type { Book } from '../../lib/schema';
import { getAllBooksForUser, addBook } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.session?.User?.id) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const allBooks = await getAllBooksForUser(locals.session.User.id, locals.runtime.env);

  return new Response(
    JSON.stringify(allBooks),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Require authenticated user
    if (!locals.session?.User?.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    const bookData = await request.json() as Omit<Book, 'id'>;
    const bookWithUser: Omit<Book, 'id'> = {
      ...bookData,
      userId: locals.session.User.id
    };
    const newBook = await addBook(bookWithUser, locals.runtime.env);

    return new Response(
      JSON.stringify(newBook),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid book data' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 
