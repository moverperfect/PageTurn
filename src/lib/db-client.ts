import { drizzle } from 'drizzle-orm/d1';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Singleton database client
let db: ReturnType<typeof createDrizzleClient>;

export function createDrizzleClient(env: Env): ReturnType<typeof drizzle> | ReturnType<typeof drizzleSqlite> {
  console.log('Using D1 database in Cloudflare environment');
  // Use D1 database in Cloudflare environment
  return drizzle(env.DB, { schema });
}

// Function to get the client throughout the application
export function getDbClient(env: Env) {
  if (!db) {
    db = createDrizzleClient(env);
  }
  return db;
} 
