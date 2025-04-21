import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../../lib/db';
import { getReadingSessionById, updateReadingSession, deleteReadingSession } from '../../../lib/store';

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  const session = getReadingSessionById(id!);

  if (!session) {
    return new Response(
      JSON.stringify({ error: 'Reading session not found' }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  return new Response(
    JSON.stringify(session),
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
    const updates = await request.json() as Partial<Omit<ReadingSession, 'id'>>;
    const updatedSession = updateReadingSession(id!, updates);

    if (!updatedSession) {
      return new Response(
        JSON.stringify({ error: 'Reading session not found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return new Response(
      JSON.stringify(updatedSession),
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
  const deleted = deleteReadingSession(id!);

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
