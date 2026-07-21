-- The seven agreed telemetry scalars, as one function.
-- See D:/Projects/hq/TELEMETRY.md, "Choosing scalars".
--
-- WHY A FUNCTION AND NOT SEVEN VIEWS. The 0002 analytics views are for a human
-- in the Supabase SQL editor, one question at a time. This is a machine
-- endpoint that needs all seven in a single round trip, in the contract's exact
-- {key, value, unit, window} shape, so the edge function stays a thin transport
-- with no SQL in it. Keeping the SQL here means it is reviewable in a migration
-- and can be fixed without redeploying a function.
--
-- WHY EACH ONE EARNS ITS PLACE. The contract's standard is that a scalar must
-- name the decision it changes, because a number that changes no decision
-- generates opinions, and opinions are worse than nothing on a dashboard whose
-- whole value is that everything on it matters. Each is annotated below with
-- the decision it moves. `median_session_ms` was explicitly REJECTED: for a
-- reading app a long session is ambiguous (deep study, or lost and confused),
-- so it produces debate rather than decisions. Don't add it back.
--
-- SECURITY. security definer, so it can read notes/profiles across users to
-- aggregate — but it returns ONLY aggregates, never a row per person, and
-- execute is revoked from anon/authenticated so the only caller is the edge
-- function's service_role. search_path is pinned.

create or replace function public.hq_telemetry_scalars()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
with
-- 1. Weekly active writers.
--    DECISION: is anyone actually using this? The denominator of every other
--    question. A flat line here means nothing else on the dashboard matters.
weekly_active as (
  select count(distinct created_by)::numeric as v
  from public.notes
  where created_at > now() - interval '7 days'
    and created_by is not null
),

-- 2. Week-2 retention.
--    DECISION: does the app survive first contact? Someone who writes notes in
--    their second week has fitted it into a real routine rather than trying it
--    once. Only cohorts old enough to have completed their day-7..14 window are
--    counted; including younger ones would drag the number down for no reason
--    other than that time has not passed yet.
cohorts as (
  select id as user_id, created_at as signup_at
  from public.profiles
  where created_at < now() - interval '14 days'
),
week2 as (
  select
    count(*)::numeric as cohort_size,
    count(*) filter (
      where exists (
        select 1 from public.notes n
        where n.created_by = c.user_id
          and n.created_at >= c.signup_at + interval '7 days'
          and n.created_at <  c.signup_at + interval '14 days'
      )
    )::numeric as retained
  from cohorts c
),

-- 3. Returned studies. THE THESIS METRIC.
--    DECISION: whether the core premise holds at all. Lantern's claim is that
--    notes anchored to a passage are worth returning to. If people write once
--    and never come back to the same passage, that claim is false and no amount
--    of polish fixes it — the product would need rethinking, not refining.
--    "Returned" = notes on the same passage on two or more distinct days.
--    Distinct DAYS, not distinct notes: five notes in one sitting is one visit,
--    and counting it as a return would flatter the number into uselessness.
studies as (
  select
    s.passage_id,
    count(distinct date_trunc('day', n.created_at)) as active_days
  from public.notes n
  join public.sessions s on s.id = n.session_id
  where n.created_at > now() - interval '30 days'
  group by s.passage_id
),
returned as (
  select
    count(*)::numeric as total,
    count(*) filter (where active_days >= 2)::numeric as came_back
  from studies
),

-- 4. Median notes per active writer.
--    DECISION: is a session a real study or a drive-by? Median rather than mean
--    on purpose — one power user with 400 notes would drag a mean somewhere no
--    actual person lives.
per_writer as (
  select created_by, count(*)::numeric as n
  from public.notes
  where created_at > now() - interval '30 days'
    and created_by is not null
  group by created_by
),
median_notes as (
  select coalesce(percentile_cont(0.5) within group (order by n), 0)::numeric as v
  from per_writer
),

-- 5. Signups.
--    DECISION: it is the denominator. Retention and activity percentages are
--    unreadable without knowing whether the cohort is 3 people or 300.
signups as (
  select count(*)::numeric as v
  from public.profiles
  where created_at > now() - interval '30 days'
),

-- 6 & 7. The two client-side counters.
--     These are NOT Postgres-computable from app data — they are occurrences in
--     the browser that leave no trace in any table — so they ride the events
--     channel as non-error kinds and are aggregated here.
--     sum(sample_weight), never count(*): if the guard trigger sampled during a
--     burst, each surviving row stands for several real occurrences, and
--     counting rows would silently under-report exactly when volume was high
--     enough to matter.
--
--     6. DECISION: is helloao reliable enough to keep as primary? A number that
--        stays near zero says the self-hosted fallback is insurance nobody is
--        claiming on; a rising one says the primary source is the problem.
--     7. DECISION: is draft persistence earning its keep, and does the full
--        offline write outbox (still deferred, see docs/BACKLOG.md) need
--        building? Zero recoveries over weeks says the narrow fix was enough.
fallback_serves as (
  select coalesce(sum(sample_weight), 0)::numeric as v
  from public.telemetry_events
  where kind = 'scripture_fallback_serve'
    and occurred_at > now() - interval '24 hours'
),
draft_recoveries as (
  select coalesce(sum(sample_weight), 0)::numeric as v
  from public.telemetry_events
  where kind = 'draft_recovery'
    and occurred_at > now() - interval '24 hours'
)

select jsonb_build_array(
  jsonb_build_object(
    'key', 'weekly_active_writers',
    'value', (select v from weekly_active),
    'unit', 'count', 'window', '7d'),
  jsonb_build_object(
    'key', 'week2_retention_pct',
    -- greatest(...,1) guards the empty-cohort divide-by-zero. An empty cohort
    -- reports 0%, which reads correctly as "no evidence yet".
    'value', round((select retained from week2) / greatest((select cohort_size from week2), 1) * 100, 1),
    'unit', 'percent', 'window', 'cohort'),
  jsonb_build_object(
    'key', 'returned_studies_pct',
    'value', round((select came_back from returned) / greatest((select total from returned), 1) * 100, 1),
    'unit', 'percent', 'window', '30d'),
  jsonb_build_object(
    'key', 'median_notes_per_writer',
    'value', round((select v from median_notes), 1),
    'unit', 'count', 'window', '30d'),
  jsonb_build_object(
    'key', 'signups',
    'value', (select v from signups),
    'unit', 'count', 'window', '30d'),
  jsonb_build_object(
    'key', 'scripture_fallback_serves',
    'value', (select v from fallback_serves),
    'unit', 'count', 'window', '24h'),
  jsonb_build_object(
    'key', 'draft_recoveries',
    'value', (select v from draft_recoveries),
    'unit', 'count', 'window', '24h')
);
$$;

-- Only the edge function's service_role may call this. It aggregates across all
-- users, so a signed-in caller must never reach it.
revoke all on function public.hq_telemetry_scalars() from public, anon, authenticated;
