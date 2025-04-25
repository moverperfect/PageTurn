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
- [Cloudflare Pages](https://pages.cloudflare.com) - For hosting and deployment

## Development

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Installs dependencies                        |
| `npm run dev`     | Starts local dev server at `localhost:4321`  |
| `npm run build`   | Build the production site to `./dist/`       |
| `npm run preview` | Preview your build locally, before deploying |
| `npm run deploy`  | Deploy to Cloudflare Pages                   |

## Database Management

| Command                      | Action                                         |
| :--------------------------- | :--------------------------------------------- |
| `npm run db:generate`        | Generate database migration files              |
| `npm run db:migrate:local`   | Apply migrations to local development database |
| `npm run db:migrate:prod`    | Apply migrations to production database        |
| `npm run db:migrate:preview` | Apply migrations to preview environment        |
| `npm run db:studio:local`    | Open Drizzle Studio for local database         |
| `npm run db:studio:preview`  | Open Drizzle Studio for preview database       |
| `npm run db:studio:prod`     | Open Drizzle Studio for production database    |

## License

MIT
