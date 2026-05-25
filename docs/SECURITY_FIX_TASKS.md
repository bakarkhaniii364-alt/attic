# Security Fix — Task Tracker

**Plan:** [SECURITY_FIX_PLAN.md](./SECURITY_FIX_PLAN.md)  
**Audit:** [DATABASE_SECURITY_AUDIT.md](../DATABASE_SECURITY_AUDIT.md)  
**Last updated:** May 25, 2026

### Status legend

| Mark | Meaning |
|------|---------|
| `[x]` | Done — verified or implemented |
| `[ ]` | Not started |
| `[~]` | In progress or partially done |
| `[-]` | Skipped / not applicable |

---

## Phase 0 — Verify & quick wins

### 0.1 CSP (`public/_headers`)

- [x] Allow `https://nominatim.openstreetmap.org` in `connect-src` (reverse geocode in `useDashboardLogic.js`)
- [ ] Remove `'unsafe-inline'` from `style-src`
- [ ] Deploy and smoke-test UI (dashboard, chat, onboarding, arcade)
- [ ] Confirm DevTools Console has no CSP violations
- [ ] Update `SECURITY_HARDENING.md` to match deployed `_headers`

### 0.2 Database verification (Supabase SQL Editor)

#### RPCs — migration & sync group

- [x] `merge_app_state` exists
- [x] `update_app_state_atomic` exists
- [x] `pair_with_code` exists
- [x] `join_arcade_session` exists
- [x] `set_arcade_ready` exists (2 overloads — inspect signatures)
- [x] `leave_arcade_session` exists

#### RPCs — auth & room group

- [x] `get_my_room` exists
- [x] `leave_room` exists
- [x] `delete_my_room` exists
- [x] `delete_user_data` exists

#### Schema & RLS (still required)

- [ ] RLS enabled on all `public` tables (`rowsecurity = true`)
- [ ] `app_state.room_id` column type is `uuid`
- [ ] `security_hardening.sql` applied (rate-limited `pair_with_code`)
- [ ] Optional: resolve duplicate `set_arcade_ready` overloads

```sql
-- RLS check
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- room_id type
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'app_state' AND column_name = 'room_id';

-- set_arcade_ready overloads
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'set_arcade_ready';
```

### 0.3 Realtime isolation test

- [ ] User A receives updates for own room `app_state`
- [ ] User C (unpaired) does **not** receive User A/B updates (`app_state`)
- [ ] Same test for `chat_messages`
- [ ] Same test for `shared_assets`
- [ ] Same test for `arcade_sessions`
- [ ] Record pass/fail (optional: `docs/SECURITY_VERIFICATION.md`)

### 0.4 Supabase Auth

- [ ] Password policy configured (min 12, upper/lower/number)
- [ ] Document settings in `SECURITY_HARDENING.md` or README

### 0.5 Encryption at rest

- [ ] Verified in Supabase Dashboard → Project Settings → Security
- [ ] Documented in project docs

---

## Phase 1 — Critical fixes

### 1.1 Shared SQL helper

- [ ] Create `docs/db/security_fixes_phase1.sql`
- [ ] Add `public.user_owns_room(p_room_id uuid)`
- [ ] Grant execute only to `authenticated` (if needed)

### 1.2 Harden SECURITY DEFINER RPCs

#### App state

- [ ] `merge_app_state` — require `auth.uid()`
- [ ] `merge_app_state` — `user_owns_room(p_room_id)`
- [ ] `merge_app_state` — key whitelist + format check
- [ ] `merge_app_state` — `SET search_path = public`
- [ ] `update_app_state_atomic` — same checks as above
- [ ] Mirror changes in `docs/db/migration_normalized.sql`

#### Arcade sessions

- [ ] `join_arcade_session` — `p_user_id = auth.uid()`
- [ ] `join_arcade_session` — `user_owns_room`
- [ ] `set_arcade_ready` — same
- [ ] `leave_arcade_session` — same
- [ ] Drop stale `set_arcade_ready` overload (if confirmed unused)

#### Other definer functions

- [~] `pair_with_code` — rate limit exists in repo (`security_hardening.sql`); confirm in production
- [ ] `pair_with_code` — add audit_log writes (success / failure / rate limit)
- [x] `get_my_room` — already scoped to `auth.uid()` (no change)
- [x] `leave_room` — membership check exists (add audit log in Phase 1)
- [x] `delete_user_data` — uses `auth.uid()` (add audit log in Phase 1)
- [x] `delete_my_room` — membership via room lookup (add audit log in Phase 1)
- [-] `join_arcade_lobby` — not used in frontend; deprecate or harden

### 1.3 Audit logging

- [ ] Create `public.audit_log` table
- [ ] RLS policy: no client access (`USING (false)`)
- [ ] Log `pair_with_code` attempts (success, fail, rate_limited, unauthenticated)
- [ ] Log `leave_room` / `delete_my_room` / `delete_user_data`
- [ ] Log RPC access denied events

### 1.4 Storage validation

#### Database

- [ ] Update `user_can_access_storage_object` with extension regex per bucket
- [ ] Add file size limits (doodles 10MB, scrapbook 50MB, voice 100MB)
- [ ] Update `access_room_storage` policy to pass `size`
- [ ] Run updated `docs/db/storage_policies.sql` in Supabase

#### Frontend

- [ ] Add `validateUpload()` in `src/utils/file.js`
- [ ] Use in `src/hooks/useAssetSync.js`
- [ ] Use in `src/context/ChatContext.jsx`
- [ ] Tighten `src/views/ChatView.jsx` attachment handling

### 1.5 Deploy Phase 1 to Supabase

- [ ] Backup created
- [ ] `security_fixes_phase1.sql` executed in SQL Editor
- [ ] Post-deploy smoke test (pair, sync, arcade, upload)

---

## Phase 2 — High priority

### 2.1 Supabase client

- [ ] Add `realtime.params.eventsPerSecond` in `src/lib/supabase.js`
- [ ] Document `auth.autoRefreshToken` behavior in `SECURITY_HARDENING.md`

### 2.2 Column-level security

- [-] Deferred — no PII tables yet; revisit when adding `user_profiles` etc.

### 2.3 Documentation

- [ ] Reconcile `SECURITY_HARDENING.md` with actual CSP / headers
- [ ] Update `docs/MIGRATION_EXECUTION_GUIDE.md` with Phase 1 script step
- [ ] Mark resolved items in `DATABASE_SECURITY_AUDIT.md` (optional)

---

## Phase 3 — Optional

### 3.1 Automated tests

- [ ] Playwright: cross-user realtime must not leak
- [ ] Playwright: `pair_with_code` rate limit after 10 attempts

### 3.2 Compliance / ops

- [ ] GDPR timed deletion workflow (if required)
- [-] HIPAA — N/A unless health data stored

---

## Deployment checklist (master)

Copy to PR description or release notes when shipping.

- [x] All required RPCs exist in production
- [ ] RLS verified on all public tables
- [ ] `app_state.room_id` is `uuid`
- [ ] `security_hardening.sql` applied in production
- [ ] CSP: `unsafe-inline` removed and UI tested
- [ ] Realtime cross-user isolation tested
- [ ] Password policy configured in Supabase Auth
- [ ] Phase 1 SQL patch deployed
- [ ] Audit logging active
- [ ] Storage MIME/size enforced (SQL + JS)
- [ ] Documentation matches production

---

## Progress summary

| Phase | Done | Total | Notes |
|-------|------|-------|-------|
| Phase 0 | 10 | 22 | RPC verification complete; CSP, RLS, realtime, auth policy remain |
| Phase 1 | 4 | 28 | Mostly not started; 4 functions already OK in source |
| Phase 2 | 0 | 5 | — |
| Phase 3 | 0 | 4 | Optional |

**Gate to start Phase 1:** Finish Phase 0 items marked `[ ]` under 0.1, 0.2 (RLS/uuid), and 0.3 (or accept risk and proceed with implementation in parallel).

---

## Session log

| Date | Action |
|------|--------|
| 2026-05-25 | Security audit reviewed; fix plan drafted |
| 2026-05-25 | Verified migration RPCs in Supabase SQL Editor |
| 2026-05-25 | Verified auth/room RPCs (`get_my_room`, `leave_room`, `delete_my_room`, `delete_user_data`) |
| 2026-05-25 | Created `SECURITY_FIX_PLAN.md` and `SECURITY_FIX_TASKS.md` |
| 2026-05-25 | CSP: added `nominatim.openstreetmap.org` to `connect-src` in `public/_headers` |
