import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals, url }) => {
  // Check authentication - only admins can access
  const session = locals.session;
  const user = session?.User;

  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const folder = url.searchParams.get('folder');
  if (!folder) {
    return new Response(JSON.stringify({ error: 'folder parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const env = locals.runtime.env;

    if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) {
      return new Response(
        JSON.stringify({ error: 'B2 credentials not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Authorize with B2
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
      throw new Error('Failed to authorize with B2');
    }

    const authData = await authResponse.json();

    // List files in the specified folder
    const listResponse = await fetch(
      `${authData.apiUrl}/b2api/v2/b2_list_file_names`,
      {
        method: 'POST',
        headers: {
          Authorization: authData.authorizationToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bucketId: env.B2_BUCKET_ID,
          maxFileCount: 10000,
          prefix: `${folder}/`,
        }),
      }
    );

    if (!listResponse.ok) {
      throw new Error('Failed to list files from B2');
    }

    const listData = await listResponse.json();

    // Filter out folder entries and format response
    const files = (listData.files || [])
      .filter((file: any) => !file.fileName.endsWith('/'))
      .map((file: any) => ({
        fileName: file.fileName,
        fileId: file.fileId,
        contentLength: file.contentLength,
        uploadTimestamp: file.uploadTimestamp,
      }));

    return new Response(
      JSON.stringify({ files }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache file list for 5 minutes
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('Error listing files:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

