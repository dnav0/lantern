# Architecture

## What this is

Berean is a single-user, web-first PWA for personal Bible-study notes, deployed on
Cloudflare Pages and backed by Supabase (Postgres + auth + RLS). It's a rewrite of
a local-only Electron desktop app. The desktop app carried its whole domain model
and pure-React UI through a single `window.api` bridge with zero direct Electron
imports in the renderer — that bridge is the seam the rewrite pivots on, so the UI
carries over nearly untouched and only the layer behind the seam changes.

## Shape of the app

The UI is a single React tree. `App.tsx` owns view state (the current
destination, which book/chapter/passage is selected, editor state). There is no
router and no global store — state is local to `App.tsx` and passed down; data
comes exclusively through the `BereanApi` context.

### Information architecture (Bible-centric, July 2026 overhaul)

The old capture/reading *mode toggle* and the left sidebar/drawer are gone. The
app is organized around **four destinations** in a single nav bar
(`src/components/NavBar.tsx`, `type Destination = 'bible' | 'journal' | 'study'
| 'profile'`) — a top bar on desktop, a bottom tab bar on mobile:

- **Bible** (home) — the annotated Bible: a book library → per-book chapter
  reader (`BibleLibrary` → `BookDetailPage`) with notes rendered inline against
  the verses, plus the saved-passage `ReadingMode`. Verse selection is the single
  in-Bible gesture: tapping a verse (or extending to a range) raises a floating
  action bar with **Quick note** (emphasised) and **Start study on {ref}**. This
  is the landing view.
- **Journal** — a browseable index of studies grouped by book (`JournalPage`,
  fed by `BereanApi.getJournalEntries`); tapping a row opens the study in
  `StudyMode`.
- **+ Study** — the single study surface (`StudyMode`), reached several
  convergent ways: blank from the nav, prefilled from the current chapter, from a
  verse-range selection, from a Journal row, or from a note's "Open study". There
  is **one** editing surface — the former `SessionEditor` card view is retired.
- **Profile** — display name, Settings, Export, Sign out (`ProfilePage` +
  `SettingsModal`); on desktop this is the top-bar avatar menu.

The leading top-bar slot carries the app logo and a **"Personal ▾" workspace
selector stub** — it renders the personal workspace only, a placeholder so the
future group switcher (see backlog) drops in without restructuring the bar.

**The note→study bridge.** A note shown in the Bible reading view offers "Edit
note" (inline quick edit — the primary, fast path) and "Open study"
(`handleOpenStudy(passageId)` → the unified `StudyMode`, always available). This
is how a quick note graduates into a full study, and it replaces the old
find-it-in-the-sidebar edit path. `handleOpenStudy` is the single open-study
entry point shared by the Journal, the bridge, and search results.

**Search** (`src/components/GlobalSearch.tsx`) is one box with two
independently-populating sections: (1) scripture-reference jumps, parsed
client-side by `parseScriptureQuery` (reusing the book-alias table) — a bare book
name or prefix yields book-level jumps (ambiguous prefixes return a small ranked
list), and book+chapter[:verse] jumps to the chapter; no verse text is searched;
and (2) matching notes via the additive
`BereanApi.searchNotes` (case-insensitive substring; `ilike` in Supabase, a
workspace scan in the memory stub). On desktop it's an always-present top-bar
input rendering a popover, focusable from anywhere via a `/` shortcut
(ignored while already typing in an editable field); on mobile a dedicated
full-screen surface opened from a top-bar search button. The two sections are
structurally decoupled (a synchronous `useMemo` for section 1, a debounced
effect for section 2) so neither blocks the other. Search is deliberately
**not** promoted to a hero/landing element — a prominent search bar primes
lookup-and-leave behavior, the opposite psychological posture from the
Bible-centric home's "settle in and read" intent; the `/` affordance and a
resting elevation shadow make it feel like a capable, fast tool without
competing with the reading canvas for attention. Scripture verse-text search
and a Postgres FTS index are backlogged.

**Top-bar layout is a 3-column CSS grid** (`.topnav`, `grid-template-columns:
1fr auto 1fr`), not flex-with-self-centering — the two outer columns
(`.topnav-lead`, a new `.topnav-right` wrapper grouping the search box/button +
avatar) are forced to equal width so the center destination tabs land on the
true viewport center regardless of the two sides' own (unequal) content width.
Each of the three children carries an explicit `grid-column` rather than
relying on source-order auto-placement, because a `display:none` grid item
(e.g. `.topnav-tabs` on mobile) is removed from the grid entirely and
auto-placement would otherwise pack the remaining visible children into the
wrong columns.

### Notes & studies model (the mental model behind the IA)

The domain schema (passage → session → note) is unchanged, but the *conceptual*
model the UI presents is deliberate and worth stating, because it settles several
otherwise-ambiguous UX questions:

- **Notes belong to verses, not to studies.** A note is anchored to a verse or
  range and is the durable artifact. The **Bible/reading view is the cumulative
  surface**: every note anchored in a chapter renders inline there
  (`getNotesByBook`) regardless of which passage/session created it. "Everything I
  ever noted on this verse shows up when I read it" — because study is cumulative
  and verse-centric, not filed-in-folders.
- **A "study" is one deliberate effort** — a `Passage` (a verse-range span with a
  `reference_label`). Its heading *is* the range; there are no thematic titles.
  The **Journal is the index of efforts**, range-labelled and newest-first. It is
  a librarian, not the front door: you reach a study from its notes in context (or
  from Journal for browse/recent).
- **Quick notes are ungrouped verse jottings** — a first-class in-Bible margin
  note that shows in context but is not itself a Journal-worthy effort; it
  *graduates* into a study via the note bridge's "Open study".
- **Editing an existing study never spawns a new Journal entry** (same passage);
  a new entry appears only when you deliberately start a new study. `StudyMode`'s
  save is **reconciling** (update changed notes in place / create new / delete
  removed) precisely so reopening-and-editing preserves note ids and the
  `created_at`/`updated_at` timestamps the UI renders — it does not rewrite the
  session.

**Reading-view presentation (study-Bible layout).** In both reading surfaces
(`ReadingMode` and `BookDetailPage`'s `ChapterView`) verse-anchored notes are
laid out by span width: **single-verse notes render inline** beneath their verse
row; **multi-verse range notes** sit in a right-hand **margin rail**
(`.scripture-grid` column 2) on desktop, with a category-coloured bracket that
spans exactly the anchored verse rows (the rail note fills its grid-row span via
`align-self: stretch`); **anchorless notes** are passage-level. The rail collapses
and the scripture column centers (`.scripture-grid.no-rail`) when there are no
range/passage notes. Overlapping range notes are laid out in side-by-side
**lanes** (greedy interval coloring). On mobile (no rail), range notes render
inline right after their *last* anchored verse rather than stacking at the
chapter's end. Desktop verse selection is a **marquee/box drag**
(`useVerseMarquee`) plus tap-anchor/tap-extend; both drive the same
`selAnchor`/`selFocus` state and the floating action bar. The marquee's drag
origin is the full-width reading container (not the centered column), so a drag
can start in the side margins, and its hit-test requires the box to overlap a
verse row on both axes — a box drawn purely in side whitespace, without ever
crossing verse text, selects nothing. Note-highlight and range-selection are
mutually exclusive and fully clearable — a click on empty scripture whitespace or
Escape clears everything. Verified live in a real browser across desktop and
mobile widths, light and dark.

**Deferred (future milestone), by design, not omission:** a lightweight
`study_id` group stamp enabling *multiple distinct study instances over the same
verses* (and cross-effort anchor merging inside the editor); a modifier to
restore native verse-text copy under the marquee. See the backlog.

### The `BereanApi` seam

All data access and mutation funnels through one interface, `BereanApi`
(`src/api/types.ts`), consumed via `useApi()`. This is the design's load-bearing
decision:

- The implementation swaps without touching components. Phase 0 uses an in-memory
  stub (`memory.ts`); Phase 1 drops in `SupabaseBereanApi` at `main.tsx`.
- It's the single mutation choke point, so the future **offline write outbox** has
  exactly one home. The phase-1 behavior on a failed write — catch, surface a
  friendly message — is literally the stub the outbox replaces later.
- Parent-cleanup cascades (delete note → delete now-empty session → delete
  now-empty passage) are done explicitly in the implementation, matching the old
  desktop `deleteNoteAndCascade` / `deletePassageAll` behavior. In Postgres these
  ride on `ON DELETE CASCADE` for the downward direction; the upward emptiness
  checks stay in `berean-api.ts`.

### The `BibleProvider` seam

Scripture access is a second interface, `src/bible/provider.ts`:
`getChapter(bookNumber, chapter)` → `{ verse, text }[]`. Implemented (Phase 2):

- `src/bible/helloao.ts` — `HelloaoBibleProvider`, BSB via the free, keyless
  `bible.helloao.org` API: `GET /api/BSB/{USFM}/{chapter}.json`. Book numbers
  (1–66) map to helloao's 3-letter USFM codes via an explicit table
  (`USFM_BY_BOOK_NUMBER`) rather than reusing `bibleBooks.ts`'s `id` field,
  because a handful of codes differ (e.g. Ezekiel is `EZK` not `eze`, Joel is
  `JOL`, Nahum is `NAM`, Song of Solomon is `SNG`). The response's
  `chapter.content` is a flat array of typed nodes (`heading`, `line_break`,
  `hebrew_subtitle`, `verse`); a verse's own `content` array mixes plain
  strings with inline objects (`{ noteId }` footnote markers, `{ lineBreak:
  true }`, `{ text, poem }` poetry lines). `flattenVerseContent` reduces all of
  that to one plain-text string per verse — footnote markers and poem-line
  structure aren't surfaced to components today.
- `src/bible/cache.ts` — `CachedBibleProvider` wraps any `BibleProvider` with an
  IndexedDB store (`berean-bible-cache`, key `translation/book/chapter`) and
  caches forever: chapters are immutable, so once fetched, helloao downtime
  never affects a chapter that's already been read.
- `src/bible/service.ts` — the reference-based lookup (`getBibleVerse(reference)
  -> BiblePassage | null`) that components actually call through `BereanApi`.
  It parses a label like `"John 1:1-5"` or `"Genesis 3"` (book prefix via
  `findBookByAlias`, chapter/verse via a regex tailored to the two shapes call
  sites produce), fetches the chapter through the cached provider, and slices
  the requested verse range (or returns the whole chapter when no verse
  component is present). **Design choice:** `getBibleVerse` stayed on
  `BereanApi` (both `memory.ts` and `berean-api.ts` delegate to
  `bible/service.ts`) rather than being removed from the interface and having
  components call the bible module directly — this keeps `BereanApi` as the
  single thing components import for data, avoids call-site churn across
  `CaptureMode`/`NoteEditor`/`ReadingMode`/`BookDetailPage`, and scripture
  lookup is still trivially separable later if it ever needs to move.
- KJV, or ESV-with-user-key, are future providers behind the same
  `BibleProvider` interface — nothing about the seam is BSB-specific except
  `helloao.ts`'s own USFM table.

There is no translation selection anywhere: BSB is the only translation, so no
translation state/props/settings UI exist. The provider interface is the sole
extensibility point for adding one later.

### `platform/`

Anything a native wrapper (Capacitor/Tauri) would reimplement lives behind a
`src/platform/` interface — markdown export now (zip download in the browser),
TTS later. The rule that keeps this honest: no Node/Electron APIs anywhere under
`src/` (see CLAUDE.md).

## Data model

Domain: a **passage** (a scripture reference span) has **sessions**, each holding
ordered **notes**. A note anchors to a verse range, carries an optional category,
and can be a sub-note (`indent_level > 0`). Book identity is a static USFM
`book_number` (1–66) — no books table; `src/utils/bibleBooks.ts` owns all book
metadata client-side.

Key data decisions:

- **Ids are client-generated UUIDs** (`crypto.randomUUID()`) and **timestamps are
  client-set**. This is offline-sync readiness: an offline client can mint a valid
  row and reconcile later without server round-trips for id assignment.
- **`workspace_id` from day one.** Phase 1 only exercises the degenerate
  single-personal-workspace case, but the column and the RLS pattern are in place
  so Groups later is *just new rows* — zero schema or policy migration.

### Target Postgres schema (Supabase, Phase 1)

```sql
-- profiles: 1:1 with auth.users, created by trigger on signup
profiles (id uuid PK refs auth.users, display_name text default '', created_at)

-- workspaces: 'personal' now; 'group' later without migration
workspaces (id uuid PK default gen_random_uuid(),
            kind text check (kind in ('personal','group')),
            name text, created_by uuid refs auth.users, created_at)
workspace_members (workspace_id uuid refs workspaces on delete cascade,
                   user_id uuid refs auth.users on delete cascade,
                   role text default 'owner',
                   PK (workspace_id, user_id))

-- passages: book is a USFM number (1–66); no Books table
passages (id uuid PK, workspace_id uuid refs workspaces on delete cascade,
          book_number int not null check (book_number between 1 and 66),
          chapter_start int, verse_start int, chapter_end int, verse_end int,
          reference_label text not null, created_at timestamptz)

sessions (id uuid PK, passage_id uuid refs passages on delete cascade,
          created_at timestamptz)

notes (id uuid PK, session_id uuid refs sessions on delete cascade,
       content text not null,
       anchor_start_verse int, anchor_end_verse int,
       anchor_book_override text, anchor_chapter_override int,
       category text check (category in
         ('observation','historical','application','personal')),
       indent_level int not null default 0,
       created_by uuid refs auth.users,
       created_at timestamptz, updated_at timestamptz)
```

- **Signup trigger:** on a new `auth.users` row, create a profile + a personal
  workspace + the owner membership.
- **RLS, one pattern everywhere:** a row is visible/writable iff its workspace is
  in `(select workspace_id from workspace_members where user_id = auth.uid())`.
  Notes and sessions check this via a join up to their passage. Groups later add
  membership rows and change nothing about the policies.
- **Not in Postgres:** scripture text (IndexedDB chapter cache) and the old
  `BibleVerseCache` / `Books` tables (replaced by the cache and the client
  `book_number` constant).

## Auth & bootstrap (Phase 1)

Sign-in is **email OTP**: the user enters an email, Supabase sends a 6-digit code,
and the code is verified (`signInWithOtp({ shouldCreateUser: true })` →
`verifyOtp({ type: 'email' })`, `src/api/auth.ts`). First sign-in doubles as
sign-up, which fires the Postgres signup trigger that creates the user's profile,
a personal workspace, and the owner membership. Sessions persist
(`persistSession`, `autoRefreshToken`); sign-out lives in the settings modal.

`src/Root.tsx` is the bootstrap that picks the backend and gates the app:

- **Supabase configured** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` present)
  → auth-gated. Phases: `loading → signedOut (SignIn) → onboarding (Onboarding) →
  ready (App)`. On a signed-in session it constructs `SupabaseBereanApi.create()`,
  which resolves and caches the user's personal workspace id once, then provides
  it via `ApiProvider`. Onboarding (optional name → capture intro → reading intro,
  skippable) runs on first sign-in and sets `profiles.onboarding_done`
  (localStorage `berean.onboarded` as a fallback).
- **Not configured** → the in-memory stub (`memory.ts`), with a console warning.
  `npm run dev` works with no backend for pure UI work.

`SupabaseBereanApi` (`src/api/berean-api.ts`) is the one mutation choke point:
client-generated `crypto.randomUUID()` ids, client-set ISO timestamps, downward
deletes via `ON DELETE CASCADE`, and the upward empty-session / empty-passage
cleanup done explicitly (mirroring the memory stub and the legacy desktop
`deleteNoteAndCascade`).

### Environment variables

| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (browser) | Supabase project URL. Absent → memory stub. |
| `VITE_SUPABASE_ANON_KEY` | `.env` (browser) | Supabase anon/public key. Absent → memory stub. |
| service-role key | CLI arg only | Used by the migration script to bypass RLS. Never in the browser or committed. |

See `.env.example`. `.env` is gitignored.

### SQLite → Supabase migration

`scripts/migrate-sqlite.ts` (run via `npx tsx`; Node APIs allowed here only — the
rest of `src/` stays pure web) does a one-time import of the legacy Electron
`berean.db` into a user's personal workspace. It remaps integer ids → UUIDs
(preserving `created_at`), maps legacy book names → `book_number` via the same
table as `src/utils/bibleBooks.ts`, inserts passages/sessions/notes with the
service-role key, and prints a before/after count summary plus a few sample notes.

```
npx tsx scripts/migrate-sqlite.ts \
  --db ./berean.db \
  --url https://<ref>.supabase.co \
  --service-key <service-role-key> \
  --user-email you@example.com
```

## Offline & PWA (Phase 4)

### Installability and the service worker

`vite-plugin-pwa` (`vite.config.ts`, `generateSW` strategy) emits the web app
manifest and a Workbox service worker at build time:

- **Manifest** — name/short_name "Berean", `standalone` display, theme and
  background color `#F5F4F1` (matching the app's light background), three
  icons (`192`, `512`, and a `512` `maskable` variant with ~10% safe-area
  padding baked in) generated from `public/icon.svg`.
- **Precache** — the app shell (JS/CSS/HTML/icons) via Workbox's default glob
  precache, plus a SPA `navigateFallback` to `index.html`.
- **Runtime caching** — a `NetworkOnly` rule for `*.supabase.co` traffic. The
  service worker must never cache API responses: notes and auth always hit the
  network (or fail loudly), so staleness is handled by the app's own offline
  mirror below, not silently masked by the SW cache.
- **Registration** — `registerType: 'autoUpdate'`; `src/main.tsx` calls the
  `virtual:pwa-register` `registerSW()` so updates apply without a user prompt.

### Offline reads: the notes mirror

`src/offline/mirror.ts` is a small IndexedDB store (`berean-offline-mirror`)
that mirrors `BereanApi` read-query *results*, keyed by `queryName + JSON(params)`
(e.g. `getNotesByPassage:"<uuid>"`). It's whole-result, write-through, no
merging — the opposite of a sync engine:

- On every successful read, `SupabaseBereanApi` (`src/api/berean-api.ts`)
  writes the full result to the mirror under that key.
- On a read that fails with what looks like a network error, it falls back to
  whatever was last mirrored for that exact key and returns it, so the app
  still renders. Scripture chapters have their own, separate cache-forever
  IndexedDB store (`src/bible/cache.ts`) and aren't routed through this mirror.

### Offline writes: graceful failure, not silent loss

Detection is by **fetch failure, not `navigator.onLine`** — the browser's
online flag reflects link-layer state, not actual reachability of Supabase.
`src/offline/status.ts` exports `isNetworkError()` (classifies `TypeError`s and
Supabase's connectivity-error messages) and a tiny listener-based emitter
(`subscribeOffline`, `markOffline`/`markOnline`) so both the plain-TS API layer
and React components can react to connectivity changes without a shared store.

`SupabaseBereanApi` routes every read through a `read()` helper (mirror
write-through / fallback, described above) and every mutation through a
`write()` helper: on a network failure it marks the app offline, fires a
one-shot toast event, and throws a typed `OfflineError` — the same catch point
the future write outbox (`docs/BACKLOG.md`) replaces.

The UI surfaces two things, both in `src/components/OfflineIndicator.tsx`,
mounted once in `App.tsx`'s shell:

- A subtle, persistent **"Offline — viewing only" pill**, shown while
  `isOffline()` is true (set on any `OfflineError`/mirror-served read; cleared
  on the browser's `online` event or the next successful request).
- A **non-blocking toast** ("You're offline — changes can't be saved yet."),
  fired once per failed mutation attempt, auto-dismissing after a few seconds.

### Markdown export

`src/platform/export.ts` reuses the legacy Electron vault's serialization
format exactly (frontmatter block — `reference`, `book`, `chapter_start`,
`verse_start`, `chapter_end`, `verse_end`, `updated` ISO timestamp — then a
blank line, then one `- {content}` line per note, ordered by
`anchor_start_verse` ascending with nulls last, then `created_at`). "Export all
notes" in `SettingsModal` calls `exportAllNotesAsZip(api)`, which walks every
passage via the active `BereanApi`, builds one `.md` file per passage at
`notes/{BookName}/{safeFilename(reference_label)}.md` (same `safeFilename`
rules as the legacy vault: `:` → `.`, strip ``\/?*"|<>``), zips them with
`fflate`, and triggers a browser download via `Blob` + a synthetic anchor
click. Works against whichever `BereanApi` is active (Supabase or the memory
stub), since it only calls interface methods.

- **iOS PWA note:** every cached thing is re-fetchable (scripture is immutable and
  re-downloadable; notes live in Supabase, mirrored locally only as a read
  fallback), so Safari storage eviction is an inconvenience, never data loss.

## Deploy (Phase 4)

Cloudflare Pages, auto-deploying from `main`. Build command `npm run build`,
output directory `dist`, environment variables `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`. `public/_redirects` (`/* /index.html 200`) makes the
single-page app's client-side view state survive a hard reload or deep link on
any path.

## Responsive & touch (Phase 3)

The app is mobile-first responsive from a single `max-width: 768px` breakpoint in
`src/assets/main.css`. Above it, the original desktop layout is untouched; below
it the shell reflows for a phone (primary target: Android Chrome, ~360–430px).

- **Shell.** The July-2026 IA overhaul replaced the sidebar/drawer with the
  `NavBar` (`src/components/NavBar.tsx`): a **top bar on desktop** (logo +
  workspace stub, centered destination tabs, search box, avatar menu) and a
  **fixed bottom tab bar on mobile** (Bible · Journal · + Study · Profile). The
  swap is driven by one `max-width: 768px` breakpoint — the desktop `.topnav`
  hides its tabs/trail/search and the `.bottomnav` appears; the mobile search box
  collapses to a top-bar button that opens the full-screen `.search-surface`.
- **Single column.** Study mode stacks the note editor over the passage pane
  (desktop is a 60/40 split); reading, book detail, session editor, and library
  go full-width with comfortable padding. The library grid drops from 3 to 2
  columns so book names don't truncate.
- **Modals as sheets.** SettingsModal and ConfirmDialog become full-width bottom
  sheets (rounded top, slide-up) on mobile.
- **Functional hovers → tap.** The only functional hover interactions are the
  cross-reference verse previews. `CrossRefPill` (`src/components/CrossRefPill.tsx`)
  centralizes them: on `(hover: hover)` devices it previews on hover exactly as
  before; on touch it's a tap-to-toggle popover that dismisses on outside-tap or
  Escape. Capability is detected with `matchMedia('(hover: hover)')`, not a UA
  sniff, so a hybrid device still gets both. Cosmetic `:hover` styles are left
  as-is (harmless on touch). Hover-revealed action buttons (note edit/delete, the
  verse "+" add button, the sidebar passage-edit pencil) are forced always-visible
  under `@media (hover: none)`.
- **Ergonomics.** All text inputs are ≥16px on mobile (prevents iOS focus zoom);
  touch targets are ≥44px (menu button) or enlarged (icon buttons to 34px, list
  rows padded). `viewport-fit=cover` in `index.html` plus `env(safe-area-inset-*)`
  padding keep content clear of the notch and home indicator. No horizontal
  overflow at 360px (the verse "+" button was pulled inside the row for this).

## Decision log

| Decision | Rationale |
|---|---|
| Web-first PWA, freeze Electron | One codebase runs everywhere; native returns only as a thin Capacitor/Tauri wrapper. Desktop frozen at `v1.2.1-electron-final` on `legacy/electron`. |
| Supabase (Postgres + RLS + email OTP) | Managed auth + row security + Postgres without running infra. Google OAuth links to the same account later via verified email. |
| Single `BereanApi` seam | One swap point for stub→Supabase; one home for the future offline outbox; components stay backend-agnostic. |
| Client UUIDs + client timestamps | Offline-sync readiness — clients mint valid rows without server round-trips. |
| `workspace_id` + membership + single RLS pattern from day one | Groups later is new rows only, no migration. |
| Static `book_number` (1–66), drop Books table | Book metadata is static and belongs client-side; removes a table and its bookkeeping. |
| BSB via helloao, cached forever in IndexedDB | Free, no key; immutable chapters cache indefinitely, so provider downtime doesn't affect reads. Provider interface keeps KJV/ESV addable. |
| `platform/` abstraction + pure-web rule | Keeps the code portable to native wrappers; nothing under `src/` touches Node/Electron. |
| Design-token layer (`src/assets/tokens.css`) | One source of truth for color/elevation/spacing/motion/type, consumed via `var()`. Default theme "Berean" (warm cream canvas + indigo accent + serif scripture) in `:root`; `body.dark` reassigns tokens (also warm-tinted, F1b). Live theme picker in Settings (`src/utils/useTheme.ts`, `[data-theme]` blocks in `tokens.css`) lets the user choose Berean / Scholarly Serif / Warm Paper / Quiet Modern independent of light/dark. Values chosen via a throwaway `design/mockup.html` compare-artifact + reading-UX/color research. F1–F4 (tokens, serif reading typography, contrast, motion) all landed, plus the note→study bridge and self-hosted scripture fonts closed out the sweep — see BACKLOG's Done section. Only cosmetic/optional polish (dark.css redundancy prune, elevation-over-borders consistency) remains, deliberately deferred past the first deploy. |
| Overlap-match on "Start study on {ref}" | Selecting verses that overlap an existing passage reopens it (with its notes) instead of always starting a blank study — interval overlap, not exact-range match, so a note anchored anywhere inside the selection surfaces. A step short of the deferred "multiple study instances" feature, which would let a user deliberately start a *distinct* new effort over already-studied verses. |

## Risks & mitigations

- **RLS correctness** — one policy pattern, verified with a second account
  attempting cross-access.
- **SQLite→Supabase migration fidelity** — tiny dataset; the migration script
  prints a before/after count-and-sample diff, and the legacy branch stays
  runnable as source-of-record until confirmed.
- **helloao dependency** — mitigated by the provider interface + cache-forever;
  self-hosting the BSB dump is a backlog fallback.
