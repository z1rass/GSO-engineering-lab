# Ops appointments

Ops is a global Lab management role, separate from ownership of any Activity. The role is active only while the person has a confirmed current Member affiliation. An Alumni account that retains the role does not receive access.

## First appointment (bootstrap)

1. A school sponsor confirms the first Ops member outside the site. Keep that confirmation in the club's organisational channel.
2. The person signs in through the school magic link to create and verify their User account.
3. A server admin applies migrations and runs the command from the repository root:

```sh
# DATABASE_URL is already available in the administrator's environment.
npm run ops:bootstrap --workspace @gso/api -- \
  --email first-ops@gso.schule.koeln \
  --confirmed-by 'School sponsor name' \
  --operator 'Server admin name'
```

For local Compose:

```sh
docker compose exec api npm run ops:bootstrap --workspace @gso/api -- \
  --email local-demo@gso.schule.koeln \
  --confirmed-by 'Local sponsor confirmation' \
  --operator 'Local server admin'
```

The command requires an already verified Member. It does not create a User, send email or bypass sign-in. The `confirmed-by` and `operator` values record attribution; the command cannot independently verify the sponsor's external confirmation.

The appointment and audit entry are written in one transaction. Concurrent bootstrap commands are serialized: the first may appoint Ops and the next one is rejected. If any User already has the OPS role, including Alumni, bootstrap refuses to run. Running it again is not a normal appointment or an access-recovery path.

## Normal appointment

An existing Ops member opens **My Lab → Ops** (`/profile` → `/ops`), selects a verified Member and appoints them. The agreed normal path does not require a separate school sponsor confirmation.

The screen shows the current team, candidates and the latest 100 role changes. Email addresses are not exposed in this list. Stable User IDs distinguish people with the same name. Every MEMBER → OPS transition records the initiator, target and timestamp. Repeating an appointment does not create a duplicate entry.

Access is checked server-side on every request. A regular Member cannot change roles through the profile or a direct API request. This slice has no role removal, sponsor dashboard or access-recovery flow.

## If all Ops lose access

Stop and obtain school sponsor confirmation. Do not remove roles to bypass the bootstrap guard. A separate recovery process is planned in ticket 19; until it is implemented, use a separately reviewed administrative procedure that preserves the audit trail.
