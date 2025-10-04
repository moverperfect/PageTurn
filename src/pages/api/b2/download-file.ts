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

  const fileId = url.searchParams.get('fileId');
  if (!fileId) {
    return new Response(JSON.stringify({ error: 'fileId parameter required' }), {
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

    const authData = await authResponse.json() as {
      downloadUrl: string;
      authorizationToken: string;
    };

    // Download the file from B2
    const downloadResponse = await fetch(
      `${authData.downloadUrl}/b2api/v2/b2_download_file_by_id?fileId=${fileId}`,
      {
        headers: {
          Authorization: authData.authorizationToken,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error('Failed to download file from B2');
    }

    // Get relevant headers from B2 response
    const contentType = downloadResponse.headers.get('content-type') || 'application/octet-stream';
    const contentLength = downloadResponse.headers.get('content-length');
    const fileName = downloadResponse.headers.get('x-bz-file-name');
    const etag = downloadResponse.headers.get('etag');
    const lastModified = downloadResponse.headers.get('last-modified');

    // Stream the file back to the client
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      // Private caching only - no shared/CDN caching for admin-protected files
      // Allows browser caching but requires re-authentication on each session
      'Cache-Control': 'private, max-age=3600, must-revalidate',
      // Prevent CDN from caching admin-protected content
      'CDN-Cache-Control': 'no-store',
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    if (fileName) {
      headers['X-File-Name'] = decodeURIComponent(fileName);
    }

    // Pass through ETag and Last-Modified for conditional requests
    if (etag) {
      headers['ETag'] = etag;
    }

    if (lastModified) {
      headers['Last-Modified'] = lastModified;
    }

    return new Response(downloadResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

