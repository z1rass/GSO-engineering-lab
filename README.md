# GSO Engineering Lab

A small public site for Events and Ideas. Visitors can browse Events, suggest Ideas, and vote for Ideas without signing in. The admin opens directly at `/admin` and uses a password. The public navigation does not link to it. Admins can create and edit Events, set a classroom such as `C001` or `B102`, select one of six covers or upload a JPG/PNG/WebP image, and edit or remove Ideas and Events.

## Local setup

Use Node 24 and Docker Compose. Copy `.env.example` to `.env.local` and set a unique `ADMIN_PASSWORD` (at least 16 characters) and `ADMIN_SESSION_SECRET` (at least 32 characters). Keep the file private. Then run:

```sh
docker compose up --build -d --remove-orphans
```

Open `http://localhost:5173` for the site and `http://localhost:5173/admin` for the admin. Events, Ideas, votes and uploaded covers live in `data/lab.sqlite`; the API creates an empty database automatically when the file does not exist. The admin password never appears in frontend code. The admin route being absent from navigation is only discoverability, while the password and session protect writes.

For local development outside Compose, run `npm ci`, `npm run dev:api`, and `npm run dev:web`. The API defaults to port 3001 and Vite to port 5173. `SQLITE_PATH` selects another database file if needed. Set `AUTH_BASE_URL` to the exact browser origin if different. To add another trusted origin, use `AUTH_ADDITIONAL_ORIGINS` as a comma-separated list.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run test:e2e
```

The API tests use an in-memory SQLite database. Browser tests use `test-results/public-site.sqlite`, separate from the live database.

## Data and scope

Events, Ideas, votes and covers persist in SQLite. A browser can give or remove one vote per Idea; clearing its cookie allows a new vote, so totals are not verified people counts. Public idea writes have origin checks and rate limits. Admin removal hides content instead of destroying records. Uploaded event covers are limited to 2 MB and stored in the database. To back up the site, stop the API, copy `data/lab.sqlite`, then start the API again. The former PostgreSQL volume is not needed by this version and is not removed by Compose; older member and Ops records remain there, outside the new database. See [ADR 0003](docs/adr/0003-open-ideas-and-direct-event-publishing.md) and [ADR 0004](docs/adr/0004-sqlite-for-public-launch.md).
