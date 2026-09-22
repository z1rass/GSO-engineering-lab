# Contributing to GSO Engineering Lab

GSO Engineering Lab is a student-led technical community. Contributions should make it easier for people to discover an initiative, join deliberately, or take responsibility for useful work.

## Before you start

Read the [product model](CONTEXT.md), the [MVP specification](docs/mvp-product-spec.md), and the relevant [ticket drafts](docs/ticket-drafts). Keep the domain vocabulary intact: an Activity is an Event or Project, Interested is not Going, and ownership belongs to a specific Activity rather than to a global role.

## Local development

Requirements are Docker Engine, Docker Compose, Node.js 24.18.0, and npm.

```sh
docker compose up --build
```

For host-based development, start only the database and Mailpit with Compose, then run `npm ci`, migrations, and the API/web dev servers as described in [README.md](README.md#local-development).

## Change flow

1. Open or choose a focused issue.
2. Create a branch such as `feature/task-history` or `fix/mobile-event-form`.
3. Make the smallest coherent change and update German and English interface copy together.
4. Add behavior tests at the agreed public seams: HTTP API with PostgreSQL and browser journeys where the UI changes.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` as appropriate.
6. Open a pull request using the repository template and describe the user-visible behavior.

Do not commit secrets, local `.env` files, Mailpit data, build output, or agent-tool state. Do not add chat, rankings, notifications, or other out-of-scope platform features without a product decision.

## Pull requests

A good pull request explains the problem, the resulting behavior, the tests run, and any known limitation. Keep unrelated formatting or generated changes out of the diff. Reviewers should be able to run the project with the documented Compose setup.
