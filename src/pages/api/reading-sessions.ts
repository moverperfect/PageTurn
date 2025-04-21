import type { APIRoute } from 'astro';
import type { ReadingSession } from '../../lib/db';
import { getAllReadingSessions, addReadingSession } from '../../lib/store';

export const GET: APIRoute = async ({ params, request }) => {
  const sessions = getAllReadingSessions();

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const sessionData = await request.json() as Omit<ReadingSession, 'id'>;
    const newSession = addReadingSession(sessionData);

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
