# GSO Engineering Lab

[![CI](https://github.com/z1rass/GSO-engineering-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/z1rass/GSO-engineering-lab/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-24.18-339933?logo=node.js&logoColor=white)](.node-version)

Build things. Learn together. Run your own ideas.

GSO Engineering Lab is a student-led technical community for people who want to turn ideas into projects, events and useful results. The platform supports a simple loop: **Discover → Join → Own**. It is deliberately complementary to Discord and GitHub: the site keeps ownership, structure, history and outcomes visible.

The interface is German-first with English available. Community-authored content stays in its original language. The app is built as a responsive web application with a TypeScript modular monolith and PostgreSQL.

## Project status

The repository contains a working MVP foundation for Season 0: Season management and Project continuation, magic-link Member access, Ideas, Events, Projects, Interested, Project membership, room requests, Going, Tasks, ownership transfer, completion/cancellation with past Activity pages, the personal My Activity overview, private Club Network contacts, and moderation. Production hosting, backups, alumni access and the remaining Ops workflows are intentionally still planned.

Product decisions live in the [MVP specification](docs/mvp-product-spec.md), domain vocabulary in [CONTEXT.md](CONTEXT.md), and implementation slices in [ticket drafts](docs/ticket-drafts). The [contribution guide](CONTRIBUTING.md) explains how to work on the project.

## Contents

- [Quick start with Docker](#quick-start-with-docker)
- [Local development](#local-development)
- [How the app fits together](#how-the-app-fits-together)
- [Product areas](#ideas)
- [Environment variables](#environment-variables)
- [Database migrations](#database-migrations)
- [Tests and checks](#tests-and-checks)
- [Contributing](CONTRIBUTING.md)

## How the app fits together

React + Vite + React Router + Tailwind → same-origin REST API → Express + Drizzle → PostgreSQL. TypeScript throughout, with npm workspaces. The Vite development proxy forwards API requests, including within Compose. No microservices or external fonts are required.

## Quick start with Docker

With Docker Engine and Docker Compose:

```sh
git clone git@github.com:z1rass/GSO-engineering-lab.git
cd GSO-engineering-lab
docker compose up --build
```

Open **http://localhost:5173**. Compose waits for PostgreSQL, applies migrations and inserts a local demonstration Season before starting the API and frontend. Subsequent seeds preserve existing rows. Database ports are bound to loopback.

The local seed explicitly marks Season 0 as ACTIVE so the screen can be explored before its November 2026–January 2027 dates. Current Season is selected by ACTIVE status, not the machine's date. Only one Season may be ACTIVE; unpublished and past Seasons are not fallback results. With no ACTIVE Season the API returns `{"season":null}` and the page shows an empty state. User-authored content stays in its original language when the interface changes.

Compose is a **local development** setup with disposable local credentials and development servers. Production HTTPS, SMTP provisioning, hosting, backups and operator procedures belong to later tickets. For container code changes, rebuild; bind-mounted hot reload is not configured.

## Local development

For host-based development use Node.js **24.18.0** (the pinned version is recorded in `.node-version`) and its bundled npm:

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

The product areas below follow the same model: public discovery, deliberate participation, and explicit responsibility.

## Ideas

`/ideas` lists suggestions newest first, `/ideas/:id` shows a public idea, and `/ideas/new` lets a signed-in Member publish a title (up to 120 characters) and description (up to 5,000 characters). These are plain text and remain in the author's language when the interface changes. Publishing is immediate: it creates no Activity, ownership or approval workflow.

Visitors receive only the idea ID, title, description and timestamps. Authorship is stored privately for future moderation and is excluded from all public responses. Do not put private contact details in the published text. Only Ops can edit through `/ideas/:id/edit`; even the author has no editing permission unless they are Ops. Server permissions and CSRF checks apply independently of the UI.

API: `GET /api/ideas`, `GET /api/ideas/:id`, `POST /api/ideas`, `PATCH /api/ideas/:id`. Creation and editing accept only `title` and `description`. The list is intentionally simple for the small MVP community; pagination remains deferred. Ops manage visibility through the moderation screen described below.

## Projects

`/projects` lists Projects; `/projects/new` creates one, `/projects/:id` shows it and `/projects/:id/edit` edits its content. A Member becomes the single Activity Owner immediately; no Ops approval is required. New Projects start in PLANNING; owner or Ops can move them to ACTIVE with **Start work**. Completed and cancelled Projects remain available under Past.

A Project can be independent or based on an Idea. The Idea page links to the creation form with that Idea selected. Multiple Projects may reference the same Idea without changing its author or assigning them responsibility.

Public fields: title, goal, description, tech stack, repository/documentation URLs, materials, status, source Idea and timestamps. Only currently authenticated Members receive the owner's identity, internal instructions and manually entered Discord URL. No email is returned. Public and authenticated responses use `Cache-Control: no-store`. Public text/links should not contain secrets; the form labels the separate Members-only section.

`activities` stores shared Activity data and a required single owner; `project_details` stores Project-specific fields. Creation and content updates are transactional. Links accept only HTTP(S), without embedded credentials. Text limits: title 120, goal 1,000, description/materials/internal instructions 5,000 each; up to 30 tech-stack entries of 50 characters. The JSON request ceiling is 128 KiB to accommodate multilingual content across these fields.

API: `GET /api/projects`, `GET /api/projects/:id`, `POST /api/projects`, `PATCH /api/projects/:id`, `POST /api/projects/:id/start`. POST can include optional `ideaId`; PATCH replaces the editable content fields and cannot change the owner, source Idea or status. `/start` accepts `{}` and is idempotent for an already ACTIVE Project. Lists use public fields even for Members; open a Project to see its internal information.

## Events

`/events` lists Events; `/events/new` creates one, `/events/:id` shows it and `/events/:id/edit` edits it. Members can create independent Events or start from an Idea; multiple Events may share the same Idea. The creator immediately owns the Event in PLANNING, without Ops approval. Only the owner and Ops can edit.

Planned date, end date, start/end times and general location are optional. Dates are ISO calendar dates and times are `HH:mm` wall times in **Europe/Berlin**, not browser-local or UTC timestamps. An omitted end date means the same day when comparing known times. A supplied end date requires a start date and cannot precede it; on the same day the end time must follow the start. Multi-day Events may end at an earlier clock time on the later day. Unknown fields stay explicit in DE/EN, and plans are labelled unconfirmed until the owner opens registration. Room requests are handled separately below; entering a room does not confirm a reservation.

Public fields include category, description, tentative schedule/general location, materials and repository link. Exact room, access instructions, owner identity and the manually entered Discord link are returned only to current Members on the detail endpoint. Lists always use public fields. No attendee identities are stored in this slice.

API: `GET /api/events`, `GET /api/events/:id`, `POST /api/events`, `PATCH /api/events/:id`. POST accepts optional `ideaId`; PATCH replaces editable content and cannot change owner, source Idea or status. `event_details` holds Event-specific fields alongside the common `activities` table. Writes are transactional; links follow the same HTTP(S) rules as Projects.

## Interested

Idea, Project and Event detail pages show the persisted count and a Member-only **Interested** toggle. This only signals interest: it does not register Going, join a Project, or assign an Activity/Task owner. A Visitor sees the count and a sign-in link; no interested-person identities are exposed. UI copy is DE/EN.

Each target supports `GET`, `POST` and `DELETE` on `/api/ideas/:id/interested`, `/api/projects/:id/interested` or `/api/events/:id/interested`. GET returns `{ count, interested }`; `interested` is the current Member's boolean or `null` for a Visitor/Alumni. Writes accept `{}`, use the authenticated Member only and enforce the usual Origin check. DELETE also accepts no body. Repeated writes are idempotent, including concurrent POSTs. Missing targets and wrong Activity types return 404.

`idea_interests` and `activity_interests` store only foreign keys to the target and User, with composite primary keys preventing duplicates. Neither endpoint writes participation or ownership. Membership tests now verify this independence; Going tests also verify separation; Task tests verify the same independence. The UI reads the count after a successful write and preserves the displayed state with a retryable message if saving fails.

## Project team membership

The Project detail page has a **Join project / Leave team** control, a count, and a team list visible only to current Members. Joining works immediately in PLANNING and ACTIVE, with no application or approval. Completed/cancelled Projects do not accept joins. Ownership stays a separate responsibility: creating a Project does not implicitly enroll its owner in the team count; an owner may explicitly join, but cannot Leave an active Project without first transferring responsibility or cancelling it.

`GET /api/projects/:id/membership` returns only `{ count }` publicly. For a Member it also returns `members` (id/name only), `joined`, `isOwner`, `canJoin`, and their own `history` of `{ joinedAt, leftAt }` periods. No email or another person's historical participation is returned. `POST` joins; `DELETE` leaves; both accept `{}` (or no body), require Member/Origin, and act only on the authenticated user. Repeated writes do not duplicate participation or alter an already-ended period. Owner Leave returns 409, including for Ops who own that Project; there is no override here.

`project_memberships` records participation periods. A partial unique index allows one open period per User/Project. Leave sets `left_at`; rejoining creates a new period. Writes lock the Project row in a transaction so concurrent actions cannot bypass ownership checks. Interested is unchanged by Join/Leave, joining does not grant editor rights, and leaving never releases Activity or Task ownership.

## School room requests

On an Event or Project page the owner can send one room request describing preferred dates, group size and plans. Ops see the queue at `/ops/rooms` (linked from `/ops`) and either offer an alternative or explicitly confirm a room/time. Alternatives are coordinated with the owner through Discord; offering one never confirms it automatically. The Ops form asks them to acknowledge agreement with owner and school before final confirmation. No equipment catalogue, booking engine or confirmation revocation is included.

A request is PENDING, ALTERNATIVE or CONFIRMED. Confirmation is final: the API rejects every later update, including an alternative or changed room. Dates and times use Cologne wall time (Europe/Berlin), with an optional end date for multi-day bookings. Known slots must have an end after the start. Room confirmation does not modify Activity status, planned Event fields, Interested or membership, and does not open Going. The confirmed conditions are displayed separately; opening registration validates the Event plan against them.

`GET /api/activities/:id/room-request` exposes only status publicly. Current Members can see confirmed dates/times and exact room; only the Activity owner and Ops see request wishes, alternatives and reply notes. `POST` on that route accepts `{ note }` from the owner only, including when that owner is Ops; Ops cannot request on someone else's behalf. Duplicate requests return 409. `GET /api/ops/room-requests` lists all requests, unresolved first. `PATCH /api/ops/room-requests/:id` accepts `{ status: 'ALTERNATIVE' | 'CONFIRMED', date, endDate?, startTime, endTime, room, message? }` from Ops. Confirmed rows cannot be changed (409); no delete endpoint exists.

## Event registration (Going)

Only the Activity owner opens registration with `POST /api/events/:id/open` and `{}`. Ops may edit Events but cannot open another owner's registration. PLANNING becomes ACTIVE (registration open) when date, start, end and public general location are present. Events without a school-room dependency open independently. `schoolRoomRequired` is an editable boolean, default false. If true **or any Room Request exists**, that request must be CONFIRMED, the exact room must match, and the Event's entire interval must fit inside the confirmed slot. Unchecking the field cannot bypass an existing request. Enter the confirmed exact room in the Members-only form section.

`GET /api/events/:id/going` returns public `{ open, count }`; current Members also receive their own `going`, `isOwner`, `canOpen` and participant id/name pairs, never emails. `POST` registers the authenticated Member, `DELETE` withdraws; both accept `{}` (or no body). Composite keys prevent duplicate registrations. There is no capacity limit or waitlist; Interested is independent and may remain marked when joining/withdrawing.

Changing the start date/time or effective end date/time in the normal Event PATCH moves all current Going into Interested without duplicates, removes their Going and returns an ACTIVE Event to PLANNING in one transaction. Description-only editing preserves registration. Owners reopen registration once the revised conditions are ready; participants explicitly register again. The editor warns about this and asks owners to communicate changes manually through Discord. Invalid edits roll back without changing registrations. The Event row lock serializes opening, joining and editing.

Edits that make venue/room conditions invalid close registration without removing unchanged-time registrations. A new Room Request on an ACTIVE Event also returns it to PLANNING under the same row lock; existing Going stay unless dates/times change. Room confirmation alone never reopens registration. Closed/cancelled Events cannot open or accept new Going. Activity completion/cancellation controls are a later ticket.

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

The database enforces a single active Season, unique Season numbers and ordered dates. Ops manage Seasons at `/ops/seasons`.

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

## Activity tasks

Event and Project pages share a Tasks panel. Activity Owner/Ops create and edit tasks with a title, description and optional due date. Any current Member can take an OPEN task; this immediately assigns them and starts work. Taking a task never joins a Project or registers Going. The Task Owner or Activity Owner/Ops can complete it or release it back to OPEN; Activity Owner/Ops can also cancel unfinished tasks. DONE preserves the responsible person's attribution. Terminal tasks cannot be taken or released.

`GET/POST /api/activities/:id/tasks` lists/creates tasks; `PATCH /api/tasks/:id` edits content. `POST /api/tasks/:id/take`, `/complete`, `/release`, and `/cancel` change responsibility/status. Actions lock the Activity and Task rows in a transaction, so competing takes have one winner. Writes require a current Member and a same-origin request. Closed Activities reject task writes. Public reads omit assignee identity and action permissions; Member responses include them and use `Cache-Control: no-store`. UI actions and errors are available in DE/EN.

## Ownership transfer

The current owner proposes a successor from the current Members on the Event/Project page. They remain the sole owner until that recipient accepts. The proposal and acceptance do not enroll either person in a Project/Event or reassign Tasks. The owner, recipient or Ops can cancel a pending proposal; Ops cannot force acceptance or propose in the owner's place. Share the Activity link manually through Discord. Departure without a successor uses Activity cancellation.

`GET /api/activities/:id/ownership` is Member-only: the current owner can see eligible Members by name (no emails); only the owner, recipient and Ops see the pending proposal. `POST` on the same path takes `{recipientId}`. `POST .../accept` and `POST .../cancel` require `{transferId}` so a stale page cannot act on a replacement proposal. Only PLANNING/ACTIVE Activities allow proposing/accepting. Cancelling a pending proposal remains available after closure.

`ownership_transfers` preserves accepted/cancelled proposals and permits one pending proposal per Activity. Writes lock the Activity row and commit the owner change and acceptance together. Project/Event editing rechecks authority under the same Activity lock; starting a Project checks it in the UPDATE. The previous owner loses owner-specific controls after acceptance, while any independent Ops or Task Owner rights remain.

## Completion, cancellation and past activities

Only the current Activity Owner can close a Project/Event from its detail page. The closure panel offers completion or cancellation and warns about unfinished tasks. Its checkbox explicitly authorizes cancelling all remaining OPEN/IN_PROGRESS tasks. `POST /api/activities/:id/close` accepts `{status: "COMPLETED" | "CANCELLED", confirmUnfinished?: boolean}`. Without confirmation, unfinished work returns 409 with `CONFIRM_UNFINISHED_TASKS` and a count, with no changes saved. The UI also handles tasks appearing after the initial preview.

Closure locks the Activity and atomically changes its status, cancels unfinished tasks without clearing their owners, and cancels pending ownership transfers. DONE tasks are untouched. Materials, source Idea, links, participants and ownership attribution remain on the same page. Cancelling the Activity ends active responsibility when there is no successor; it does not erase the historical owner. Project Leave may then proceed.

Events/Projects default to Current; Past (`?view=past`) shows COMPLETED/CANCELLED records. Closed pages hide work, joining, registration and transfer controls. Editing results/materials remains available to Owner/Ops. Event schedule changes are rejected after closure to preserve registrations. Closed Activities cannot request rooms or receive room approvals, and their requests leave the active Ops queue. Manual Discord communication remains the owner's responsibility; no notifications or reopening flow are introduced.

## Seasons and Project continuation

Ops create and edit Seasons at `/ops/seasons` using `GET/POST /api/ops/seasons` and `PATCH /api/ops/seasons/:id`. A Season has a number, title, description, inclusive start/end dates and DRAFT/UPCOMING/ACTIVE/FINISHED/ARCHIVED status. Finish the current ACTIVE Season before activating another; duplicate numbers or competing active Seasons return 409. Season changes never change Activity status.

Public `/seasons` and `/seasons/:id` pages show published Seasons and their Events/Projects. DRAFT Seasons are excluded even for direct public detail requests. `/season` shows the current Season and its Activities. The homepage also shows the six newest PLANNING/ACTIVE Activities, including independent ones. These lists contain public fields only.

An Activity can remain independent. Its owner can choose an UPCOMING/ACTIVE Season on the detail page; Event assignment is to one Season, while a Project can add further Seasons without being copied. `GET/POST /api/activities/:id/seasons` reads history or accepts `{seasonId}`. Writes lock the Activity and target Season and reject closed Activities or unavailable targets. Repeating a link does not duplicate it. `activity_seasons` preserves previous links; there is no destructive move or unlink operation in this slice. Team membership, Tasks, materials and the Project ID stay unchanged. History badges list each actual Season, so participation in Season 0 and Season 2 never implies Season 1.

## My Activity

Members open `/my-activity` through **Mein Lab / My Lab** or their profile. Current owned Tasks appear first, followed by Projects they own or have joined and Events they own or are Going to. Responsibility and participation have separate labels. Interested Ideas and Activities stay in their own section and never imply membership or registration. Completed/cancelled Activities and Tasks remain available under past work.

`GET /api/me/activity` is private to the authenticated Member, including Ops viewing their own work. The endpoint accepts no query parameters or target User ID, sends `Cache-Control: no-store`, and reads all sections in one database snapshot. Returning to the page reloads saved state after task release, team departure, ownership acceptance or Event rescheduling. No additional storage or migration is required.

## Private Club Network

Ops open `/network` from the Ops dashboard to create, read, edit and delete contacts. A record contains a required name and optional company, professional role, topics, notes, contact method and source of the connection. Contact methods are plain text, suitable for an email or professional profile. The server records who added the contact and when; editing preserves that attribution. The UI confirms permanent deletion before removing a record.

`GET/POST /api/ops/network` and `GET/PATCH/DELETE /api/ops/network/:id` require a current verified Member with the Ops role. Writes use the existing Origin protection; every response is `no-store`. POST/PATCH validate the full editable record and reject client-supplied provenance. The separate `contacts` table is never included in public Activity, Idea or Season responses. Visitors and ordinary Members cannot retrieve records, including by direct ID; they are directed to ask Ops for help through Discord. No email sending or request system is added.

## Moderation

Ops use `/ops/moderation` to hide or restore Ideas/Activities and block or unblock a User's changes. Each action requires a reason and stores the state change together with an audit entry. `GET /api/ops/moderation` shows targets and the latest 100 actions; POST to `/ideas/:id` or `/activities/:id` below that endpoint accepts `{hidden, reason}`, and `/users/:id` accepts `{blocked, reason}`. Ops cannot block themselves.

Hidden content is excluded from ordinary lists, recent Activities, Seasons and My Activity. Direct content routes and child resources return 404 to Visitors and ordinary Members, including owners. Ops retain direct access for review. A hidden source Idea is not linked or available for new Activity creation. Hiding never deletes tasks, participation, ownership or materials; restoring makes the retained data accessible again.

User blocking is checked against the database on each authenticated mutation, including existing sessions and Ops writes. Blocked Users can still read, sign in and sign out; their profile shows the reason and directs them to Ops through Discord. Responsibilities remain assigned until resolved. Moderation does not send messages or add a complaints system. Migration `0016` adds visibility/block state and the audit table.
