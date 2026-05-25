# Attic database setup

> **Do not paste this file into the Supabase SQL Editor.**  
> It is Markdown documentation only. PostgreSQL will error on `#` lines.  
> Open and run each **`.sql`** file below, one at a time.

## Run in order (Supabase → SQL Editor → New query)

| Step | File | What it does |
|------|------|----------------|
| 1 | [`init.sql`](init.sql) | `app_state` + realtime |
| 2 | [`auth_schema.sql`](auth_schema.sql) | Rooms, pairing RPCs, signup trigger |
| 3 | [`migration_normalized.sql`](migration_normalized.sql) | Chat, assets, arcade tables |
| 4 | [`storage_policies.sql`](storage_policies.sql) | Private bucket RLS |
| 5 | [`security_hardening.sql`](security_hardening.sql) | Pairing rate limits + `highscores` RLS |

## Before step 4

In **Storage**, create three **private** buckets: `doodles`, `scrapbook`, `voice_notes`.

## Already set up?

If steps 1–3 ran earlier, you only need **`storage_policies.sql`** and **`security_hardening.sql`**.
