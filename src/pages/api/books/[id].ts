import type { APIRoute } from 'astro';
import type { Book } from '../../../lib/schema';
import { getBookById, updateBook, deleteBook } from '../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
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

  const book = await getBookById(id!, locals.runtime.env);

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

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;
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

  try {
    const updates = await request.json() as Partial<Omit<Book, 'id'>>;
    const existingBook = await getBookById(id!, locals.runtime.env);

    if (!existingBook) {
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

    if (existingBook.userId !== userId) {
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

    const updatedBook = await updateBook(id!, updates, locals.runtime.env);

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

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
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

  const book = await getBookById(id!, locals.runtime.env);

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

  const deleted = await deleteBook(id!, locals.runtime.env);

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
