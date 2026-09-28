# Curated public launch for Events and Ideas

Decision: 2026-09-27, requested by the product owner.

The current public website focuses on two types of content: Events and Ideas. Visitors can read their lists and detail pages without creating an account. A separate password-protected admin interface publishes and edits them. Projects, Seasons, membership, registration, room operations and other existing workflows remain in the codebase, but are no longer primary public navigation in this launch.

This is a launch-scope decision, not a change to the meaning of Event, Idea, Member, Ops or Activity in the domain model. It supersedes the member-created public flow described in the earlier MVP spec for the current frontend. The existing member API is retained for compatibility; the new admin publishing endpoints require a distinct admin password and session. Admin-created Events have a service owner in the existing data model and remain in PLANNING, so publishing content does not implicitly open Going registration.

The admin password and session signing secret come from environment variables. No password is committed to Git. Public pages never expose the admin session or private member fields.
