import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../lib/schema';
import { getAllReadingSessions, addReadingSession } from '../../lib/db';

export const GET: APIRoute = async ({ locals }) => {
  const sessions = await getAllReadingSessions(locals.runtime.env);

  return new Response(
    JSON.stringify(sessions),
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
    const sessionData = await request.json() as Omit<ReadingSession, 'id'>;
    const newSession = await addReadingSession(sessionData, locals.runtime.env);

    return new Response(
      JSON.stringify(newSession),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid session data' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}; 
