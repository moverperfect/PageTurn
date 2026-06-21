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
| `pnpm deploy`     | Deploy to Cloudflare Workers                 |

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
| `pnpm db:migrate:preview`    | Apply migrations to preview environment        |
| `pnpm db:studio:local`       | Open Drizzle Studio for local database         |
| `pnpm db:studio:preview`     | Open Drizzle Studio for preview database       |
| `pnpm db:studio:prod`        | Open Drizzle Studio for production database    |

## License

MIT
