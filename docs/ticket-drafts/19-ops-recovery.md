# 19: Ops recovery and handover

**What to build:** A server admin restores management after school sponsor confirmation when all Ops have lost access.

**Blocked by:** 03: Initial Ops and normal appointment

**Status:** draft — awaiting agreement on the split and tracker; not published.

## Acceptance criteria

- [ ] The documented recovery path is distinct from bootstrap and normal appointment.
- [ ] A server admin can restore or appoint one or more Ops after external sponsor confirmation.
- [ ] Recovery is verified through an actual sign-in with restored permissions and a preserved role-change audit trail.
- [ ] Organisational accounts, shared ownership of critical resources and the handover checklist are documented.
- [ ] A regular Member cannot trigger recovery through the web API; no sponsor dashboard is added.

## Verification and boundaries

The slice includes the required storage, server behavior and user or administrative interface changes. Verify externally observable behavior rather than implementation details. The proposed boundary is the API with isolated PostgreSQL plus a small number of browser scenarios; the final test boundary still needs agreement. All added user-facing copy is available in DE/EN; authored content is not translated automatically.
