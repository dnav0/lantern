-- Telemetry buffer — the client-writable side of the HQ telemetry contract.
-- See D:/Projects/hq/TELEMETRY.md.
--
-- This is a BUFFER, NOT AN ARCHIVE. HQ is the long-term store. Rows live ~7
-- days and are then dropped (the retention sweep runs in the hq-telemetry edge
-- function, see supabase/functions/hq-telemetry — deliberately there rather
-- than in pg_cron, which is an extension this project does not otherwise need).
--
-- ─── WHY THE FLOOD DEFENCE IS HERE AND NOT ONLY IN HQ ────────────────────────
--
-- HQ's first draft argued that pulling rather than accepting pushes removes the
-- flood risk, because a pushed ingest would need a credential shipped in a
-- public browser bundle. That reasoning is wrong, and the correction is the
-- reason this file looks the way it does: the client still has to write the
-- event into THIS table, using the same public anon key. Pull moves the
-- untrusted writer one hop upstream; it does not remove it. So every defence
-- below assumes the writer is hostile and holds a valid anon key.
--
-- Five defences, all server-side, because a client-side limit is a suggestion:
--   1. RLS insert policy   — write-only, and only plausibly-timed rows
--   2. Payload size caps   — CHECK constraints, enforced by the storage layer
--   3. Per-install burst   — trigger, N rows per minute
--   4. Daily ceiling       — trigger, hard cap per install per 24h
--   5. Sampling            — trigger, above a soft per-hour threshold
--
-- ─── WHY THE TABLE IS WRITE-ONLY ─────────────────────────────────────────────
--
-- There is an INSERT policy and deliberately NO SELECT policy. anon and
-- authenticated can add rows and can never read one back — not their own, not
-- anyone else's. Only service_role (BYPASSRLS), which the edge function uses
-- and which never leaves the server, can read. So even though the anon key is
-- public by design, this table cannot be used to read anything out of the
-- system. That property is worth preserving; do not add a select policy for
-- debugging convenience.

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists public.telemetry_events (
  id           uuid primary key default gen_random_uuid(),

  -- Client-claimed occurrence time. This is what HQ's `since` cursor filters
  -- on, so it is constrained by the RLS policy to a plausible window (see
  -- below) — an unconstrained future timestamp would advance HQ's cursor past
  -- real events and silently create a gap.
  occurred_at  timestamptz not null default now(),

  -- Server time. All rate limiting counts on THIS, never on occurred_at, so a
  -- client cannot evade a limit by lying about when something happened.
  created_at   timestamptz not null default now(),

  -- Random, client-generated, unrelated to auth, resettable by clearing site
  -- data. Exists so HQ can say "3 distinct installs hit this" without
  -- identifying anyone. NEVER derive it from a user id. The format check keeps
  -- it a fixed-width opaque token, which also stops it being used as a smuggling
  -- channel for arbitrary text.
  install_id   text not null check (install_id ~ '^[0-9a-f]{32}$'),

  -- NOT always 'error'. Scripture-fallback serves and draft recoveries are
  -- client-side occurrences no SQL query can produce, so they ride this channel
  -- as non-error kinds and get aggregated into scalars 6 and 7. A closed set,
  -- so an unknown kind is a hard failure rather than silent junk in the buffer.
  kind         text not null check (kind in (
                 'error',
                 'scripture_fallback_serve',
                 'draft_recovery'
               )),

  -- Stable machine code from src/errors.ts. Never interpolated — that property
  -- is enforced on the client side by construction (CodedError's message IS its
  -- code and the detail is unreachable), and the length cap here is the
  -- server-side backstop.
  code         text not null check (length(code) <= 80),

  error_class  text check (length(error_class) <= 80),

  -- Raw minified frames, symbolicated on the way OUT by the edge function.
  -- Message headers are already stripped client-side (see toTelemetrySafe).
  stack        text check (length(stack) <= 8000),

  boundary     text check (length(boundary) <= 80),
  commit_sha   text check (length(commit_sha) <= 64),

  -- Coarse environment only: browser family, viewport bucket, online flag.
  env          jsonb check (pg_column_size(env) <= 1024),

  -- How many real occurrences this row stands for. 1 normally; raised by the
  -- sampling branch of the guard trigger so an aggregate can scale back up with
  -- sum(sample_weight) instead of count(*). Without this, sampling would
  -- silently understate scalars 6 and 7 rather than merely coarsen them.
  sample_weight int not null default 1 check (sample_weight between 1 and 10000)
);

-- `since` cursor reads and the retention sweep both order/filter on occurred_at.
create index if not exists telemetry_events_occurred_at_idx
  on public.telemetry_events (occurred_at);

-- The guard trigger counts recent rows per install on every single insert.
-- Without this index that guard is itself a full table scan, i.e. the flood
-- defence becomes the thing that falls over under a flood.
create index if not exists telemetry_events_install_created_idx
  on public.telemetry_events (install_id, created_at);

-- ─── Guard trigger: burst limit, daily ceiling, sampling ─────────────────────
--
-- Returning NULL from a BEFORE INSERT trigger silently skips the row. That is
-- deliberately what happens when a limit is hit: the client is fire-and-forget
-- and must never see an error, retry, or behave differently because telemetry
-- was dropped. Dropping quietly is the correct failure mode here — the contract
-- says the app degrades to nothing, and that has to include degrading when its
-- own buffer says no.

create or replace function public.telemetry_events_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Tunables, kept together and named so a future change is one edit.
  burst_limit      constant int := 20;   -- rows per install per minute
  daily_ceiling    constant int := 500;  -- rows per install per 24h
  sample_threshold constant int := 100;  -- rows per install per hour before sampling
  sample_keep_one_in constant int := 10;

  recent_minute int;
  recent_day    int;
  recent_hour   int;
begin
  -- Hard daily ceiling first: it is the cheapest way to stop a sustained flood,
  -- and an install that has blown it should not get a sampling reprieve.
  select count(*) into recent_day
  from public.telemetry_events
  where install_id = new.install_id
    and created_at > now() - interval '24 hours';
  if recent_day >= daily_ceiling then
    return null;
  end if;

  -- Burst limit: catches a tight loop (a component erroring on every render)
  -- long before it reaches the daily ceiling.
  select count(*) into recent_minute
  from public.telemetry_events
  where install_id = new.install_id
    and created_at > now() - interval '1 minute';
  if recent_minute >= burst_limit then
    return null;
  end if;

  -- Sampling: a soft defence for the sustained-but-under-the-burst-limit case,
  -- which is exactly the shape a high-frequency non-error kind takes. Above the
  -- threshold, keep one row in N and stamp the weight so aggregates stay
  -- accurate in expectation rather than quietly reading low.
  select count(*) into recent_hour
  from public.telemetry_events
  where install_id = new.install_id
    and created_at > now() - interval '1 hour';
  if recent_hour >= sample_threshold then
    if floor(random() * sample_keep_one_in) <> 0 then
      return null;
    end if;
    new.sample_weight := sample_keep_one_in;
  end if;

  return new;
end;
$$;

drop trigger if exists telemetry_events_guard_trigger on public.telemetry_events;
create trigger telemetry_events_guard_trigger
  before insert on public.telemetry_events
  for each row execute function public.telemetry_events_guard();

-- ─── Row Level Security ──────────────────────────────────────────────────────

alter table public.telemetry_events enable row level security;

-- Supabase's default privileges grant anon/authenticated broad access on new
-- relations in `public`. Revoke everything, then grant back INSERT alone — so
-- the table-privilege layer agrees with the policy layer instead of relying on
-- the policy to be the only thing standing in the way.
revoke all on public.telemetry_events from anon, authenticated;
grant insert on public.telemetry_events to anon, authenticated;

drop policy if exists telemetry_events_insert on public.telemetry_events;
create policy telemetry_events_insert on public.telemetry_events
  for insert to anon, authenticated
  with check (
    -- Only plausibly-timed rows. A far-future occurred_at would push HQ's
    -- `since` cursor past events that have not happened yet, and every real
    -- event written before the cursor caught up would be silently skipped —
    -- a data-loss bug caused entirely by an untrusted timestamp. A far-past
    -- one would resurrect rows HQ has already consumed.
    occurred_at > now() - interval '1 hour'
    and occurred_at <= now() + interval '5 minutes'
    -- The client never sets its own weight; only the guard trigger does.
    and sample_weight = 1
  );

-- Deliberately NO select/update/delete policy. See the header: this table is
-- write-only to every public role, and readable only by service_role.
