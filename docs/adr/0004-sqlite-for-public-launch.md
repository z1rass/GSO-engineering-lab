# SQLite for the public launch

Decision: 2026-09-28, requested by the product owner. The Events and Ideas launch uses one SQLite file instead of a PostgreSQL server. The API creates the small current schema on startup, and Docker Compose mounts `data/lab.sqlite` from the host. Node 24's built-in SQLite driver removes the PostgreSQL and Drizzle runtime and migration dependencies.

The existing Events, Ideas, votes and uploaded covers were copied to SQLite with their IDs, visibility and timestamps intact. The retired member, project and Ops data is outside this launch's schema and remains in the legacy PostgreSQL volume. Compose no longer starts PostgreSQL, but does not delete its volume. Back up the SQLite file while the API is stopped so its write-ahead log is fully checkpointed. This simple single-writer setup suits the current local version; hosting, automated backups and future scaling remain separate decisions.
