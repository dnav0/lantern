# Lantern — working notes for contributors (human and AI)

Lantern is a personal Bible-study notes app. You read a passage, capture what you
see in it (observations, historical context, application, personal reflection),
and read those notes back later anchored to the verses. This is the web-first
rewrite; the old Electron desktop app is frozen on the `legacy/electron` branch.

**The app was renamed Berean → Lantern** (Psalm 119:105; "Berean" collided with
the Berean Standard Bible, the translation this app displays). The rename covered
user-visible strings and assets ONLY. **Internal `Berean*` identifiers are
deliberately unchanged** — `BereanApi`, `berean-api.ts`, `SupabaseBereanApi`, and
every persisted key (`berean.onboarded`, `berean-theme`, `berean-visual-theme`,
`berean-offline-mirror`, `berean-bible-cache`, and the default theme's stored id
`berean`). Renaming those would silently reset users' preferences and orphan their
cached data. Don't "tidy" them. The brand identity is wordmark-only — see
`src/components/Wordmark.tsx` for why every pictorial mark was rejected.

## Stack

Plain Vite + React 18 + TypeScript (strict). No framework, no router — the app is
a single-page tree with view state in `App.tsx`. Styling is hand-written CSS in
`src/assets/`. Backend is Supabase (Postgres + auth + RLS); scripture comes from
`bible.helloao.org`, cached in IndexedDB.

**All of that is built and LIVE** at [lanternword.com](https://lanternword.com)
(Cloudflare Pages, auto-deploying from `main`) — Supabase auth with Google OAuth
+ email OTP, real scripture, and the public landing/legal pages. The in-memory
stub (`src/api/memory.ts`) still exists and is still useful: with no
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the environment the app falls
back to it, so you can do pure-UI work with no backend by moving `.env` aside.
Keep `.env` in place when you need to exercise the real auth/data path.

## Hard rules

**Pure web only.** Nothing under `src/` may import a Node or Electron API
(`electron`, `fs`, `path`, `node:*`, `require(...)`, `window.electron`, etc.).
The whole point of this rewrite is that the same code runs in a browser, a PWA,
and later a Capacitor/Tauri shell. Platform capabilities that a native wrapper
would reimplement (file export, TTS) live behind `src/platform/` interfaces, not
inline. If you reach for a Node API, you are in the wrong layer.

**All data access goes through `BereanApi`.** Components never talk to Supabase,
`fetch`, or a global directly. They call `useApi()` (`src/api/context.tsx`) and
use the returned `BereanApi`. See the seam notes below.

**Keep the backlog honest.** `docs/BACKLOG.md` is the single source of deferred
work. Whenever you start, finish, or drop a backlog item, update that file in the
same change — move it out when done, add a line when you defer something new.
Don't let it drift.

## The two seams

Everything intentionally flexible about this app is expressed as one of two
interfaces. Understand these before changing data or scripture code.

### `BereanApi` — the data choke point (`src/api/`)

- `types.ts` — the interface. Evolved from the old Electron `window.api`: integer
  ids became UUID strings, the `Books` table became a static `book_number`
  (1–66) on `Passage`, and vault/updater/translation-settings methods were
  dropped.
- `context.tsx` — `ApiProvider` + `useApi()`. `useApi()` throws outside a
  provider so a missing wiring fails loudly.
- `memory.ts` — the in-memory stub. State lives in module maps and resets on
  reload. Seeds one sample passage so the app isn't empty. Still the fallback
  when Supabase env vars are absent, which makes it the fastest way to do pure-UI
  work.
- `supabase.ts` / `berean-api.ts` — the real, shipped implementation. It swaps in
  at the bootstrap with zero component changes, which is the whole point of the
  seam.

Because every mutation funnels through one object, the future offline write
outbox has exactly one place to live: a failed write is caught here and surfaced
as a friendly message today — that catch is the stub the outbox later replaces.
Cascade cleanup (delete note → delete empty session → delete empty passage) is
done explicitly in the implementation, mirroring the old desktop behavior.

### `BibleProvider` — the scripture source (`src/bible/`)

`getChapter(bookNumber, chapter)` → verses in the `{ verse, text }` shape
components already consume. `helloao.ts` implements BSB; a future ESV provider
takes a user API key; a cache layer wraps any provider (chapters are immutable,
so cache forever). The memory stub fakes this inside `memory.ts.getBibleVerse`;
in dev a `FixtureBibleProvider` bundles a few chapters so contributors without
network egress still see real verses (it tree-shakes out of production).

## Conventions

- Ids are client-generated UUIDs (`crypto.randomUUID()`); timestamps are
  client-set ISO strings. Both are deliberate — Tier-1 offline-sync readiness.
- Book identity is a USFM `book_number` (1 = Genesis … 66 = Revelation). All book
  metadata (names, aliases, chapter counts) lives in `src/utils/bibleBooks.ts`.
  There is no books table anywhere.
- Note categories are a closed set: `observation | historical | application |
  personal`. Sub-notes are just notes with `indent_level > 0`.
- Strict TS: `noUnusedLocals`/`noUnusedParameters` are on. Two-space indent,
  single quotes, no semicolons where the linter allows — run `npm run format`.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc --noEmit` then production build
- `npm run lint` / `npm run format`

## Layout

`src/App.tsx` holds view state and routing between capture/reading modes.
`src/components/` is the UI. `src/api/` is the data seam. `src/utils/` is pure
logic (book metadata, note parsing, rich-text serialization, dark mode). Design,
schema, and the decision log live in `docs/ARCHITECTURE.md`; deferred work in
`docs/BACKLOG.md`. The original phased migration (scaffold+stub → Supabase →
scripture → mobile UI → PWA/offline → deploy) is complete; the app is live, so
`docs/BACKLOG.md` is now the map of what's left rather than a phase plan.
