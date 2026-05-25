# Attic database setup (run in order)

1. `init.sql` — base `app_state` + realtime
2. `auth_schema.sql` — rooms, auth trigger, pairing RPCs
3. `migration_normalized.sql` — chat, assets, arcade tables
4. `storage_policies.sql` — private bucket RLS (`doodles`, `scrapbook`, `voice_notes`)
5. `security_hardening.sql` — pairing rate limits, room-scoped `highscores` RLS

Create storage buckets in the Supabase dashboard (all **private**): `doodles`, `scrapbook`, `voice_notes`.
