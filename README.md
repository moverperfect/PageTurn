# PageTurn

PageTurn is a modern reading tracker application that helps you monitor your reading progress, manage your book collection, and analyze your reading habits.

## Features

- **Book Library Management**: Catalog your books with detailed information
- **Reading Session Tracking**: Track reading sessions with precise HH:MM:SS duration
- **Reading Statistics**: Analyze your reading habits with detailed statistics
- **Progress Tracking**: Monitor your reading progress and estimated completion dates
- **Data Import**: Import books and reading sessions from Google Sheets

## Tech Stack

- [Astro](https://astro.build) - The web framework for content-driven websites
- [TailwindCSS](https://tailwindcss.com) - A utility-first CSS framework
- [Cloudflare Workers](https://developers.cloudflare.com/workers/) - For hosting and deployment

## Development

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `pnpm install`    | Installs dependencies                        |
| `pnpm dev`        | Starts local dev server at `localhost:4321`  |
| `pnpm build`      | Type-check and build the production Worker   |
| `pnpm preview`    | Preview the Worker locally with workerd      |
| `pnpm run deploy` | Build, migrate production D1, then deploy    |

## Auth Preview Configuration

Workers preview URLs do not provide `CF_PAGES_URL`. Configure preview auth explicitly when needed:

- `AUTH_PREVIEW_URL`: the current preview origin used by Better Auth's OAuth proxy; leave empty for dynamic Workers preview hosts
- `AUTH_TRUSTED_ORIGINS`: comma-separated extra allowed origins, including `https://pageturn.moverperfect.com`
- `WORKERS_PREVIEW_HOST_SUFFIX`: workers.dev host suffix for branch previews, such as `-pageturn.moverperfect.workers.dev`
- `OAUTH_PROXY_SECRET`: Cloudflare secret shared by production and preview deployments so Better Auth can complete proxied OAuth callbacks

## Database Management

| Command                      | Action                                         |
| :--------------------------- | :--------------------------------------------- |
| `pnpm db:generate`           | Generate database migration files              |
| `pnpm db:migrate:local`      | Apply migrations to local development database |
| `pnpm db:migrate:prod`       | Apply migrations to production database        |

## Deployment and migrations

Cloudflare Workers Builds deploys every push to `main`, running
`pnpm run deploy:production` once the build finishes. That script applies any
pending migrations in `migrations/` to the production D1 database
(`page-turn`), then runs `wrangler deploy`. If a migration fails, the script
stops before `wrangler deploy`, so the new Worker version never goes live; the
migrations before the failed one stay applied. With nothing pending, it goes
straight to the deploy. `pnpm run deploy` builds, then does the same from a
local checkout without a confirmation prompt.

This depends on settings in the Cloudflare dashboard, under Workers & Pages →
`pageturn` → Settings → Build:

| Setting        | Value                                                                                       |
| :------------- | :------------------------------------------------------------------------------------------ |
| Build command  | `pnpm run build`, which writes the `dist/` that the deploy command uploads                  |
| Deploy command | `pnpm run deploy:production`                                                                |
| API token      | A user API token with **Account · D1 · Edit** added; the default Workers Builds token lacks it |

### Keep migrations backward-compatible

Migrations run before the new code deploys, so for a short time the old Worker
version runs against the new schema. After every migration, each table and
column the production code uses must still exist in a shape it can read and
write. Adding tables, columns and indexes is safe, and so is a table rebuild
that keeps the same columns (as in `0006_user_fk_cascade.sql`). Dropping or
renaming a structure the code still uses is a contract step: it ships in a
later deploy, after the code that stops using that structure is live.

### Branch previews

Workers Builds uploads preview versions of other branches without migrating.
`wrangler.jsonc` binds `DB` only to production `page-turn`, so previews read
and write production data, and a branch's unmerged migrations must never be
applied to it. Test schema changes with `pnpm db:migrate:local` and
`pnpm test:acceptance`.

## License

MIT
