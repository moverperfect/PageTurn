# AGENTS.md

Guidance for AI coding assistants working on the PageTurn codebase.

## Project Overview

**PageTurn** is a modern reading tracker application that helps users monitor reading progress, manage book collections, and analyze reading habits. It is built for deployment on Cloudflare Pages.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Astro](https://astro.build) | Web framework (server output mode) |
| [TailwindCSS](https://tailwindcss.com) | Styling |
| [Cloudflare Pages](https://pages.cloudflare.com) | Hosting and deployment |
| [Drizzle ORM](https://orm.drizzle.team) | Database access (Cloudflare D1 / SQLite) |
| [better-auth](https://better-auth.com) | Authentication |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Cloudflare tooling and local dev |

## Project Structure

```
src/
├── lib/              # Core logic and shared utilities
│   ├── auth.ts       # better-auth configuration
│   ├── auth-client.ts
│   ├── db.ts         # Database operations (CRUD for books, reading sessions)
│   ├── db-client.ts  # D1 client setup
│   └── schema.ts     # Drizzle schema (books, readingSessions, user, session, account)
├── pages/
│   ├── api/          # API routes (Astro APIRoute handlers)
│   │   ├── auth/     # Auth proxy (better-auth)
│   │   ├── books/    # Books CRUD
│   │   ├── reading-sessions/
│   │   └── b2/       # B2 storage integration
│   └── *.astro       # UI pages
├── layouts/          # Astro layouts
├── styles/           # Global CSS
├── utils/            # Utility functions
├── types/             # TypeScript declarations
├── middleware.ts     # Astro middleware
migrations/            # Drizzle migrations
```

## Key Conventions

### API Routes

- Use `import type { APIRoute } from 'astro'`.
- Access the current user via `locals.session?.User?.id`.
- Access Cloudflare env (D1, secrets) via `locals.runtime.env`.
- Return `Response` with appropriate status and `Content-Type: application/json` for JSON.
- Check authentication before protected operations; return 401 if unauthenticated.

### Database

- All DB logic lives in `src/lib/db.ts`.
- Use `getDbClient(env)` from `db-client.ts`; pass `Env` (from `locals.runtime.env`) into all db functions.
- Schema and types are in `src/lib/schema.ts`.
- Use `uuid` (v4) for new IDs when inserting records.
- Add indexes for common query patterns (see existing schema).

### Authentication

- better-auth handles auth; session data is in `locals.session`.
- API routes should verify `locals.session?.User?.id` for protected endpoints.

### Types

- `Env` is the Cloudflare environment type (D1 binding, etc.).
- Book and ReadingSession types are exported from `schema.ts`.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm run dev` | Local dev at `localhost:4321` |
| `pnpm run build` | Build for production |
| `pnpm run db:generate` | Generate Drizzle migrations |
| `pnpm run db:migrate:local` | Apply migrations to local D1 |
| `pnpm run db:migrate:prod` | Apply migrations to production |

## Notes for Agents

- Use **pnpm** as the package manager.
- Node.js >= 18 and pnpm >= 10.10.0 are required.
- Database is SQLite (Cloudflare D1) with snake_case columns; Drizzle handles mapping (e.g. `pageCount` → `page_count`).
- When adding new DB queries, add them to `src/lib/db.ts` and keep API routes thin.
- API routes follow REST-style patterns; use appropriate HTTP methods (GET, POST, PUT, PATCH, DELETE).
- Avoid hardcoding secrets; use environment variables / wrangler secrets.
