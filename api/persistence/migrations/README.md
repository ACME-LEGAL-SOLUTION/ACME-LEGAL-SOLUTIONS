# Migration Contract

Migration files are applied in lexical version order by the future production migration runner.

A runner must:

- acquire the database migration lock;
- verify every already-applied migration checksum;
- apply each pending migration atomically where supported;
- record version, timestamp and checksum only after successful application;
- fail closed on checksum drift;
- expose a rollback/recovery procedure appropriate to the approved database engine;
- never silently destroy client or audit data.

`001_initial_relational_schema.sql` is the first migration contract. The canonical schema is in `api/persistence/schema/001_initial_relational_schema.sql`.
