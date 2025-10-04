import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  // Check authentication - only admins can access
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

    // List all files to extract folder names
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
          delimiter: '/',
        }),
      }
    );

    if (!listResponse.ok) {
      throw new Error('Failed to list files from B2');
    }

    const listData = await listResponse.json();

    // Extract unique folder names (prefixes)
    const folders = new Set<string>();

    // Check for files with paths
    if (listData.files) {
      for (const file of listData.files) {
        const parts = file.fileName.split('/');
        if (parts.length > 1) {
          folders.add(parts[0]); // Add the folder part
        }
      }
    }

    // Sort folders by date (newest first)
    const sortedFolders = Array.from(folders).sort((a, b) => b.localeCompare(a));

    return new Response(
      JSON.stringify({ folders: sortedFolders }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache folder list for 5 minutes (folders don't change often)
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('Error listing folders:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

