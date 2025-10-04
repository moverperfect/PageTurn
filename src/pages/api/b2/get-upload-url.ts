import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ locals, request }) => {
  // Check authentication - only admins can upload
  const session = locals.session;
  const user = session?.User;

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const env = locals.runtime.env;

    // Check if B2 credentials are configured
    if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) {
      return new Response(
        JSON.stringify({ error: 'B2 credentials not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await request.json() as { fileName?: string };
    const { fileName } = body;

    if (!fileName) {
      return new Response(JSON.stringify({ error: 'fileName is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Authorize with B2
    const authResponse = await fetch(
      'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
      {
        headers: {
          Authorization:
            'Basic ' +
            btoa(`${env.B2_APPLICATION_KEY_ID}:${env.B2_APPLICATION_KEY}`),
        },
      }
    );

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error('B2 authorization failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to authorize with B2' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const authData = await authResponse.json() as {
      apiUrl: string;
      authorizationToken: string;
    };

    // Step 2: Get upload URL
    const uploadUrlResponse = await fetch(
      `${authData.apiUrl}/b2api/v2/b2_get_upload_url`,
      {
        method: 'POST',
        headers: {
          Authorization: authData.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: env.B2_BUCKET_ID,
        }),
      }
    );

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      console.error('Failed to get B2 upload URL:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get upload URL from B2' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const uploadData = await uploadUrlResponse.json() as {
      uploadUrl: string;
      authorizationToken: string;
    };

    // Return the upload URL and auth token to the client
    return new Response(
      JSON.stringify({
        uploadUrl: uploadData.uploadUrl,
        authorizationToken: uploadData.authorizationToken,
        fileName: fileName,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error getting B2 upload URL:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

