import type { APIRoute } from 'astro';
import type { Book } from '../../../lib/db';
import { getBookById, updateBook, deleteBook } from '../../../lib/store';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const book = getBookById(id!);

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

  return new Response(
    JSON.stringify(book),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
};

export const PUT: APIRoute = async ({ params, request }) => {
  const { id } = params;

  try {
    const updates = await request.json() as Partial<Omit<Book, 'id'>>;
    const updatedBook = updateBook(id!, updates);

    if (!updatedBook) {
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

    return new Response(
      JSON.stringify(updatedBook),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid update data' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  const deleted = deleteBook(id!);

  return new Response(
    JSON.stringify(deleted),
    {
      status: deleted ? 200 : 404,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}; 
