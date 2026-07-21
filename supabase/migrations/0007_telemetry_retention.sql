-- Retention that does not depend on anyone calling.
--
-- WHY THIS EXISTS. 0004 established the buffer and the hq-telemetry edge
-- function sweeps old rows on every pull. That was sound when it was written
-- and is not sufficient on its own: the sweep only runs INSIDE a pull, and HQ's
-- ingest is P2 and not built. Until something calls the endpoint, nothing ages
-- anything out, so "we retain events for about seven days" is a claim backed by
-- a caller that does not exist yet.
--
-- The volume is genuinely small — the guard trigger caps an install at 500 rows
-- a day and a healthy app generates approximately none — so this is not a
-- capacity fix. It is a correctness fix: `public/privacy.html` tells people
-- reports are "kept for about seven days on Lantern's side", and that sentence
-- should be true whether or not a consumer was ever built.
--
-- The edge function's sweep is deliberately KEPT. Two independent mechanisms
-- covering the same guarantee is the right shape here: cron covers the
-- nobody-is-pulling case, the in-request sweep covers cron being disabled or
-- the extension being unavailable. Both are cheap and neither depends on the
-- other.
--
-- RETENTION_DAYS is duplicated between this file and the edge function. Kept in
-- sync by hand on purpose rather than read from a config table: two constants
-- that must agree is a smaller problem than a table lookup on every pull, and
-- the privacy page is the actual source of truth for the number anyway.

-- ─── The prune, as a named function ──────────────────────────────────────────
-- In a function rather than inline in the cron entry so the SQL is reviewable
-- here, can be called by hand, and can be changed without rescheduling.

create or replace function public.prune_telemetry_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted integer;
begin
  delete from public.telemetry_events
  where occurred_at < now() - interval '7 days';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- Aggregates and deletes across all installs, so no public role may call it.
revoke all on function public.prune_telemetry_events() from public, anon, authenticated;

-- ─── Schedule it, if the platform lets us ────────────────────────────────────
--
-- Wrapped defensively. pg_cron is available on Supabase but is a platform
-- feature rather than something this schema controls, and a migration that
-- hard-fails on a missing extension would block every later migration on any
-- environment without it. Failing to schedule degrades to "the edge function is
-- the only sweeper", which is exactly where we were before this file — a
-- strictly-no-worse outcome, and worth a WARNING rather than an abort.
--
-- The DO block reports what it actually did; `supabase db push` prints these,
-- so the result is visible at apply time instead of having to be inferred.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron';

    -- cron.schedule upserts by job name, so re-running this migration
    -- reschedules rather than stacking duplicate jobs.
    perform cron.schedule(
      'prune-telemetry-events',
      '17 3 * * *',  -- daily, 03:17 UTC. Odd minute to avoid the top-of-hour crowd.
      $cron$ select public.prune_telemetry_events(); $cron$
    );

    raise notice 'pg_cron: scheduled prune-telemetry-events daily at 03:17 UTC.';
  else
    raise warning 'pg_cron unavailable — telemetry retention falls back to the hq-telemetry edge function sweep, which only runs when HQ pulls. See supabase/migrations/0007_telemetry_retention.sql.';
  end if;
end
$$;
