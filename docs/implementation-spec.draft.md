# GSO Engineering Lab — MVP implementation specification

Status: draft, not published. Product scope is approved; the proposed testing boundaries await confirmation. The issue tracker and triage label vocabulary have not yet been configured. The target publication label is ready-for-agent, once the setup and review steps are complete.

## Problem Statement

GSO's technical community risks depending on one organizer for ideas, school coordination, projects, events, contacts and continuity. Students need a way to discover opportunities, express interest without becoming organizers, join real activities and take clearly assigned responsibility. Results and relationships must remain available when individual organizers leave.

## Solution

Build a bilingual web application around Discover → Join → Own. Public visitors discover the community, Seasons, Ideas, Events and Projects. Verified Members express interest, join activities and take tasks; anyone creating an Activity immediately becomes its owner. Ops support room coordination, moderation and institutional continuity without approving every independent initiative.

Ideas are separate from organized Activities. An Idea may inspire several Activities or none. Interested, Going and Project membership are distinct. Work and results remain visible through My Activity, persistent project pages, Season history and past activities. Discussion and announcements happen manually in Discord; materials live as site text and GitHub links.

## User Stories

1. As a Visitor, I want the homepage to explain Engineering Lab, so that I understand how to participate.
2. As a Visitor, I want to see the current Season and its activities, so that I understand the community's rhythm.
3. As a Visitor, I want to browse upcoming Events and active Projects, so that I can find something relevant.
4. As a Visitor, I want to read public Ideas, so that I can discover what the community wants to explore.
5. As a User, I want private identity and participation information withheld from public responses, so that browsing does not expose my school activity to everyone.
6. As a prospective Member, I want to sign in through a magic link sent to my school email, so that I can verify my GSO affiliation without a password.
7. As a Member, I want returning sign-ins to verify my school email again and sessions to expire, so that access remains tied to the agreed verification mechanism.
8. As a Member, I want a minimal profile with optional education details and interests, so that joining does not require unnecessary data.
9. As a teacher, I want to use the same membership flow without mandatory study-year details, so that the profile fits my circumstances.
10. As a User, I want my account and history to survive the end of my school affiliation, so that past contributions are not lost.
11. As a Member, I want to submit an Idea without accepting organizational responsibility, so that I can express a wish even when I cannot run it.
12. As a Member, I want to mark an Idea or Activity as Interested, so that I can express demand without committing to attendance or project membership.
13. As a Member, I want to create an Event or Project from an Idea, so that I can turn community interest into an organized initiative.
14. As a Member, I want to create an Activity without an Idea, so that I can directly organize something I already intend to do.
15. As an Idea author, I want other Members to create multiple independent realizations, so that my suggestion does not become one person's exclusive initiative.
16. As an Activity creator, I want to become its owner immediately, so that responsibility is clear from the start.
17. As an Activity Owner, I want to organize independently when school support is unnecessary, so that routine initiatives do not wait for Ops approval.
18. As an Activity Owner, I want to edit my Activity's information and links, so that participants have a current source of information.
19. As a Member, I want to see an Activity's owner and participants, so that I know who is involved and responsible.
20. As an Event Owner, I want to describe the topic, category and planned conditions, so that others understand what I intend to organize.
21. As an Activity Owner, I want to request a school room, so that Ops can arrange the school-facing part of preparation.
22. As Ops, I want to confirm a room request or communicate the nearest available alternative, so that the owner can plan using real conditions.
23. As an Activity Owner, I want to prepare tasks, materials and a team while awaiting a room, so that preparation can proceed before confirmation.
24. As a Member, I want pending school conditions to be clearly identified, so that a proposed venue does not appear guaranteed.
25. As an Event Owner, I want to open Going after the date, time, venue and required room confirmation are ready, so that registration means a concrete plan.
26. As a Member, I want to register Going for an open Event without an application process or capacity limit, so that participation is straightforward.
27. As a Member, I want to withdraw from an Event, so that my registration reflects my actual intention.
28. As an Event participant, I want a changed date or time to return me to Interested, so that I am not counted as attending conditions I never accepted.
29. As an Event Owner, I want ordinary description edits to preserve Going, so that harmless corrections do not reset participation.
30. As a Project Owner, I want to describe the goal, technical stack and repository/documentation links, so that potential collaborators understand the work.
31. As a Member, I want to join or leave a Project, so that its team reflects my participation.
32. As a Project Member, I want a project team to form before a requested room is confirmed, so that available work can start.
33. As an Activity Owner or Ops, I want to create tasks with descriptions and optional due dates, so that responsibility can be divided into concrete work.
34. As a Member, I want to take a free task and immediately become its owner with work in progress, so that a single action means I am doing it.
35. As a Task Owner, I want to complete or release my task, so that its state reflects my commitment.
36. As a Member helping with a task, I want task ownership to stay independent of Going and Project membership, so that helping does not create unrelated commitments.
37. As an Activity Owner or Ops, I want to manage the Activity's tasks, so that abandoned or incorrect work can be handled.
38. As a Member, I want My Activity to show my projects, events and tasks, so that I immediately see my responsibilities.
39. As an Activity Owner, I want to offer ownership to another person who accepts it, so that responsibility is transferred explicitly.
40. As an Activity Owner, I want to cancel an Activity if I leave without a successor, so that nobody sees an initiative that appears actively owned but is not.
41. As an Idea author, I want cancellation of a realization to leave the Idea available, so that someone else can try again.
42. As an Activity Owner, I want to be warned about unfinished tasks before completion or cancellation, so that I understand what will be closed.
43. As a Task Owner, I want unfinished tasks cancelled with attribution preserved when the Activity is closed, so that they no longer look active and their history remains available.
44. As a participant, I want completed and cancelled Activities to remain in past activities, so that results and context remain discoverable.
45. As an Activity Owner, I want to leave text and GitHub resource links on the page, so that useful materials outlast Discord discussion.
46. As Ops, I want to manage Seasons, so that the community has a visible schedule and history.
47. As a Project Owner, I want to continue the same Project in another Season, so that its team, tasks and page remain intact.
48. As a visitor or participant, I want a project's Season history shown clearly, so that I can see how long it has continued.
49. As an Activity Owner, I want to organize outside a Season, so that the calendar structure does not block useful work.
50. As an Activity Owner, I want to add a Discord discussion link manually, so that participants know where coordination happens.
51. As an Activity Owner, I want changes and cancellations recorded on the site while I announce them manually in Discord, so that the two tools have clear purposes.
52. As Ops, I want to maintain private Club Network contacts, topics, notes and provenance, so that relationships survive changes in the organizing team.
53. As a Member looking for a speaker, I want to ask Ops through Discord for help using Club Network, so that I can obtain assistance without receiving the private database.
54. As Ops, I want exclusive editing control over submitted Ideas, so that moderation has a clear authority.
55. As Ops, I want to hide unsuitable Ideas or Activities with a reason, so that the community can be moderated without deleting history.
56. As Ops, I want to block a User's further actions with a reason, so that harmful participation can be stopped.
57. As a User, I want to request profile deletion through Ops, so that my personal information can be removed after active responsibility is resolved.
58. As a community participant, I want results retained under “Deleted participant” after a profile is removed, so that useful work survives without retaining that person's identity.
59. As existing Ops, I want to appoint or approve new Ops inside the site with a recorded role change, so that the team can renew itself.
60. As a server administrator, I want a documented bootstrap operation authorized by the school sponsor when no Ops exist, so that initial administration can be established.
61. As a server administrator, I want a documented recovery operation authorized by the school sponsor if all Ops lose access, so that management can be restored.
62. As a user, I want German as the default interface and English available immediately, so that I can use the platform in either language.
63. As a content author, I want to write content once without mandatory translation, so that bilingual navigation does not double contribution effort.
64. As a mobile or desktop user, I want responsive activity and task flows, so that I can participate from the device I have.
65. As a contributor, I want a documented container-based local setup with useful seed data, so that I can begin work quickly.
66. As a maintainer, I want CI to check types, lint, tests and builds, so that broken changes do not merge.
67. As an operator, I want HTTPS, application and proxy logs, and a health check, so that basic operation is secure and diagnosable.
68. As an operator, I want daily database backups and a tested restoration procedure, so that the community's data can be recovered.
69. As a future maintainer, I want shared control of critical resources, organizational accounts and a handover checklist, so that operations do not depend on the founder.

## Implementation Decisions

### Architecture and implementation baseline

- Use a modular monolith and a monorepo, with a browser frontend, REST backend and PostgreSQL persistence. Microservices are excluded.
- Preserve the original recommended TypeScript stack: React, Vite, React Router and Tailwind on the frontend; Node.js and Express on the backend; Drizzle and Zod for persistence mapping and validation. Exact versions and optional UI components are not yet selected.
- Use Docker Compose for the local frontend, backend and database and Docker for production. Reverse proxy choice remains open.
- Logical responsibilities cover identity/access, profiles, Ideas, Activities and participation, Tasks, Seasons, room coordination, Club Network and Ops administration. These responsibilities do not require separate services or packages.

### Identity, access and privacy

- User persists independently of affiliation. Member is a User with verified current GSO affiliation; school email is a verification mechanism rather than its definition.
- The MVP verifies access using magic links to the exact school email domain. Sessions are time-limited. Authentication libraries, delivery provider and expiry values remain implementation decisions to close before building authentication.
- Alumni is part of the domain vocabulary and account/history preservation; separate Alumni sign-in and participation are deferred.
- Name and verified school email are required; education track, year and interests are optional. Teachers do not need a separate registration flow.
- Enforce authorization on the server. Activity ownership is a relationship to a specific Activity, not a global organizer role.
- Public responses expose public descriptions, dates and general locations, not participant/owner identities, assignments, exact access instructions or emails. The restriction applies to API data, not just rendered controls.
- Club Network is Ops-only, including its API responses. It is not a directory exposed to ordinary Members.
- Use HTTPS, secure session cookies, input validation and appropriate CSRF protection for cookie-authenticated mutations. Keep secrets outside source code and the database inaccessible directly from the Internet.

### Ideas and participation

- Model Ideas separately from Activities. Idea creation creates no organizational obligation. One Idea may be referenced by several Activities and need never be realized.
- Ideas are publicly readable; only Ops edit them. Members may create Ideas and independently create Activities from them.
- Interested, Going and Project membership must be represented as distinct commitments. Interested never creates the other two. Taking a task never creates either of them.
- Activity creation immediately assigns its creator as the sole owner. No universal proposal approval step remains; independent Activity creation does not wait for Ops.
- Joining/leaving participation is distinct from giving up Activity ownership; an owner cannot leave responsibility unresolved through a membership action.

### Activity lifecycle and school coordination

- Events progress through preparation, registration open and completed, with cancelled as a separate outcome. Projects progress through preparation, active work and completed, with cancelled as a separate outcome. Exact storage labels should preserve these meanings.
- Open Event registration only when date, time, venue and any required school-room confirmation are ready. No attendee limit, waiting list or application process is part of the MVP.
- Room Request is a simple owner request followed by Ops confirmation or an available alternative. Do not introduce equipment approvals, resource inventories or a booking engine.
- Preparation, tasks, team formation, speaker outreach, materials and Interested are allowed before room confirmation. Unconfirmed conditions must be labelled as pending.
- Treat school confirmation as final within the MVP's explicit product assumption; no revocation workflow is required.
- Changing an Event's date or time changes existing Going to Interested. Description edits do not. Owners announce changes in Discord manually.
- Past completed/cancelled pages remain available. Archive is a view of these outcomes, not another mandatory lifecycle transition.

### Ownership and task behavior

- An ownership transfer is an offer accepted by the recipient. Ops can help manage succession. If an owner leaves without a successor, cancel the Activity; do not remove its originating Idea.
- Activity Owner and Ops create tasks and manage Activity tasks. Any Member may take a free task; Task Owner may update its status or release it.
- Taking a free task simultaneously assigns its owner and moves OPEN to IN_PROGRESS. There is no claimed-but-not-started intermediate stage.
- Task states remain OPEN, IN_PROGRESS, DONE and CANCELLED. Releasing unfinished work makes it available again; completed attribution remains historical.
- Before completing/cancelling an Activity with unfinished tasks, warn and request confirmation. Confirmed closure marks remaining OPEN/IN_PROGRESS tasks CANCELLED, preserving attribution and history; DONE is unchanged.
- These combined changes must not leave observable half-applied states. Task claiming must not result in two concurrent owners. These are implementation consequences of the agreed single-owner and closure rules.

### Seasons, pages and materials

- Season association is optional. Preserve associations with previous Seasons when an owner continues a Project in a later Season; preserve the Project identity, members and tasks.
- Show Season history as a simple badge or equivalent. A range must not imply participation in Seasons the Project skipped.
- Provide homepage, current Season, Event and Project discovery/detail, Idea discovery/creation, Activity creation, profile, My Activity, Ops and private Club Network experiences. Exact route naming is not fixed by this spec.
- Event categories remain Talk, Workshop, Build Night, Study Session, Hackathon, Social and Other.
- Project content includes its goal, description, owner, members, tasks, technology stack and repository/documentation links.
- Materials are site text and GitHub links. Discord discussion links are manually supplied; no bot or built-in discussion is required.
- German is the default interface, with English available from launch. Translate the interface and permanent site copy, not user-authored content.

### Moderation, deletion and continuity

- Ops may hide an Idea/Activity or block further User actions, with a reason and preserved history. Complaints are handled in Discord, without a new reporting subsystem.
- Profile deletion is handled through Ops. Transfer/cancel active responsibility first, then remove the profile and linked personal data while preserving results attributed to “Deleted participant”. The exact treatment of logs, backups and free text needs a concrete implementation procedure.
- Normal path: existing Ops appoint/approve new Ops inside the site, recording role changes.
- Bootstrap path: if no Ops exist, school sponsor confirms initial appointments and server admin runs a documented command.
- Recovery path: if all Ops lose access, school sponsor confirms recovery and server admin restores/appoints Ops.
- Use organizational accounts, shared ownership of critical resources and a handover checklist. Do not build a school-sponsor dashboard.

### Developer experience and operation

- Seed a usable local environment with Season 0, two Projects, three Events, five Users and ten Tasks. Keep seed/test identities isolated from production access.
- Document purpose, architecture, requirements, setup, configuration, migrations, tests, contribution and PR workflow.
- CI runs dependency installation, type checking, lint, tests and build. Broken builds prevent merge.
- Provide daily database backups, an exercised restore procedure, application/proxy logs and a basic health endpoint. Hosting, backup destination/retention and operational owners remain unselected.

## Testing Decisions

The critical behaviors to test were agreed in the product specification. The testing boundaries below are proposed and await user confirmation; they are not claimed as already accepted infrastructure.

### Primary proposed boundary: public application API

Test externally observable behavior through the backend's public HTTP interface with an isolated real PostgreSQL database. Exercise actual authorization and persisted outcomes. Substitute only external delivery, such as capturing magic-link email in a test adapter. Do not mock away database constraints, ownership updates or access checks.

Use this boundary for the bulk of domain testing rather than repeating the same scenarios across controller, service and repository tests. Add lower-level tests only when they isolate a meaningful behavior that is otherwise hard to exercise.

### Coverage at that boundary

- Identity/access: eligible school-email verification, invalid/expired/reused links, session expiry, profile access, blocked users and denied direct API actions. Exact expiry/rate-limit values are selected with the authentication implementation.
- Visibility: Visitor versus Member versus Ops responses; absence of private identities, assignments and contact information where prohibited.
- Ideas: no owner obligation, Ops-only editing, multiple realizations, and Interested creating neither Going nor Project membership.
- Participation: join/leave outcomes, repeat requests not creating duplicate membership, and unauthorized actions leaving state unchanged.
- Events/Room Requests: registration prerequisites, preparation while a request is pending, independent Activities bypassing approval, Ops confirmation, Going reset on schedule changes and preservation on description edits.
- Tasks: take/complete/release, concurrent claims producing a single owner, denied reassignment, and no unintended participation changes.
- Ownership: recipient acceptance, no early change of owner, succession/cancellation and persistence of the original Idea.
- Closure: warning/confirmation behavior, cancellation of unfinished tasks with history, and preservation of DONE tasks.
- Seasons: continuation preserving Project identity, team, tasks and past associations.
- Moderation/deletion: hidden content access, blocked mutations, personal-data removal and preservation of nonpersonal results under deleted attribution.
- Ops/Club Network: access restrictions, recorded role changes and normal appointment behavior.

### Small browser-level supplement

Exercise only critical integrated journeys: discover and log in to join a Project; create an Idea and an Activity realization; take a Task and find it in My Activity; request/confirm a room and open Going; switch German/English on a mobile viewport. Assert outcomes visible to the user, not component internals, CSS class names or implementation snapshots.

### Administrative and operational checks

Verify bootstrap/recovery through their supported command interface and resulting authorized access. Check clean local startup with seeds, production build, health response and backup restoration into a separate database. Operational checks should demonstrate actual restoration, not merely that a backup file was produced.

### Prior art and definition of a useful test

The inspected project contains product documents, a glossary and an ADR, but no application or test suite to reuse. These are new proposed boundaries. A useful test expresses a business invariant or user-observable result, fails for a meaningful regression and tolerates internal refactoring. Do not pursue a coverage percentage or duplicate implementation logic in tests.

## Out of Scope

- A separate Alumni login/participation implementation; keep the domain distinction and history preservation.
- Discord bot, automatic activity notifications, calendar integration or Microsoft Teams integration. Authentication email remains required.
- Built-in chat, direct messages, comments/discussions, social likes/followers/feeds, XP, badges as rewards or leaderboards. The Season history badge is descriptive, not a gamification feature.
- Complex voting, recommendation engines, mentor/company platforms, advanced CRM features or internal Git hosting.
- File uploads, attachments, attendee limits, waitlists, project application approvals and co-organizer machinery.
- Equipment inventories, school-resource approval matrices, booking engines and school-confirmation revocation flows.
- Password authentication, Microsoft OAuth for this MVP, automatic content translation or mandatory bilingual user content.
- Mandatory retrospectives, advanced monitoring stacks or product-success metrics; the latter were explicitly deferred.
- Reopening accepted product decisions or adding features solely to accommodate hypothetical edge cases.

## Further Notes

- Sources: the approved GSO Engineering Lab product specification, the domain glossary, the recorded 41 interview answers and the ADR on decentralized Activity approval. Later accepted interview decisions supersede conflicting examples in the original 60-section brief.
- The earlier universal PROPOSED → Ops approval route is superseded. One Season reference per Project is insufficient to preserve the agreed history. The original example API/data model must be adapted rather than copied unchanged.
- No runnable prototype or established test seams exist. No prototype-derived code is included.
- The draft is not published to an issue tracker and is not yet marked ready-for-agent in a configured tracker. Complete setup and confirm the test boundaries before publication.
- Remaining technical decisions are explicit: dependency versions and auth library, email delivery and local capture, token/session lifetimes and abuse limits, schema/API details, production hosting/domain/proxy, backup destination/retention, deletion procedures and operating responsibilities. Resolve each before its dependent implementation ticket; do not mistake an open decision for permission to expand product scope.
- Future Alumni access additionally needs an affiliation-transition procedure, alternative authentication and an explicit permission model. These remain outside MVP implementation.
- Delivery should be split into independently demonstrable end-to-end tickets with declared dependencies. This document does not itself publish tickets or begin implementation.
