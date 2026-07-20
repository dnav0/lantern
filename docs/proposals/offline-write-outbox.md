# Offline write outbox — should we build it, and how

Status: **proposal, not started**. This document is research only; it ships no
application code. It answers the brief: whether Lantern needs a write outbox
now, and if/when it's built, what the design has to get right.

## tl;dr

- **Current behavior is better than BACKLOG.md implies.** A failed write today
  does *not* silently vanish while the tab stays open: the typed note stays on
  screen, an offline pill + toast appear, and Save is retryable. The real gap
  is narrower — content is only lost if the tab is closed or reloaded before
  the user reconnects and re-saves, because nothing is persisted to disk until
  the write actually succeeds.
- **Recommendation: wait on the full outbox.** Ship a much smaller, much
  safer fix first — persist the in-progress note draft to IndexedDB as the
  user types, independent of any sync — which closes the actual data-loss
  window (tab close/reload) that matters today. Build the full queue-and-
  replay outbox when a concrete trigger fires (below), not speculatively.
- Everything in this document was validated by driving the real app code
  (`SupabaseBereanApi`, `StudyMode`, `src/offline/*`) in a browser, not
  assumed from reading source. See "Current behavior, observed" for how,
  given this runner has no real Supabase project to connect to.

## Current behavior, observed

### How it was tested (and why not directly against production Supabase)

This runner has no `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for a real
project, and none are available anywhere in the HQ worker's environment (only
`HQ_DATABASE_URL` and Claude auth are provisioned — checked `work.yml`). Rather
than skip the observational requirement, the real Supabase code path was
exercised with only the network transport faked:

1. `.env` was set to a syntactically valid but non-existent Supabase host, so
   `isSupabaseConfigured` is true and `Root.tsx` takes the real `SupabaseRoot`
   branch (not the in-memory stub) — the same `SupabaseBereanApi`, `auth.ts`,
   and `StudyMode` code a real user runs.
2. A Playwright script (`pw-outbox-check.mjs`, run from the repo root, deleted
   before this branch was committed — it isn't part of the app) seeded a
   fake-but-well-formed session into `localStorage` under the key
   `supabase-js` expects, so `getSession()` resolves with no network call.
3. Every request to that fake host was intercepted: auth/profile/workspace/
   passage-list reads got canned fixture responses so the app boots to a
   real signed-in, working UI; the note-save request was made to fail with
   `route.abort('failed')` — a genuine network-layer `TypeError`, which is
   exactly what `isNetworkError()` in `src/offline/status.ts` checks for
   (`msg.includes('failed to fetch')`, etc.) and exactly what a real blocked
   or unreachable host produces. The failure the app sees is indistinguishable
   from a real network outage; only the auth handshake is faked.

This is a faithful substitute for "block the Supabase host and attempt a
save," not a guess — it runs the actual production code, just with a stand-in
backend. It does not exercise Supabase's own server-side behavior (RLS,
triggers, migrations), which isn't in question here — the question is what the
**client** does when a write fails, and that is 100% client code.

### What actually happens

Steps: signed in → `+ Study` → typed `John 3:16` as the reference → typed a
note line → **then** blocked the host → clicked **Save & Read**.

Screenshots (in `artifacts/screenshots/`):
- `outbox-01-signed-in-library.png` — signed-in empty library, proving the
  real auth-gated `SupabaseRoot` path was reached, not the memory stub.
- `outbox-02-note-typed-before-save.png` — the note typed, connection still
  "up."
- `outbox-03-after-failed-save.png` — the moment after Save was clicked with
  the host blocked.

In the third screenshot: the note text (*"For God so loved the world -- this
is the verse my grandmother taught me"*) is **still on screen, untouched** in
the editor. An **"Offline — viewing only" pill** and a **"You're offline —
changes can't be saved yet." toast** both appear. The **Save & Read button
returns to its normal (not stuck "Saving…") state**, so the user can retry
once reconnected.

Tracing why, in the actual code:

- `SupabaseBereanApi.write()` (`src/api/berean-api.ts:108-119`) catches the
  failed insert, calls `markOffline()` + `emitOfflineToast()`, and throws
  `OfflineError`.
- `StudyMode.handleSaveRead` (`src/components/StudyMode.tsx:335-346`) awaits
  `ensureIds()` → `reconcileNotes()` inside a `try { … } finally { setSaving(false) }`
  with **no `catch`**. The `OfflineError` propagates out uncaught (visible in
  the browser console as an unhandled rejection — confirmed live: `PAGEERROR
  You're offline — changes can't be saved yet.`), which is a rough edge (a
  silent console error, no `.catch` at the call site) but is **not** what
  saves the user's content — nothing in the component ever clears `lines`
  state on the failure path, on purpose or otherwise. It survives by omission,
  not by design.
- The pill/toast are wired independently, through `src/offline/status.ts`'s
  event emitter, picked up by `OfflineIndicator.tsx`.

**The actual gap**: nothing persists the draft to disk. `lines` is plain
React state. Reload the tab, close it, or navigate away, and the typed note
is gone with no trace — confirmed by reading `NoteEditor.tsx` and
`StudyMode.tsx` end to end: the only `localStorage` use in either file is an
unrelated one-time "here's how notes work" hint flag. There is no draft
persistence today. So the honest description of current behavior is: **the
user's typed content survives exactly as long as the tab does.** For someone
taking notes on a phone with patchy signal — Lantern's actual use case — that
window is not reliably long enough.

## Every `BereanApi` mutation, classified

`ids` are client-generated UUIDs and `created_at`/`updated_at` are client-set
ISO strings for every mutation already (CLAUDE.md, confirmed in
`berean-api.ts`) — this is real, load-bearing groundwork. It removes the
hardest part of most offline-write designs (matching a client-side optimistic
row to the server row it becomes) for free: the id **is** the row, from the
moment it's typed. What's left is exactly: (a) making retried inserts
idempotent, and (b) reconciling *content* conflicts on the same id, not
identity/reference conflicts.

| Method | Classification | Why |
|---|---|---|
| `createPassage` | Needs idempotency work | Plain `INSERT`. A retried queue entry (e.g. the client thinks the first attempt failed but the server actually committed it) hits a primary-key violation on the client-generated id. Fix: replay as `upsert(row, { onConflict: 'id', ignoreDuplicates: true })` — cheap, and safe because the id is already fixed. |
| `createSession` | Needs idempotency work | Same shape, same fix, as `createPassage`. |
| `createNote` | Needs idempotency work | Same shape, same fix. |
| `updateNote` | Needs idempotency work (for conflicts, not duplication) | An `UPDATE … WHERE id = x` is naturally safe to retry (applying the same update twice is a no-op the second time) — the real risk isn't duplication, it's a **second device's** conflicting edit to the same note id landing in between. See "Conflict reconciliation" below; this is the one row that needs more than an upsert. |
| `deleteNote` | Safe to replay as-is | `DELETE … WHERE id = x` matching zero rows is not an error in PostgREST — deleting an already-deleted (or never-synced) id is a silent no-op. Already idempotent. |
| `deletePassageAll` | Safe to replay as-is | Same reasoning; `ON DELETE CASCADE` handles the fan-out server-side, and repeating a delete on a gone row is a no-op. |
| `deleteNoteAndCascade` | Genuinely hard — see below | Not because deleting is unsafe, but because it *decides*, client-side in the current code, whether to cascade upward — and that decision must never be made from stale, queued-at-write-time state. |

Reads (`getPassages*`, `getSessionsByPassage`, `getNotes*`, `searchNotes`,
`getBibleVerse`) are out of scope for an outbox entirely — they already have
a read-cache precedent (`src/offline/mirror.ts`, `src/bible/cache.ts`) that
solves a different problem (staleness, not queued writes) and needs no
changes here.

## The hard case: cascade deletes

`deleteNoteAndCascade` (`berean-api.ts:328-376`) does: delete the note → count
remaining notes in its session → if zero, delete the session → count
remaining sessions in the passage → if zero, delete the passage. The brief is
right that naively queuing this is where an outbox destroys real data: if the
"session is now empty, delete it" *decision* is computed once, at the moment
the write is queued (while offline), and that decision is queued and replayed
verbatim later, it can delete a session or passage that a **second device**
legitimately repopulated in the meantime — e.g. phone deletes the last note in
a session while offline; laptop, still online, adds a new note to that same
session five minutes later; phone reconnects an hour after that and replays
"delete this now-empty session" — destroying the laptop's new note along with
it.

**The design that prevents this: queue the operation, not its precomputed
effects.** `deleteNoteAndCascade(id)` already re-derives "is this empty?" from
a live query every time it runs (that's what the count queries are for) — it
is not implicitly relying on stale state, *if* it is replayed as a fresh
invocation against current server state rather than as a pre-expanded list of
"delete note X, delete session Y, delete passage Z." Replay it as the single
call `deleteNoteAndCascade(noteId)` when connectivity returns, and the
existing live-recompute logic gets the laptop scenario right automatically:
it deletes the note (still correct — that really is what the user asked for),
then counts the session's remaining notes, finds the laptop's new one, and
**does not** cascade the session away. No new logic is required for this —
only the discipline that the outbox's unit of replay is "call this `BereanApi`
method with these args," never a derived side-effect plan. The corollary:
deleting an already-gone row (note, session, or passage deleted by a
different sync in between) is a no-op today (see the table above), so replay
never errors out on a row someone else already removed.

The one case this does *not* solve: a queued `createNote` whose `session_id`
was deleted by another device while offline (a create-vs-delete race, not a
delete-vs-delete one). Replay would hit a foreign-key violation. This should
surface as a named conflict ("this note's session was removed on another
device — keep it as a new session here?") rather than being silently dropped
— never discard content to make a replay error go away. It's rare enough
(requires two devices editing the same passage concurrently, offline, with
one deleting) that it's reasonable to handle it with a blunt fallback for v1:
re-create the missing parent (session/passage) rather than the note, and
attach the note there. It should not block scoping the rest of the outbox.

## Conflict reconciliation

Because every workspace is single-user (`kind: 'personal'`, one per
`auth.users` row — `berean-api.ts:56-71`), the only realistic conflict is
**one person, two devices, both offline, editing the same note**, not
multiple people. That narrows the problem a lot, but doesn't remove it: phone
and laptop clocks drift by real, uncorrected amounts (minutes, sometimes
more, especially on a phone that's been offline long enough to need an
outbox), so **last-write-wins on client-set `updated_at` is not safe** —
whichever device's clock happens to be ahead wins, not whichever edit is
actually newer, and the loser's content is gone with no trace. For a personal
reflection on scripture, that is not an acceptable failure mode; losing a
thought a user chose to write down is worse than almost any amount of UI
friction to avoid it.

**Recommendation: never silently overwrite note content. On a detected
conflict, keep both.** Concretely: give `notes` a small server-side sequence
(a `revision integer default 1`, bumped by a trigger on every `UPDATE`, or
even reusing a comparison against the row's current `updated_at` fetched
just before the queued write is replayed). `updateNote` replay reads the
current row first; if its revision/timestamp doesn't match what the client
last saw when it queued the edit, that's a real conflict — do **not** apply
the update over it. Instead insert the queued edit as a new note directly
below the original (the data model already supports this cheaply: notes
already have `indent_level` for exactly this kind of "related note" grouping)
and surface a one-line "we found a conflicting edit from another device —
both were kept" banner. This is deliberately blunter than a text merge: a
human skimming two short paragraphs of their own notes and picking/merging by
hand is far more trustworthy than any automatic merge heuristic, and it
guarantees the one property that actually matters — nothing typed is ever
thrown away without the user seeing it.

## Recommended scope for a first implementation (if built)

**v1 covers creates and updates only — `createPassage`, `createSession`,
`createNote`, `updateNote`. Deletes are explicitly deferred**, including
`deleteNoteAndCascade` despite the safe replay design above being sound: the
risk isn't that the design is wrong, it's that shipping delete-replay and
conflict-fork logic in the same change roughly doubles the surface that has
to be gotten right before any of it is trustworthy, for a capability (offline
deletes) that is materially less urgent than offline capture. Lantern's core
loop is "read a passage, capture what you see" — creates and updates *are*
that loop; deleting while offline is a nice-to-have. Until v1 lands, a delete
attempted offline keeps today's behavior exactly as observed above (blocked,
friendly message, retryable) — that's not a regression, it's the status quo.

**UI surface needed:** a per-note "unsynced" indicator, not just the global
offline pill. Today's pill tells the user *the app* is offline; it says
nothing about *which notes* haven't actually reached the server, which
matters once writes are queued instead of just failing loudly. The natural
place is `NoteEditor.tsx`'s per-line rendering (`note-line-timestamp` already
exists at `NoteEditor.tsx:644` as the place a line renders its saved-state
metadata) — add a small dot/label for "queued, will sync" next to any line
whose note id has a pending outbox entry, clearing the moment that entry's
write confirms.

## Build now, or wait?

**Wait.** Two things drive this, not one:

1. **The actual failure window is narrower than BACKLOG.md's phrasing
   suggested**, per the live observation above — content is not lost by a
   failed save while the tab stays open; it's lost only on reload/close
   before reconnecting. A full queue-and-replay outbox is the right eventual
   fix for "auto-retry when back online," but it is not the fix for the
   failure mode that's actually dangerous today.
2. **The dangerous failure mode has a much smaller, much safer fix**:
   persist the in-progress note draft (the `lines` array in `StudyMode`) to
   IndexedDB as the user types — following the exact precedent already in
   this codebase (`src/offline/mirror.ts`, `src/bible/cache.ts`: open a small
   IndexedDB store, write-through, best-effort, swallow errors). This closes
   the tab-close/reload data-loss window completely, needs no conflict
   design (a device only ever recovers its own draft), touches one component,
   and ships in a fraction of the time. It's the change that actually matches
   today's risk.

**Trigger to revisit the full outbox:** either (a) a second device becomes a
real regular pattern for the one current user or an arriving one (phone +
laptop, both used offline against the same passage) — the conflict case this
document designs for stops being theoretical — or (b) a support/telemetry
signal shows someone hit "offline while writing, didn't reconnect before
closing the tab" often enough that draft-persistence alone isn't covering it.
Neither has happened yet; "one real user with more arriving" per the task
brief is exactly the stage where building the harder, riskier half of this
(conflict reconciliation, cascade replay) speculatively is more likely to be
wrong than useful.

## Effort estimate and how to split it

Not one task. Three, in priority order — the first two are worth doing
regardless of whether/when the full outbox happens:

1. **Idempotent upserts on the three create methods** (`createPassage`,
   `createSession`, `createNote` → `upsert(..., { onConflict: 'id' })`).
   ~20-40 changed lines in `berean-api.ts`. Strictly a hardening change (also
   fixes today's latent double-submit risk, e.g. a double-click on Save under
   slow network) — safe to do any time, independent of everything else here.
2. **Draft persistence for the in-progress note editor** (the "build now"
   recommendation above). New small module mirroring `mirror.ts`'s shape
   (~60-100 lines) + wiring into `StudyMode.tsx`'s `lines` state (~30-50
   lines) + a "restored an unsaved draft" notice. Estimate: ~150-250 changed
   lines, one PR.
3. **(Deferred) Full write outbox** — queue module (~150-250 lines), replay-
   on-reconnect trigger (~40-60 lines), conflict-fork logic for `updateNote`
   including the schema touch for a revision column (~100-200 lines +
   migration), per-note pending-sync UI (~60-100 lines), plus real test
   coverage for queue ordering/idempotent replay/conflict-fork (~100-150
   lines). Roughly **500-800 changed lines total** — should itself be split
   into at least three PRs (queue + idempotent creates/updates, replay
   trigger + pending UI, conflict-fork + migration) when its trigger fires,
   not landed as one deep change.

## Files read for this brief

`src/api/types.ts`, `src/api/berean-api.ts`, `src/api/supabase.ts`,
`src/api/auth.ts`, `src/api/context.tsx`, `src/api/memory.ts`,
`src/offline/mirror.ts`, `src/offline/status.ts`,
`src/components/OfflineIndicator.tsx`, `src/components/StudyMode.tsx`,
`src/components/NoteEditor.tsx`, `src/Root.tsx`, `src/main.tsx`,
`src/bible/cache.ts`, `src/bible/service.ts`, `docs/BACKLOG.md`.
