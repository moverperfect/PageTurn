import { createAuthClient } from 'better-auth/client';
import { oneTapClient } from 'better-auth/client/plugins';
import { adminClient } from 'better-auth/client/plugins';

// Initialize authClient with proper plugins
export function initAuthClient(googleClientId?: string) {
  if (googleClientId) {
    return createAuthClient({
      plugins: [
        oneTapClient({
          clientId: googleClientId,
        }),
        adminClient()
      ],
    });
  } else {
    return createAuthClient({
      plugins: [
        adminClient()
      ]
    });
  }
} 
