# GSO Engineering Lab

A technical community at GSO Berufskolleg: discover ideas, join activities and take responsibility. Implemented slices: public homepage and current Season, school-email magic-link login, a minimal editable profile initial/normal Ops appointments, public Ideas, and Projects with ownership. German and English interface copy; PostgreSQL-backed data.

The approved scope is in [the product specification](docs/mvp-product-spec.md); vocabulary is in [CONTEXT.md](CONTEXT.md). Events, Interested, team membership and other Ops workflows belong to later tickets.

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

Compose is a **local development** setup with disposable local credentials and development servers. Production HTTPS, SMTP provisioning, hosting, backups and operator procedures belong to later tickets. For container code changes, rebuild; bind-mounted hot reload is not configured.

For host-based development use Node.js **24** (the pinned version is recorded in `.node-version`) and its bundled npm:

```sh
docker compose up -d --wait db mailpit
npm ci
npm run db:migrate
npm run db:seed
npm run dev:api
# In a second terminal:
npm run dev:web
```

Do not run the host servers and Compose web/API simultaneously: they use the same ports. `docker compose stop web api` frees the ports while keeping local data. `docker compose down` stops the stack and preserves the named development volume.

## Local login and profile

Open `/login`, enter a name and any **fictional** address on the exact `@gso.schule.koeln` domain, for example `local-demo@gso.schule.koeln`. Open Mailpit at **http://localhost:8025** and follow the delivered link. Mailpit captures SMTP locally; it does not deliver to the school. Never expose Mailpit publicly or use it for production. No seed account bypasses email verification.

The `/profile` page (`/me` is an alias) edits name, optional education programme, year and comma-separated interests. Email is read-only and only returned by authenticated `/api/me`. Name is required when requesting a link; a subsequent login does not overwrite an existing profile. Language selection persists in this browser.

Better Auth owns token/session security; tokens are hashed, single-use and expire after 15 minutes. Sessions last 7 days with no sliding renewal; logout revokes them. Session cookies are HttpOnly and SameSite=Lax; HTTPS uses Secure cookies. Mutations require the configured exact Origin. Only the magic-link request/verification and logout endpoints are exposed from the auth library. General user mutations, password registration and email changes are unavailable.

A persisted `affiliation` is separate from User identity. `ALUMNI` preserves the account but cannot access Member endpoints or sign in. There is no alumni onboarding or automatic graduation detection in this slice. Expired sessions require another school email confirmation.

Rate limiting is stored in PostgreSQL: 5 login-link requests per minute per direct peer, 100 other auth requests per minute. Client-supplied forwarding headers are ignored. In local Compose the Vite proxy is one peer, so users share that limit. Before public deployment, configure the actual trusted proxy boundary and tune limits for the school's shared network; never trust arbitrary forwarded headers.

## Ops appointments

After a Member verifies their email, a server admin can appoint the first Ops using the documented [bootstrap procedure](docs/operations/ops-appointments.md). Bootstrap requires external sponsor confirmation and refuses to run if any Ops already exist. The role change and its attribution are persisted atomically.

Existing Ops open `/profile` → **Manage Ops** (`/ops`) to appoint other verified Members and see the latest 100 role changes. Access is checked server-side, and private email addresses are not included in the directory. Recovery and role removal are outside this slice.

## Ideas

`/ideas` lists suggestions newest first, `/ideas/:id` shows a public idea, and `/ideas/new` lets a signed-in Member publish a title (up to 120 characters) and description (up to 5,000 characters). These are plain text and remain in the author's language when the interface changes. Publishing is immediate: it creates no Activity, ownership or approval workflow.

Visitors receive only the idea ID, title, description and timestamps. Authorship is stored privately for future moderation and is excluded from all public responses. Do not put private contact details in the published text. Only Ops can edit through `/ideas/:id/edit`; even the author has no editing permission unless they are Ops. Server permissions and CSRF checks apply independently of the UI.

API: `GET /api/ideas`, `GET /api/ideas/:id`, `POST /api/ideas`, `PATCH /api/ideas/:id`. Creation and editing accept only `title` and `description`. The list is intentionally simple for the small MVP community; pagination, Interested and moderation are separate work.

## Projects

`/projects` lists Projects; `/projects/new` creates one, `/projects/:id` shows it and `/projects/:id/edit` edits its content. A Member becomes the single Activity Owner immediately; no Ops approval is required. New Projects start in PLANNING; owner or Ops can move them to ACTIVE with **Start work**. Joining, completion and ownership transfer belong to later tickets.

A Project can be independent or based on an Idea. The Idea page links to the creation form with that Idea selected. Multiple Projects may reference the same Idea without changing its author or assigning them responsibility.

Public fields: title, goal, description, tech stack, repository/documentation URLs, materials, status, source Idea and timestamps. Only currently authenticated Members receive the owner's identity, internal instructions and manually entered Discord URL. No email is returned. Public and authenticated responses use `Cache-Control: no-store`. Public text/links should not contain secrets; the form labels the separate Members-only section.

`activities` stores shared Activity data and a required single owner; `project_details` stores Project-specific fields. Creation and content updates are transactional. Links accept only HTTP(S), without embedded credentials. Text limits: title 120, goal 1,000, description/materials/internal instructions 5,000 each; up to 30 tech-stack entries of 50 characters. The JSON request ceiling is 128 KiB to accommodate multilingual content across these fields.

API: `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects`, `PATCH /api/projects/:id`, `POST /api/projects/:id/start`. POST can include optional `ideaId`; PATCH replaces the editable content fields and cannot change the owner, source Idea or status. `/start` accepts `{}` and is idempotent for an already ACTIVE Project. Lists use public fields even for Members; open a Project to see its internal information.

## Environment variables

All local defaults work without a configuration file. `.env.example` documents them; host commands read exported environment variables, not an automatically loaded `.env` file.

| Variable | Purpose | Local default |
| --- | --- | --- |
| `DATABASE_URL` | API, migrations, seed | `postgres://lab:lab_local@127.0.0.1:55432/lab` |
| `TEST_DATABASE_URL` | Isolated API/browser test database | `postgres://lab:lab_local@127.0.0.1:55433/lab_test` |
| `AUTH_BASE_URL` | Exact public origin used in email links and CSRF checks | `http://localhost:5173` |
| `AUTH_SECRET` | Auth signing secret; production requires 32+ random characters | Disposable local secret |
| `SMTP_HOST` / `SMTP_PORT` | SMTP delivery | `127.0.0.1` / `1025` |
| `SMTP_FROM` | Sender address | `GSO engineering lab <lab@localhost>` |
| `SMTP_SECURE` | Implicit TLS (usually port 465) | `false` |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP credentials if required | Unset |
| `PORT` | API listen port | `3001` |
| `API_PROXY_TARGET` | Vite API destination | `http://127.0.0.1:3001` |

Production refuses to start without an explicit HTTPS origin, signing secret, SMTP host and sender; SMTP requires TLS in production. This is not a complete production deployment.

Compose supplies container-specific addresses. Keep deployment credentials outside version control.

## Database migrations

Edit the Drizzle schema, then run `npm run db:generate`. Review the generated SQL and commit the migration with its metadata. Apply migrations with `npm run db:migrate`; seed local demo data with `npm run db:seed`. Seeding is explicit and is not a production startup operation.

The database enforces a single active Season, unique Season numbers and ordered dates. The initial slice has no write endpoint; Season administration is a later ticket.

## Tests and checks

The agreed testing seams are the public HTTP API with real PostgreSQL, SMTP delivery through Mailpit, and browser journeys (email → login → profile → logout). Test assertions observe HTTP/UI behavior; SQL is used only to arrange fixtures. Test commands require a database whose name ends in `_test` and modify its Season, auth, profile, Ideas, Activities and Ops fixtures (including resetting test roles and clearing the role journal). Never point them at valuable data. API and browser suites run sequentially because they share the dedicated test database.

```sh
docker compose --profile test up -d --wait test-db mailpit
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
