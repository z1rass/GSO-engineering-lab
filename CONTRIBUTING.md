# Contributing to GSO Engineering Lab

GSO Engineering Lab is a student-led technical community. Contributions should make it easier for people to discover an initiative, join deliberately, or take responsibility for useful work.

## Before you start

Read the [current launch scope](PRODUCT.md#current-public-launch-2026-09-28), [product model](CONTEXT.md), and relevant decisions in [docs/adr](docs/adr). Older MVP specifications and ticket drafts describe retired workflows.

## Local development

Requirements are Docker Engine, Docker Compose, Node.js 24.18.0, and npm. The current site stores content in SQLite at `data/lab.sqlite`.

```sh
docker compose up --build
```

For host-based development, run `npm ci`, `npm run dev:api`, and `npm run dev:web` as described in [README.md](README.md#local-setup).

## Change flow

1. Open or choose a focused issue.
2. Create a branch such as `feature/idea-search` or `fix/mobile-event-form`.
3. Make the smallest coherent change and update German and English interface copy together.
4. Add behavior tests through the HTTP API with isolated SQLite and browser journeys where the UI changes.
5. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and `npm run build` as appropriate.
6. Open a pull request using the repository template and describe the user-visible behavior.

Do not commit secrets, local `.env` files, SQLite data, build output, or agent-tool state. Do not add chat, rankings, notifications, or other out-of-scope platform features without a product decision.

## Pull requests

A good pull request explains the problem, the resulting behavior, the tests run, and any known limitation. Keep unrelated formatting or generated changes out of the diff. Reviewers should be able to run the project with the documented Compose setup.
