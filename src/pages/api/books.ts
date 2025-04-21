import type { APIRoute } from 'astro';
import type { Book } from '../../lib/db';
import { getAllBooks, addBook } from '../../lib/store';


export const GET: APIRoute = async ({ params, request }) => {
  const allBooks = getAllBooks();

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const bookData = await request.json() as Omit<Book, 'id'>;
    const newBook = addBook(bookData);

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
