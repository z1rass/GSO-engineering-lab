# GSO Engineering Lab

<!-- impeccable:product-schema 1 -->

Shared product context for the web frontend and API. This record summarizes confirmed decisions; terminology lives in [CONTEXT.md](CONTEXT.md), and detailed approved behavior lives in [docs/mvp-product-spec.md](docs/mvp-product-spec.md). Earlier proposals do not override the approved model.

## Platform

web

## Users

GSO Berufskolleg students, especially FIAE, FISI, ITA and other technical courses, and teachers with a confirmed current affiliation to GSO. They discover technical initiatives, find peers, contribute and organize work alongside school life.

Visitors can explore public content. Members have verified current school affiliation. Ops support room coordination, moderation and continuity. Activity Owner is responsibility for one Activity, not a global role.

User means a person's persistent account. Alumni means a former Member; graduation does not erase the account or contribution history. Alumni login and participation permissions are future work, not MVP functionality.

## Product Purpose

Help a student-led technical community survive beyond any one founder or organizer. Members discover initiatives, join deliberately, take responsibility and leave useful results available to the community.

Success is useful work and continuity: someone finds an idea, contributes, takes ownership and produces a result that remains accessible. Numerical success targets have deliberately not been set.

## Positioning

The Lab is a community infrastructure, not a teacher-led sequence of lessons. Its mechanism is Discover → Join → Own: participants initiate and run projects and events themselves. The site preserves ownership, structure, history, knowledge and community contacts without replacing Discord or GitHub.

## Operating Context

- Seasons provide a roughly 6–12 week rhythm. Activities need not belong to a Season; Projects can continue across Seasons while preserving their page, team, tasks and history.
- Season 0 is intended to launch the community with a kickoff, projects, a guest speaker, workshops/build nights, a build day or small hackathon and a finale. These are plans, not confirmed scheduled events.
- Communication happens manually through Discord. Materials are text on the site and links to GitHub; there are no MVP file uploads or automatic Discord notifications.
- An owner requests a school room; Ops confirm it or propose an alternative. A pending room must never appear guaranteed. Independent initiatives do not require blanket Ops approval.
- Critical organizational resources require shared ownership, organizational accounts and handover documentation. Initial Ops appointment and lost-access recovery involve school sponsor confirmation and a documented server-admin action; existing Ops handle ordinary appointments in the site.

## Capabilities and Constraints

### Implemented foundation

The current code provides a public homepage and Season pages backed by PostgreSQL, German/English interface switching, responsive layouts and loading, empty and retry states. Local Compose supplies migrations and demonstration data. The shipped MVP slices include magic-link authentication/profile, Ideas, Events, Projects, Interested, Project membership, room requests, Going, Tasks, ownership transfer, completion/cancellation with Past Activity views, Ops Season management, Project continuation across Seasons and a private My Activity overview. Remaining Ops workflows and production operations stay planned.

### Confirmed MVP behavior

- A Member can express an Idea without agreeing to organize it. An Idea may inspire several Activities or none. Ideas are public; only Ops edit them.
- Activity is either Event or Project. Its creator immediately becomes its single owner, whether created independently or from an Idea.
- Interested is neither Going nor Project membership. Taking a Task also does not register someone for an Event or join a Project.
- Before room confirmation, preparation, recruiting a team, tasks and Interested are allowed. Going opens only when the date, time, place and required room confirmation are ready. There is no capacity limit or waiting list in MVP.
- Changing Event date/time resets Going to Interested so participants can reconfirm. Owners communicate changes manually through Discord.
- Owners and Ops create Tasks. A Member taking an open Task becomes its owner and starts work immediately. Task states are OPEN, IN_PROGRESS, DONE and CANCELLED.
- Ownership transfer requires the successor's acceptance. If an owner leaves without a successor, the Activity is cancelled; its source Idea remains available. Co-organizers are outside MVP.
- Completed/cancelled Activities retain their pages and results. Closing an Activity with unfinished Tasks requires a warning and confirmation before cancelling those Tasks.
- My Activity makes personal participation and responsibility visible.
- Club Network is private to Ops. Members request speaker/contact help through Discord.
- Moderation hides content or blocks further actions with a reason while retaining history. Profile deletion is handled through Ops, resolving active responsibility and removing personal data while preserving results with an anonymized attribution.

### Identity and privacy

Membership is verified through magic links to @gso.schule.koeln at registration and each new login, with time-limited sessions. The email mechanism does not define the domain concept of Member. Name and verified school email are required; education type, year and interests are optional.

Public pages must not expose participant/owner identities, task assignments, email addresses or precise access instructions. Member-only and Ops-only information requires server-side authorization. Do not collect addresses, phone numbers or birth dates without a justified need.

### Scope limits and open decisions

No internal chat, private messages, likes, followers, rankings, gamification, complex voting or replacement for GitHub/Discord. Automatic notifications, Discord bot, file attachments, co-organizers and Alumni access are outside MVP.

Still undecided: future Alumni login and permissions; magic-link delivery and expiry/rate-limit details; production hosting/domain and backup operations; detailed personal-data deletion procedures. Do not silently turn these into promises or resolved requirements.

## Brand Commitments

Name: GSO Engineering Lab. Latest identity clarification: this is an enthusiast community, not an official school website or a directly affiliated institutional service. GSO should be a subtle contextual reference, never a dominant endorsement or official school lockup. Preserve the existing membership domain rules. The user requests a modern, technical, minimal interface appropriate to a student-led engineering community, without a conventional school-site, corporate-heavy or excessively game-like character. These are broad constraints, not approval of any particular palette or typography.

German is the default interface language; English is available from the first release. Permanent interface copy exists in both languages. Community-authored content stays in its original language, without compulsory or automatic translation.

## Evidence on Hand

- Approved product model: docs/mvp-product-spec.md.
- Domain vocabulary: CONTEXT.md.
- Decision history: docs/design-interview.md and docs/adr/0001-decentralized-activity-approval.md.
- Actual shipped slice: apps/web/src/App.tsx and apps/api/src/app.ts; local setup in README.md.
- Local demonstration Season: apps/api/src/seed.ts. Its explicit ACTIVE status enables preview before its example dates; it is not evidence of a confirmed public schedule.
- Existing visual implementation: apps/web/src/styles.css; prior direction notes in design-system/gso-engineering-lab/MASTER.md. Their existence is not a new user approval of the design.

No verified member counts, testimonials, partnerships, speakers or participation outcomes have been supplied. Do not invent them as social proof.

## Product Principles

1. Expressing interest is low commitment; accepting responsibility is explicit.
2. Let Members organize independently; involve Ops for concrete school and stewardship needs.
3. Keep responsibility visible and preserve continuity when people leave.
4. Keep the platform simple and complementary to existing community tools.
5. Present confirmed conditions honestly and keep personal information within its intended audience.

## Accessibility & Inclusion

The product is responsive web for desktop, tablet and mobile, not a separate native app. Preserve keyboard-operable controls, visible focus, readable contrast, semantic status/error feedback and reduced-motion support. German and English UI must remain usable without translating user content. No additional product-specific accessibility certification or special assistive-technology requirement has been established.
