# Open ideas and direct event publishing

Decision: 2026-09-28, requested by the product owner. This updates the launch scope in ADR 0002: any visitor can publish an Idea and vote for Ideas without an account. One browser can have one vote per Idea and can remove it. The password-protected admin stays available only through its direct URL, manages Events and may edit or remove Ideas. Event forms use a classroom identifier such as C001 or B102 and a selected or uploaded cover. The public Event view does not show the internal PLANNING label, and admin publishing does not start a room-request workflow.

The retired member, project, season, registration and Ops interfaces and API routes are removed from this launch. The existing database tables and migration history remain so existing records are not destroyed. Admin removal hides Events and Ideas from public views while retaining records for recovery. Public creation and voting use origin checks and rate limits to reduce automated misuse; browser-based voting is a lightweight expression of interest, not a verified person count.

Storage was subsequently changed by [ADR 0004](0004-sqlite-for-public-launch.md). Its SQLite file contains the active launch content; the retired records remain in the legacy PostgreSQL volume.
