/**
 * Fixture and HTTP helpers for the acceptance suite.
 *
 * All assertions in the suite go through the deployed HTTP boundary. Direct
 * database access is confined to this file and used only for fixture setup
 * (promoting a fixture to administrator) and cleanup (removing fixture
 * Readers), never for assertions.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const baseURL = requiredEnv('ACCEPTANCE_BASE_URL');
const persistDir = requiredEnv('ACCEPTANCE_PERSIST_DIR');

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run the suite via \`pnpm run test:acceptance\`.`
    );
  }
  return value;
}

export interface RequestOptions {
  method?: string;
  cookie?: string;
  body?: unknown;
}

/**
 * Sends a request to the running worker. Redirects are never followed so the
 * suite can assert on the authentication boundary itself.
 */
export async function request(
  pathname: string,
  options: RequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = { Origin: baseURL };
  if (options.cookie) {
    headers.Cookie = options.cookie;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(`${baseURL}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
  });
}

export interface Fixture {
  name: string;
  email: string;
  password: string;
  /** Cookie header value carrying the real better-auth session. */
  cookie: string;
}

/**
 * Registers a fixture through the application's real authentication contract
 * (better-auth's credential endpoint, enabled only under ACCEPTANCE_TEST_AUTH)
 * and returns the session cookie issued by the application.
 */
export async function signUpFixture(prefix: string): Promise<Fixture> {
  const name = `${prefix} fixture`;
  const email = `${prefix}-${crypto.randomUUID()}@acceptance.invalid`;
  const password = `pw-${crypto.randomUUID()}`;
  const cookie = await credentialRequest('/api/auth/sign-up/email', {
    name,
    email,
    password,
  });
  return { name, email, password, cookie };
}

/**
 * Signs an existing fixture in through the real credential endpoint and
 * returns a fresh session cookie.
 */
export async function signInFixture(fixture: Fixture): Promise<string> {
  return credentialRequest('/api/auth/sign-in/email', {
    email: fixture.email,
    password: fixture.password,
  });
}

async function credentialRequest(
  pathname: string,
  body: Record<string, string>
): Promise<string> {
  const response = await request(pathname, { method: 'POST', body });
  if (!response.ok) {
    throw new Error(
      `${pathname} failed with ${response.status}: ${await response.text()}`
    );
  }
  return sessionCookie(response);
}

function sessionCookie(response: Response): string {
  const pairs = response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0].trim())
    // Keep only cookies that carry a value; a bare `name=` is a deletion.
    .filter((pair) => /=.+/.test(pair));
  if (pairs.length === 0) {
    throw new Error('Response did not set a session cookie');
  }
  return pairs.join('; ');
}

function openDatabase(): DatabaseSync {
  const d1Dir = path.join(persistDir, 'v3', 'd1', 'miniflare-D1DatabaseObject');
  const file = readdirSync(d1Dir).find((entry) => entry.endsWith('.sqlite'));
  if (!file) {
    throw new Error(`No D1 database file found under ${d1Dir}`);
  }
  const db = new DatabaseSync(path.join(d1Dir, file));
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

/** Fixture setup only: grants the administrator role to a fixture user. */
export function promoteToAdmin(fixture: Fixture): void {
  const db = openDatabase();
  try {
    const result = db
      .prepare("UPDATE user SET role = 'admin' WHERE email = ?")
      .run(fixture.email);
    if (Number(result.changes) !== 1) {
      throw new Error(`Expected to promote exactly one user, got ${result.changes}`);
    }
  } finally {
    db.close();
  }
}

/** Fixture cleanup only: removes fixture Readers and their dependent records. */
export function deleteFixtures(fixtures: Fixture[]): void {
  if (fixtures.length === 0) {
    return;
  }
  const db = openDatabase();
  try {
    // The deployed schema's user_id foreign keys predate ON DELETE CASCADE,
    // so dependent rows are removed explicitly, leaves first.
    const statements = [
      'DELETE FROM reading_sessions WHERE user_id IN (SELECT id FROM user WHERE email = ?)',
      'DELETE FROM books WHERE user_id IN (SELECT id FROM user WHERE email = ?)',
      'DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email = ?)',
      'DELETE FROM account WHERE user_id IN (SELECT id FROM user WHERE email = ?)',
      'DELETE FROM user WHERE email = ?',
    ].map((sql) => db.prepare(sql));
    for (const fixture of fixtures) {
      for (const statement of statements) {
        statement.run(fixture.email);
      }
    }
  } finally {
    db.close();
  }
}
