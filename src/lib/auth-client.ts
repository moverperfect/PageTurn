import { createAuthClient } from 'better-auth/client';
import { oneTapClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';

// Initialize authClient with proper plugins
// When authBaseUrl is provided (e.g. on preview deployments), the client sends all auth
// requests to that URL to fix state_mismatch - the OAuth state cookie must be on the same
// domain as the callback URL.
export function initAuthClient(googleClientId?: string, authBaseUrl?: string) {
  const baseOptions = authBaseUrl ? { baseURL: authBaseUrl } : {};
  if (googleClientId) {
    return createAuthClient({
      ...baseOptions,
      plugins: [
        oneTapClient({
          clientId: googleClientId,
        }),
        adminClient()
      ],
    });
  } else {
    return createAuthClient({
      ...baseOptions,
      plugins: [
        adminClient()
      ]
    });
  }
} 
