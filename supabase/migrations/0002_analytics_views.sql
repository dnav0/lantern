-- Product usage analytics — read-only views (admin/owner use only)
--
-- Design notes:
--   - These are aggregate/cross-user views for the app owner, not something the
--     app itself queries. Supabase's default privileges grant SELECT on new
--     relations (tables AND views) in `public` to `anon`/`authenticated`, so
--     without action every view here would be reachable by any signed-in user.
--     Two independent guards are applied to each view, belt-and-suspenders:
--       1. `security_invoker = on` — the view runs as the calling role, so even
--          if SELECT were granted, Postgres would still apply the underlying
--          tables' RLS policies to that caller rather than to the view's owner
--          (the migration role, which has BYPASSRLS). Without this, a view
--          owned by a BYPASSRLS role silently bypasses RLS for every caller —
--          exactly the notes-leak this task calls out.
--       2. `revoke all ... from anon, authenticated` — belt-and-suspenders so
--          a non-owner gets a flat permission error instead of a role-shaped
--          partial result (e.g. seeing only their own row of a "per user"
--          breakdown, which leaks nothing but doesn't match what these views
--          are for). service_role (BYPASSRLS) is unaffected by either guard.
--   - No table, policy, trigger or function is touched; no row is written.
--   - Book names are mapped from the USFM book_number (1-66) via an inline
--     VALUES list matching src/utils/bibleBooks.ts — deliberately not a table,
--     per CLAUDE.md ("Lantern deliberately has none").
--   - All views use `create or replace view`, so re-running this file is safe.

-- ─── Total signups ────────────────────────────────────────────────────────────

create or replace view public.analytics_total_signups
with (security_invoker = on) as
select count(*)::bigint as total_signups
from public.profiles;

revoke all on public.analytics_total_signups from anon, authenticated;

-- ─── Signups per week ─────────────────────────────────────────────────────────

create or replace view public.analytics_signups_per_week
with (security_invoker = on) as
select
  date_trunc('week', created_at)::date as week_start,
  count(*)::bigint as signups
from public.profiles
group by 1
order by 1;

revoke all on public.analytics_signups_per_week from anon, authenticated;

-- ─── Notes created per user ───────────────────────────────────────────────────

create or replace view public.analytics_notes_per_user
with (security_invoker = on) as
select
  created_by as user_id,
  count(*)::bigint as notes_count
from public.notes
where created_by is not null
group by created_by
order by notes_count desc;

revoke all on public.analytics_notes_per_user from anon, authenticated;

-- ─── Distinct days active per user ─────────────────────────────────────────────
-- "Active" = created at least one note on that calendar day.

create or replace view public.analytics_active_days_per_user
with (security_invoker = on) as
select
  created_by as user_id,
  count(distinct date_trunc('day', created_at))::bigint as active_days
from public.notes
where created_by is not null
group by created_by
order by active_days desc;

revoke all on public.analytics_active_days_per_user from anon, authenticated;

-- ─── Week-2 retention cohort ────────────────────────────────────────────────────
-- Cohort = the signup week. "Retained" = created at least one note between
-- day 7 (inclusive) and day 14 (exclusive) after their own signup timestamp —
-- i.e. their second week of life, not a shared calendar week.

create or replace view public.analytics_week2_retention
with (security_invoker = on) as
with cohorts as (
  select
    id as user_id,
    date_trunc('week', created_at)::date as cohort_week,
    created_at as signup_at
  from public.profiles
),
week2_active_users as (
  select distinct c.user_id
  from cohorts c
  join public.notes n on n.created_by = c.user_id
  where n.created_at >= c.signup_at + interval '7 days'
    and n.created_at <  c.signup_at + interval '14 days'
)
select
  c.cohort_week,
  count(distinct c.user_id)::bigint as cohort_size,
  count(distinct w.user_id)::bigint as retained_week2,
  round(
    count(distinct w.user_id)::numeric
    / greatest(count(distinct c.user_id), 1) * 100,
    1
  ) as retention_pct
from cohorts c
left join week2_active_users w on w.user_id = c.user_id
group by c.cohort_week
order by c.cohort_week;

revoke all on public.analytics_week2_retention from anon, authenticated;

-- ─── Most-studied books ─────────────────────────────────────────────────────────
-- Notes per book, across all users, via notes -> sessions -> passages.

create or replace view public.analytics_most_studied_books
with (security_invoker = on) as
with book_names (book_number, book_name) as (
  values
    (1, 'Genesis'), (2, 'Exodus'), (3, 'Leviticus'), (4, 'Numbers'), (5, 'Deuteronomy'),
    (6, 'Joshua'), (7, 'Judges'), (8, 'Ruth'), (9, '1 Samuel'), (10, '2 Samuel'),
    (11, '1 Kings'), (12, '2 Kings'), (13, '1 Chronicles'), (14, '2 Chronicles'), (15, 'Ezra'),
    (16, 'Nehemiah'), (17, 'Esther'), (18, 'Job'), (19, 'Psalms'), (20, 'Proverbs'),
    (21, 'Ecclesiastes'), (22, 'Song of Solomon'), (23, 'Isaiah'), (24, 'Jeremiah'), (25, 'Lamentations'),
    (26, 'Ezekiel'), (27, 'Daniel'), (28, 'Hosea'), (29, 'Joel'), (30, 'Amos'),
    (31, 'Obadiah'), (32, 'Jonah'), (33, 'Micah'), (34, 'Nahum'), (35, 'Habakkuk'),
    (36, 'Zephaniah'), (37, 'Haggai'), (38, 'Zechariah'), (39, 'Malachi'), (40, 'Matthew'),
    (41, 'Mark'), (42, 'Luke'), (43, 'John'), (44, 'Acts'), (45, 'Romans'),
    (46, '1 Corinthians'), (47, '2 Corinthians'), (48, 'Galatians'), (49, 'Ephesians'), (50, 'Philippians'),
    (51, 'Colossians'), (52, '1 Thessalonians'), (53, '2 Thessalonians'), (54, '1 Timothy'), (55, '2 Timothy'),
    (56, 'Titus'), (57, 'Philemon'), (58, 'Hebrews'), (59, 'James'), (60, '1 Peter'),
    (61, '2 Peter'), (62, '1 John'), (63, '2 John'), (64, '3 John'), (65, 'Jude'),
    (66, 'Revelation')
),
book_notes as (
  select p.book_number, count(*)::bigint as notes_count
  from public.notes n
  join public.sessions s on s.id = n.session_id
  join public.passages p on p.id = s.passage_id
  group by p.book_number
)
select
  b.book_number,
  b.book_name,
  coalesce(bn.notes_count, 0) as notes_count
from book_names b
left join book_notes bn on bn.book_number = b.book_number
order by notes_count desc, b.book_number;

revoke all on public.analytics_most_studied_books from anon, authenticated;
