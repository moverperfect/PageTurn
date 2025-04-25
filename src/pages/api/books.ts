import type { APIRoute } from 'astro';
import type { Book } from '../../lib/schema';
import { getAllBooks, addBook } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const allBooks = await getAllBooks(locals.runtime.env);

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
    const bookData = await request.json() as Omit<Book, 'id'>;
    const newBook = await addBook(bookData, locals.runtime.env);

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
