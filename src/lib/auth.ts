import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDbClient } from "./db-client";
import { oAuthProxy, oneTap } from "better-auth/plugins";

// Singleton auth client
let authInstance: ReturnType<typeof betterAuth>;

// Static auth config for CLI generation
// The CLI only needs the configuration, not an actual initialized instance
export const auth = betterAuth({
  database: drizzleAdapter({} as any, {
    // The CLI doesn't execute this function, it just reads the config structure
    // so we can provide a placeholder that will be replaced at runtime
    provider: "sqlite",
  }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    oAuthProxy({
      currentURL: process.env.CF_PAGES_URL,
      productionURL: process.env.BETTER_AUTH_URL,
    })
  ]
});

/**
 * Returns a singleton authentication client configured with the given environment.
 *
 * Initializes the authentication client with a Drizzle adapter, GitHub and Google OAuth providers, and authentication plugins using environment variables. Ensures only one instance is created and reused for subsequent calls.
 *
 * @param env - Environment object containing OAuth credentials, database configuration, and URLs for authentication.
 * @returns The initialized authentication client instance.
 *
 * @throws {Error} If GitHub or Google OAuth credentials are missing from {@link env}.
 */
export function getAuth(env: Env) {
  if (!authInstance) {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new Error('Missing GitHub OAuth credentials in environment variables');
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Missing Google OAuth credentials in environment variables');
    }
    authInstance = betterAuth({
      database: drizzleAdapter(getDbClient(env), {
        provider: "sqlite",
      }),
      socialProviders: {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/github`
        },
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          redirectURI: `${env.BETTER_AUTH_URL}/api/auth/callback/google`
        }
      },
      plugins: [
        oAuthProxy({
          currentURL: env.CF_PAGES_URL || env.BETTER_AUTH_URL,
          productionURL: env.BETTER_AUTH_URL,
        }),
        oneTap()
      ]
    });
  }
  return authInstance;
}
