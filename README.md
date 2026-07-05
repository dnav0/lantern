# Berean

A quiet place to study Scripture: read a passage, capture what you see in it, and
read your notes back later anchored to the verses.

Berean is a personal Bible-study notes app. You work in two modes:

- **Capture** — load a passage's verse text and write notes beside it. Notes can
  anchor to a verse (`v3`), carry a category tag (`@observation`, `@historical`,
  `@application`, `@personal`), and reference other passages inline
  (`John 1:1`). Indent a line to make it a sub-note.
- **Reading** — browse your notes by passage or by book, laid out against the
  verses they anchor to.

## Status

This is the web-first rewrite, in progress. It's a Progressive Web App backed by
Supabase, designed to run on the phone as easily as the desktop. The original
Electron desktop app is frozen on the `legacy/electron` branch (tag
`v1.2.1-electron-final`) and is not coming back — future native builds will wrap
this same web code (Capacitor for mobile, Tauri for desktop).

Right now the app runs entirely on an in-memory stub: the full UI works, data
lives in memory and resets on reload. The backend, real scripture, mobile layout,
and offline support land in subsequent phases (see `docs/ARCHITECTURE.md`).

## Run it

Requires Node 18+.

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build to dist/
npm run lint
npm run format
```

## Deploy

Hosted on Cloudflare Pages, auto-deploying from `main`:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`public/_redirects` sends all paths to `index.html` (SPA fallback). The app is
a PWA (`vite-plugin-pwa`, autoUpdate service worker) — installable on Android
Chrome and other browsers that support the install prompt.

## Where things are

- `src/App.tsx` — top-level view state and mode switching
- `src/components/` — UI
- `src/api/` — `BereanApi`, the single data seam (in-memory stub for now)
- `src/utils/` — book metadata, note parsing, rich-text helpers
- `docs/ARCHITECTURE.md` — design, target schema, decision log
- `docs/BACKLOG.md` — deferred features
- `CLAUDE.md` — conventions and the rules that keep the codebase portable

## License

See `LICENSE`.
