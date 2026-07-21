-- Indexes the telemetry scalars need (see D:/Projects/hq/TELEMETRY.md, "Known
-- cost before adopting").
--
-- Purely additive: no table, column, policy, trigger, function or row is
-- touched. `if not exists` on every statement, so re-running the file is safe.
--
-- WHY THESE THREE. Four of the seven agreed scalars filter or group on a column
-- that has no index today, so each one is a full table scan:
--
--   weekly_active_writers      notes    WHERE created_at > now() - 7d, then
--                                       COUNT(DISTINCT created_by)
--   median_notes_per_writer    notes    GROUP BY created_by
--   returned_studies_pct       notes    created_at window + created_by grouping
--   signups_30d                profiles WHERE created_at > now() - 30d
--
-- `notes` has only notes_session_idx (session_id) and `profiles` has no index
-- beyond its primary key, so none of the above can use one. Pre-emptive rather
-- than urgent at the current row count — the point is that "the metrics endpoint
-- got slow" is a bad way to discover a missing index, and adding them costs
-- nothing now while the tables are small enough that the build is instant.
--
-- Composite vs. separate: notes(created_by, created_at) would serve the windowed
-- distinct-writer query in one index, but the two single-column indexes serve
-- more shapes between them (a pure recency scan with no grouping, and a pure
-- per-user grouping with no window) and the write cost at this scale is
-- irrelevant. Revisit if the notes table ever gets large enough for index
-- maintenance on insert to show up.

create index if not exists notes_created_at_idx on public.notes (created_at);
create index if not exists notes_created_by_idx on public.notes (created_by);
create index if not exists profiles_created_at_idx on public.profiles (created_at);
