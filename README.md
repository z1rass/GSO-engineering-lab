# GSO Engineering Lab

A technical community at GSO Berufskolleg: discover ideas, join activities and take responsibility. The first implemented slice is the public homepage and current Season, backed by PostgreSQL, with German and English interface copy.

The approved scope is in [the product specification](docs/mvp-product-spec.md); vocabulary is in [CONTEXT.md](CONTEXT.md). Authentication, Ideas, Events, Projects and Ops management belong to later tickets. The homepage intentionally has no non-working sign-up buttons or invented activity counts.

## Architecture

React + Vite + React Router + Tailwind → same-origin REST API → Express + Drizzle → PostgreSQL. TypeScript throughout, with npm workspaces. The Vite development proxy forwards API requests, including within Compose. No microservices or external fonts are required.

## Requirements and local setup

With Docker Engine and Docker Compose:

```sh
git clone git@github.com:z1rass/GSO-engineering-lab.git
cd GSO-engineering-lab
docker compose up --build
```

Open **http://localhost:5173**. Compose waits for PostgreSQL, applies migrations and inserts a local demonstration Season before starting the API and frontend. Subsequent seeds preserve existing rows. Database ports are bound to loopback.

The local seed explicitly marks Season 0 as ACTIVE so the screen can be explored before its November 2026–January 2027 dates. Current Season is selected by ACTIVE status, not the machine's date. Only one Season may be ACTIVE; unpublished and past Seasons are not fallback results. With no ACTIVE Season the API returns `{"season":null}` and the page shows an empty state. User-authored content stays in its original language when the interface changes.

Compose is a **local development** setup with disposable local credentials and development servers. Production HTTPS, email, hosting, backups and operator procedures belong to later tickets. For container code changes, rebuild; bind-mounted hot reload is not configured.

For host-based development use Node.js **24** (the pinned version is recorded in `.node-version`) and its bundled npm:

```sh
docker compose up -d --wait db
npm ci
npm run db:migrate
npm run db:seed
npm run dev:api
# In a second terminal:
npm run dev:web
```

Do not run the host servers and Compose web/API simultaneously: they use the same ports. `docker compose stop web api` frees the ports while keeping local data. `docker compose down` stops the stack and preserves the named development volume.

## Environment variables

All local defaults work without a configuration file. `.env.example` documents them; host commands read exported environment variables, not an automatically loaded `.env` file.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | API, migrations, seed | `postgres://lab:lab_local@127.0.0.1:55432/lab` |
| `TEST_DATABASE_URL` | Isolated API/browser test database | `postgres://lab:lab_local@127.0.0.1:55433/lab_test` |
| `PORT` | API listen port | `3001` |
| `API_PROXY_TARGET` | Vite API destination | `http://127.0.0.1:3001` |

Compose supplies container-specific addresses. Keep deployment credentials outside version control.

## Database migrations

Edit the Drizzle schema, then run `npm run db:generate`. Review the generated SQL and commit the migration with its metadata. Apply migrations with `npm run db:migrate`; seed local demo data with `npm run db:seed`. Seeding is explicit and is not a production startup operation.

The database enforces a single active Season, unique Season numbers and ordered dates. The initial slice has no write endpoint; Season administration is a later ticket.

## Tests and checks

The agreed testing seams are the public HTTP API with real PostgreSQL and a small set of browser journeys. Test assertions observe HTTP/UI behavior; SQL is used only to arrange fixtures. Test commands require a database whose name ends in `_test` and clear its Season rows. Never point them at valuable data. API and browser suites run sequentially because they share the dedicated test database.

```sh
docker compose --profile test up -d --wait test-db
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests migrate their own database and can run without running API tests first. They wait for `/api/health`, a process liveness endpoint independent of the database schema. Compose checks `/api/seasons/current` after migrations for application readiness.

Browser tests start their own API and frontend; stop other processes on ports 3001 and 5173 first. On a clean Linux machine, `npx playwright install --with-deps chromium` also installs the browser's system dependencies. CI performs that step.

For a single API file: `npm run test --workspace @gso/api -- tests/seasons.test.ts`. For one browser scenario: `npm run test:e2e -- --grep 'empty state'`.

## Contribution and pull request flow

Use an issue → focused branch → pull request → review → merge. Work on tickets only once their blocking issues are complete. GitHub Issues is the configured tracker for `z1rass/GSO-engineering-lab`; local ticket drafts are not published issues.

Include meaningful behavior tests for changes and run the checks above. CI runs on pushes and pull requests. Maintainers must make the `verify` check required in GitHub branch protection/rulesets to enforce the merge gate; the workflow alone does not configure repository policy.

Keep the approved domain vocabulary and scope. German and English interface copy must be updated together; community-authored content is not automatically translated. Avoid exposing personal data on public endpoints.
