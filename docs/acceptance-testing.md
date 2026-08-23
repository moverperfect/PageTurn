# Acceptance testing

The acceptance suite is PageTurn's behavioral safety net at the deployed
application boundary. It exercises the built Astro Worker over HTTP — real
routing, middleware, authentication, and D1 access — rather than importing
application modules into the test process.

## Running the suite

```sh
pnpm run test:acceptance
```

That single command, locally and in CI:

1. Builds the application (`astro check && astro build`), so the existing
   build/type-check verification runs alongside the suite.
2. Provisions an isolated local D1 database in a temp directory and applies
   every migration in `migrations/`.
3. Boots the built Worker with `wrangler dev` on a free port, configured for
   the local origin.
4. Runs the Vitest specs in `tests/acceptance/` against the live HTTP
   boundary.
5. Stops the Worker and deletes the temp database, whether or not the tests
   pass.

Nothing persists between runs and no shared or remote state is touched, so the
command is safe for unattended CI execution (see
`.github/workflows/ci.yml`).

While iterating on tests only, skip the rebuild with:

```sh
ACCEPTANCE_SKIP_BUILD=1 pnpm run test:acceptance
```

## How fixtures authenticate

Production sign-in is social OAuth only (GitHub/Google), which an unattended
suite cannot drive. The suite therefore uses better-auth's credential
endpoints as its seam: `src/lib/auth.ts` enables `emailAndPassword` **only**
when the `ACCEPTANCE_TEST_AUTH` variable is `"true"`. The harness sets that
variable on the local Worker; deployed configuration leaves it empty, so the
endpoints do not exist in production or previews.

Everything past sign-up is the real authentication contract: fixtures receive
genuine better-auth session cookies over HTTP, and every request is validated
by the production middleware and session store. The administrator fixture is
created the same way, promoted to the `admin` role, and then signs in again so
its session carries the role.

## Rules for writing specs

- Assert only on HTTP responses and rendered pages. Tests must not import
  application code, inspect tables, or call ORM helpers.
- Direct database access is allowed **only** inside
  `tests/acceptance/helpers.ts`, and only for fixture setup (e.g. promoting an
  administrator) and cleanup (removing fixture Readers).
- Create a fresh fixture per spec file with `signUpFixture(...)` and remove it
  in `afterAll` with `deleteFixtures(...)`. Fixture emails are randomized, so
  specs stay independent.
- Use `request(path, { cookie })` from the helpers; it never follows
  redirects, so the authentication boundary itself is assertable.
