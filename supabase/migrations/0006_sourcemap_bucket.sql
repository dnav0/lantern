-- Private storage for build-time source maps.
--
-- Symbolication happens server-side, in the hq-telemetry edge function, using
-- maps kept here. See D:/Projects/hq/TELEMETRY.md, "Source maps never reach HQ,
-- and never become public": symbolicating in the BROWSER would require publicly
-- fetchable maps, i.e. publishing the app's original source to the entire
-- internet in order to avoid showing stack frames to HQ. That trade is
-- backwards, so the maps live here instead and only the edge function reads
-- them.
--
-- `public => false` is the whole point of this file. A public bucket would
-- recreate exactly the disclosure the design avoids, with the added downside of
-- looking secure because the maps are "not in the repo".
--
-- NO STORAGE POLICIES ARE CREATED, DELIBERATELY. storage.objects has RLS on by
-- default, so with no policy granting access, anon and authenticated can do
-- nothing here at all — not list, not read. Only service_role (BYPASSRLS)
-- reaches these objects: the edge function on the way out, and the build-time
-- uploader on the way in. Adding a policy "just to test in the dashboard" would
-- undo this; use the service role instead.
--
-- Objects are keyed <commit_sha>/<bundle-file-name>.map, so a frame is always
-- mapped against the build it actually came from. Mapping against the wrong
-- build produces confident, wrong line numbers, which is worse than no mapping.

insert into storage.buckets (id, name, public)
values ('sourcemaps', 'sourcemaps', false)
on conflict (id) do update set public = false;
