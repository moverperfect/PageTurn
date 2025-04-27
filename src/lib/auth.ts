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
 * Returns the singleton auth instance for the application.
 * 
 * If the instance has not been initialized, it creates a new instance using the provided 
 * environment and caches it for future use.
 * 
 * @param env - The environment object containing the database configuration
 * @returns The singleton auth instance
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
