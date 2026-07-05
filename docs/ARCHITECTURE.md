# Architecture

## What this is

Berean is a single-user, web-first PWA for personal Bible-study notes, deployed on
Cloudflare Pages and backed by Supabase (Postgres + auth + RLS). It's a rewrite of
a local-only Electron desktop app. The desktop app carried its whole domain model
and pure-React UI through a single `window.api` bridge with zero direct Electron
imports in the renderer — that bridge is the seam the rewrite pivots on, so the UI
carries over nearly untouched and only the layer behind the seam changes.

## Shape of the app

The UI is a single React tree. `App.tsx` owns view state (which mode, which
passage/book is selected, editor state) and switches between:

- **Capture mode** — reference input + verse pane + note editor.
- **Reading mode** — a passage's notes against its verses, plus a Bible library
  and per-book chapter browser.

There is no router and no global store. State is local to `App.tsx` and passed
down; data comes exclusively through the `BereanApi` context.

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

Scripture access is a second interface (`src/bible/`, Phase 2):
`getChapter(bookNumber, chapter)` → `{ verse, text }[]`. BSB via
`bible.helloao.org` is the first implementation; KJV, or ESV-with-user-key, are
additional providers behind the same interface. A cache layer wraps any provider
and stores chapters in IndexedDB forever (chapters are immutable). Phase 0 fakes
scripture inside `memory.ts`.

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

- Reads work offline: an IndexedDB mirror of the user's notes plus the cached
  scripture chapters means the app opens and reads fully with no network.
- Writes fail gracefully: a failed mutation (detected by fetch failure, not just
  `navigator.onLine`) surfaces a non-blocking "you're offline, changes can't be
  saved yet" message; the UI stays usable read-only. A real write outbox is
  backlog, but the catch point is already the single `BereanApi` choke.
- Markdown export reuses the old vault serialization format, emitted as a zip via
  `platform/export.ts`.
- **iOS PWA note:** every cached thing is re-fetchable (scripture is immutable and
  re-downloadable; notes live in Supabase), so Safari storage eviction is an
  inconvenience, never data loss.

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

## Risks & mitigations

- **RLS correctness** — one policy pattern, verified with a second account
  attempting cross-access.
- **SQLite→Supabase migration fidelity** — tiny dataset; the migration script
  prints a before/after count-and-sample diff, and the legacy branch stays
  runnable as source-of-record until confirmed.
- **helloao dependency** — mitigated by the provider interface + cache-forever;
  self-hosting the BSB dump is a backlog fallback.
