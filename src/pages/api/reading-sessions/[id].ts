import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../../lib/schema';
import { updateReadingSession, deleteReadingSession, getReadingSessionById } from '../../../lib/db';

export const GET: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  // We'll implement a workaround by filtering all sessions
  const session = await getReadingSessionById(id!, locals.runtime.env);

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

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const { id } = params;

  try {
    const updates = await request.json() as Partial<Omit<ReadingSession, 'id'>>;
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Reading session ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (updates.pagesRead !== undefined && (typeof updates.pagesRead !== 'number' || updates.pagesRead < 0)) {
      return new Response(
        JSON.stringify({ error: 'Pages read must be a positive number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (updates.duration !== undefined && (typeof updates.duration !== 'number' || updates.duration < 0)) {
      return new Response(
        JSON.stringify({ error: 'Duration must be a positive number of seconds' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const updatedSession = await updateReadingSession(id, updates, locals.runtime.env);

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

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { id } = params;
  if (!id) {
    return new Response(
      JSON.stringify({ error: 'Reading session ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const deleted = await deleteReadingSession(id, locals.runtime.env);

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
