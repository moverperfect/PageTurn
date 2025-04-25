import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Singleton database client
let db: ReturnType<typeof createDrizzleClient>;

/**
 * Creates and returns a Drizzle ORM client configured for the Cloudflare D1 database using the provided environment.
 *
 * @param env - The environment object containing the D1 database binding.
 * @returns A Drizzle ORM client instance connected to the D1 database.
 */
export function createDrizzleClient(env: Env): ReturnType<typeof drizzle> | ReturnType<typeof drizzleSqlite> {
  console.log('Using D1 database in Cloudflare environment');
  // Use D1 database in Cloudflare environment
  return drizzle(env.DB, { schema });
}

/**
 * Returns the singleton Drizzle ORM client instance for the application.
 *
 * If the client has not been initialized, it creates a new instance using the provided environment and caches it for future use.
 *
 * @param env - The environment object containing the database configuration.
 * @returns The singleton Drizzle ORM client instance.
 */
export function getDbClient(env: Env) {
  if (!db) {
    db = createDrizzleClient(env);
  }
  return db;
} 
