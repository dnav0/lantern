# Backlog

Deferred work. This file is the single source of truth for it. **Rule:** whenever
an item is started, finished, or dropped, update this file in the same change —
move completed items to the bottom section, add a line when you defer something
new. Don't let it drift.

Items are roughly ordered by when they're likely to matter, not strictly
prioritized.

## Deferred

- **Offline write outbox.** Queue failed mutations locally and replay them on
  reconnect. The `BereanApi` seam is the single place this slots in — phase-1
  behavior (catch a failed write, show a friendly message) is the stub it
  replaces. Needs conflict handling and last-write-wins (or better) reconciliation
  given client-set timestamps.

- **Google OAuth.** Add alongside email OTP. Links automatically to the existing
  account via verified email, so no account-merge flow needed.

- **KJV + translation switcher.** Second `BibleProvider` implementation plus a UI
  to pick translation. The provider interface already exists for this; note
  versification papercuts across translations (verse numbers mostly line up).

- **User-key ESV provider.** `BibleProvider` implementation that takes a user's
  own ESV API key (licensing requires per-user keys). Settings UI to store it.

- **Groups / shared workspaces.** Create `kind = 'group'` workspaces and add
  members. The schema (`workspace_id`, `workspace_members`) and the single RLS
  pattern are already in place — this is new rows plus invite/role UI, no
  migration.

- **AI features over notes.** Summaries, thematic linking, question-answering
  across a user's own notes and passages. Needs an embedding/index strategy and a
  cost model.

- **Audio / TTS.** Read scripture and/or notes aloud. Lives behind `platform/` so
  a native wrapper can substitute a device TTS engine.

- **Full-Bible offline prefetch.** Optionally cache the entire BSB into IndexedDB
  up front, rather than lazily per chapter, for guaranteed offline reading.

- **Capacitor mobile wrap.** Package the web app as a native iOS/Android app
  reusing the same code. Platform capabilities (export, TTS) get native
  implementations behind their `platform/` interfaces.

- **Tauri desktop wrap.** Same idea for desktop, replacing the frozen Electron
  app. The web code is the source of truth.

- **Self-hosted BSB fallback.** Host the BSB dump ourselves so reads don't depend
  on `bible.helloao.org` availability. Cache-forever already blunts this risk;
  this removes it.

- **Paid tier considerations.** If/when hosting or AI costs warrant it: what's
  free vs paid, billing, quota enforcement. Design the free single-user
  experience so it never feels crippled.

## Done

_(move items here as they ship, with the phase/commit that landed them)_
