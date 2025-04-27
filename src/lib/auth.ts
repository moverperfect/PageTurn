import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDbClient } from "./db-client";

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
});

/**
 * Retrieves the singleton authentication client configured with the provided environment.
 *
 * Initializes the authentication instance with a Drizzle adapter and GitHub OAuth credentials from {@link env} if it has not been created yet. Subsequent calls return the same instance.
 *
 * @param env - Environment object containing GitHub OAuth credentials and database configuration.
 * @returns The singleton authentication client instance.
 *
 * @throws {Error} If {@link env.GITHUB_CLIENT_ID} or {@link env.GITHUB_CLIENT_SECRET} is missing.
 */
export function getAuth(env: Env) {
  if (!authInstance) {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      throw new Error('Missing GitHub OAuth credentials in environment variables');
    }
    authInstance = betterAuth({
      database: drizzleAdapter(getDbClient(env), {
        provider: "sqlite",
      }),
      socialProviders: {
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
        },
      },
    });
  }
  return authInstance;
}
