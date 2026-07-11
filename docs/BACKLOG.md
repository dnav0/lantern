# Backlog

Deferred work. This file is the single source of truth for it. **Rule:** whenever
an item is started, finished, or dropped, update this file in the same change —
move completed items to the bottom section, add a line when you defer something
new. Don't let it drift.

Items are roughly ordered by when they're likely to matter, not strictly
prioritized.

## Deferred

- **Design sweep — remaining work.** The static visual/structural polish pass
  is done: token layer (F1 + F1b warm dark), serif reading typography (F2),
  contrast (F3), top-bar/library true centering, the theme picker, the
  overlap-aware study flow, and a round of mobile study-editor/nav fixes (see
  Done, below, for the full history). What's left, roughly in likely order:

  - **F4 — motion layer.** Entrance/press/spring micro-interactions using the
    already-defined `--ease-*`/`--dur-*` and `--elev-*` tokens, all behind
    `prefers-reduced-motion` (see `design/mockup.html` for the target feel).
    This is the next planned pass. Candidate within it: a command-palette-style
    expand-on-focus for the desktop top-bar search (subtle at rest, more
    prominent/centered while actively focused — the "/" shortcut trigger and
    resting `--elev-1` shadow already ship; the focused-state expansion is the
    motion-heavy part deliberately left for here).
  - **Mobile nav priority — mechanism still unresolved.** Discussed as Bible =
    home/does-everything (full weight), Journal = rarely used, Study = the
    primary action, Profile = rarely used. Two mechanisms were tried and both
    reverted on review: an opacity de-emphasis on Journal/Profile ("not a good
    strategy"), and two different special icon treatments for Study (accent
    color, then a filled badge — both read as "strange," an odd-one-out among
    otherwise-consistent line icons). Currently all four mobile tabs are
    visually uniform again. Needs a fresh approach, not another iteration on
    color/shape-of-icon — worth revisiting once the motion pass exists, in case
    subtle motion (not static color/shape) is the better differentiator.
  - **Bible/Journal navigation: toggle vs. tabs — discussed, not decided.**
    Considered a segmented-control toggle (like Claude desktop's Home/Code) for
    Bible/Journal instead of flat tabs, to reduce perceived cognitive load and
    reinforce "one system, two lenses onto the same notes." Working recommendation from
    that discussion: don't adopt it — Bible and Journal aren't symmetric peers
    (Journal is documented as "a librarian, not the front door," Bible is the
    deliberate home), and a toggle's "two equal, mutually-exclusive modes"
    framing would misrepresent that. Left genuinely open rather than closed —
    revisit if the mobile-nav-priority work above doesn't resolve the
    underlying "feels like too many equal-weight options" concern.
  - **Note→study "Open study" bridge in `BookDetailPage`'s ChapterView.** Still
    not built (see the dedicated entry below) — `ChapterView` now loads the
    book's `Passage[]` (added for overlap-matching), so the data dependency
    that blocked this is gone; only the button/wiring is left.
  - **Self-host the scripture fonts.** `index.html` currently loads Source Serif 4
    + Newsreader from Google Fonts (Georgia fallback keeps reading graceful
    offline). For full offline/privacy, self-host the woff2s (e.g.
    `@fontsource/source-serif-4`, `@fontsource/newsreader`) and drop the external
    `<link>`; add to the SW precache.
  - **dark.css redundancy prune (cosmetic).** `dark.css` is now fully token-driven
    and consistent, but many of its `body.dark …` rules only restate a value the
    `tokens.css` `body.dark` reassignment already produces. They're harmless but
    could be deleted to shrink the file. Low priority.
  - **Elevation-over-borders + cross-surface max-width polish.** Optional refinement:
    apply the `--elev-*` scale to reader/journal/study cards (currently border-led)
    and reconcile the library vs. journal vs. book-detail max-widths for a fully
    consistent measure across every page. Rolls naturally into the motion pass.

- **Modifier-to-copy verse text (marquee escape hatch).** Desktop verse
  selection is now a Windows-style marquee (click-drag draws a box that selects
  the verses it covers), which deliberately takes over click-drag from native
  browser text selection over verse text — the user chose selection over copy.
  A future refinement: hold a modifier (e.g. Alt or Ctrl) on pointerdown to
  suppress the marquee for that gesture and let native text selection/copy
  happen. The hook (`src/utils/useVerseMarquee.ts`) already branches on
  pointerdown, so this is a guard on `containerPointerDown` plus a visible hint,
  no state-model change.

- **Offline write outbox.** Queue failed mutations locally and replay them on
  reconnect. The `BereanApi` seam is the single place this slots in — phase-1
  behavior (catch a failed write, show a friendly message) is the stub it
  replaces. Needs conflict handling and last-write-wins (or better) reconciliation
  given client-set timestamps.

- **Custom SMTP for OTP code emails.** Supabase's default email template contains
  only a magic link — the 6-digit code requires adding `{{ .Token }}` to the
  template, which is gated behind custom SMTP (e.g. Resend free tier + a sender
  domain). Until then `detectSessionInUrl: true` accepts the link as the sign-in
  path; the code-entry UI in `SignIn.tsx` already works the moment the template
  includes a code. Revisit before any native wrapper (links are fragile there).

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

- **Scripture full-text search (verse-text search).** Search v1 (UX overhaul,
  workstream 6) only *parses* a query into a reference jump ("mat 2:13" →
  Matthew 2) via `parseScriptureQuery`; it does NOT search the words of
  scripture. Searching verse text depends on having the full BSB available to
  index (the Full-Bible offline prefetch item above) plus a client-side index
  strategy. Deferred deliberately.

- **Multiple study instances over the same verses.** The studies-model milestone
  settled that notes are verse-anchored and the reading view is cumulative, while
  a "study" is one effort (a `Passage`). A future step adds a lightweight
  `study_id` group stamp on notes so a user can deliberately start a *new,
  distinct* study instance over verses they've already studied (chosen/selected),
  and so the editor can optionally merge notes from other efforts by anchor
  overlap. This is the one part of the model that needs a schema touch (a nullable
  column) — deliberately deferred out of the presentation-only milestone.

- **Postgres full-text index for note search.** `SupabaseBereanApi.searchNotes`
  is a case-insensitive `ilike '%q%'` scan (v1, acceptable per the plan). For
  larger workspaces, replace with a `tsvector` column + GIN index and
  `websearch_to_tsquery` — a schema/migration change, hence deferred. The
  `BereanApi.searchNotes` seam and both implementations already exist, so this is
  purely an implementation swap behind the interface.

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

- **Note→study bridge in the chapter reading view.** `ReadingMode` (saved-passage
  view) now always shows "Open study" on its notes, wired through the WS1
  unified `handleOpenStudy` path (Studies & Notes model, workstream 2). Notes
  rendered inside `BookDetailPage`'s ChapterView (the Bible home reader) still
  don't have an "Open study" button — out of scope for workstream 2, which only
  touched the gesture/bridge in the two surfaces named above. The main blocker
  is gone, though: `ChapterView` now loads the book's `Passage[]`
  (`bookPassages`, added for the overlap-matching fix below) alongside its
  notes, so resolving a given note to its passage id is now a straightforward
  lookup rather than a missing-data problem — adding the button itself is what's
  left.

- **Modifier to restore verse-text copy under the marquee.** The desktop marquee
  suppresses native text selection over verse text (drag = box-select). Add a
  modifier (or an explicit select mode) so users can still drag-copy verse text.

## Done

- **Library spacing correction, mobile nav priority reverted, mobile study
  empty-state.**
  - **Library grid was still cramped** after the max-content column fix — the
    real culprit turned out to be `row-gap: 1px` (rows nearly touching) plus
    tight `.bible-book-row` padding, not just the column gap. Row-gap raised to
    4px, row padding 5px/8px → 7px/10px, column gap 64px → 88px (a second, larger
    pass after 64px still read as tight).
  - **Mobile nav priority (opacity de-emphasis on Journal/Profile) reverted.**
    Didn't land as a good strategy on review — removed the `nav-tab-low` class
    and its CSS entirely. The underlying priority question (Bible = home,
    Journal = rare, Study = action) is unresolved and left for a fresh pass
    later rather than iterating further on this mechanism now.
  - **Mobile Study empty-state scripture panel.** Before any reference was
    committed, the pinned panel still reserved its full ~34vh peek height to
    show placeholder copy ("Type a reference...") that sat in a spot the user
    isn't actually meant to interact with — the real input is the reference
    field below. It now collapses to just the header bar
    (`.study-right--empty`, keyed off `!passage && !loadingPassage`) with the
    "Tap to expand" hint/chevron hidden (nothing to expand yet) and the
    toggle inert; it grows to the normal peek at the exact moment a reference
    loads, which is a direct, expected result of the user's own Enter press,
    not a surprise pop-in.
  - **"Press Enter or Tab..." hint is desktop-only copy now** — "or Tab" only
    makes sense with a physical keyboard. Split via `.hint-text-desktop`/
    `.hint-text-mobile` at the existing mobile breakpoint, mirroring how the
    rest of the app splits responsive copy (no UA sniffing).
  Verified live at 2000px and 390px: library spacing looks open rather than
  cramped, mobile nav is back to uniform weight across all four tabs, the
  empty scripture panel collapses correctly and expands the moment a valid
  reference loads. Build clean.

- **Mobile study editor, blank-save guard, existing-note timestamps, mobile
  nav priority.**
  - **Note editor's chip row no longer causes "moving dead space."** It was
    `position: sticky` inside `.notes-list`'s own scroll box — sticky only
    holds an element at an edge once scrolling would carry it past that edge,
    so with just a couple of short lines it sat in normal flow right after
    them, and the gap before the Save buttons changed size as you typed.
    Restructured `NoteEditor` to return the chip row as a true flex sibling of
    `.notes-list` (not its last scrolled child) — it now has a fixed position
    directly above `.study-actions`; the notes list scrolls independently in
    whatever space remains above it.
  - **Blank-study save guard.** Saving a brand-new study with a reference typed
    but zero real note lines silently created an empty `Passage`+`Session` — a
    dead Journal entry with nothing in it. Both Save buttons are now disabled
    (with an explanatory `title`) when there's no note content AND no
    `initialPassageId` — editing an *existing* study down to zero notes is left
    alone, since that's a legitimate delete-the-study action that should
    correctly cascade-delete the now-empty session/passage.
  - **Existing-note timestamps in the editor.** At scale, it's easy to lose
    track of what you just typed this session vs. what was already there. A
    note line now shows a subtle "saved Xh ago" (reusing the established
    `formatRelativeTime`/`.note-timestamp` pattern from `ReadingMode`'s note
    cards) — but ONLY while its content still exactly matches what's actually
    persisted; the moment you edit it, the stamp disappears, since showing
    "saved" on since-changed content would be misleading. Its *absence* is
    itself the "new or changed this session" signal. `NoteEditor` gained an
    `existingNotes` prop (the same `Map<string, Note>` `StudyMode` already
    hydrates from).
  - **Library grid gap widened** (40px → 64px) — tighter, content-hugging
    columns (from the earlier max-content fix) needed more breathing room
    between them or adjacent names read as cramped.
  - **Mobile nav: reverted the Study icon to a plain line icon**, matching
    Bible/Journal/Profile's style. Two prior special treatments (accent color,
    then a filled badge) both still read as "off" — an odd-one-out among
    otherwise-consistent icons draws the eye for the wrong reason, and kept
    causing more issues than it solved. Priority is now communicated by
    opacity alone: Bible stays full weight (the "does everything" home); Journal
    joins Profile at `opacity: 0.72` at rest (both visited rarely, per
    discussion), returning to full weight when actually active — same
    established mechanism, no new visual language.
  Build (`tsc --noEmit` + vite) clean throughout; verified live at 2000px and
  390px, light + dark — including the overlap-matched existing-note timestamp
  showing correctly and disappearing on edit, and the disabled Save state.

- **Start-study overlap matching + a round of mobile/library follow-up fixes.**
  - **"Start study on {ref}" / "Study chapter" now reopen an existing passage**
    when one overlaps the selected verses, instead of always starting blank.
    `BookDetailPage` now loads `getPassagesByBook` alongside notes
    (`bookPassages`, threaded into `ChapterView`); a new
    `findOverlappingPassage` (interval overlap, not exact-range match — a note
    anchored anywhere inside the selection should surface, per discussion) finds
    a match, and its own `reference_label` (not the freshly-dragged selection)
    is passed alongside `passageId` so `StudyMode` — which only ever reads the
    reference from the passage-id fetch once one is set — doesn't race between
    two different scripture ranges. Verified live: selecting verses inside the
    seeded "John 1:1-5" passage reopens it with its existing note loaded;
    selecting outside it still starts blank. `onStudy`/`onStudyChapter` signatures
    threaded an optional `passageId` from `ChapterView` → `BookDetailPage` →
    `App.tsx`'s existing `handleStudyFromReading(reference, passageId?)`. Also
    unblocks most of the "Note→study bridge in ChapterView" deferred item (see
    Deferred) — the passage data it needed is now loaded.
  - **Library grid: content-hugging columns.** Fixed-width columns
    (`minmax(0, 230px)`) were still wider than most book names, so the
    left-aligned text's per-column trailing whitespace dragged the grid's visual
    center left of its geometric one (~120px off on a wide screen). Switched to
    `minmax(0, max-content)` so each column shrinks to its own longest name;
    measured text-mass center is now within 6px of true center (was ~120px).
  - **Mobile top-bar search icon was rendering dead-center**, not right-aligned.
    Root cause: `.topnav-tabs` is `display:none` on mobile, and CSS Grid removes
    `display:none` items from the grid entirely — auto-placement then packed the
    remaining visible children (`.topnav-lead`, `.topnav-right`) into columns 1
    and 2 of the `1fr auto 1fr` template instead of 1 and 3. Fixed by giving each
    child an explicit `grid-column`, confirmed via `getBoundingClientRect` (the
    middle "auto" track measured exactly 34px — the button's own width — before
    the fix).
  - **Mobile "+ Study" tab redesigned.** The badge was accent-colored, which is
    also this app's "active/selected" language everywhere else, so it looked
    permanently "selected" regardless of which tab was actually active — a
    second correction after the first pass (which only fixed a doubled "+" and
    moved the color from label to icon, not the underlying color-reuse problem).
    Now differentiated by SHAPE (a filled neutral-ink circle, fixed colors not
    `currentColor`) instead of color, so "this is the compose action" and "this
    is the current page" stay two independent signals; the label follows the
    exact same muted/accent active-state rule as its siblings. Mobile label
    changed to plain "Study" (the badge already carries the "+"); desktop's
    text-only "+ Study" pill is unaffected. Profile — the lowest-priority of the
    four mobile tabs (an occasional account destination, not primary content or
    the primary action) — now sits at `opacity: 0.72` at rest, full weight when
    actually active.
  - **StudyMode passage-pane empty-state copy** said "Type a reference above,"
    which was directionally wrong on desktop (the field is beside the pane, not
    above it) and backwards on mobile (the pinned scripture panel sits ABOVE the
    reference field). Reworded to drop the directional claim.
  - **Mobile note editor had an oversized reserved bottom padding** (180px) on
    `.notes-list`, inherited from before the app had dynamic keyboard-aware
    scrolling (`scrollLineIntoView`'s `keyboardAware` mode, `NoteEditor.tsx`,
    already handles actual keyboard-open clearance via `visualViewport`) — with
    only a line or two of notes typed, that static reservation read as "the
    note box is tiny" above a large dead gap. Trimmed to 64px.
  - **Verse-tag auto-scroll in the passage pane.** Tagging `vN` in a note now
    scrolls that verse into view within the (often bounded/collapsed-on-mobile)
    scripture panel if it's out of view — `data-verse` attributes on
    `PassagePane`'s rows, `scrollIntoView({block:'nearest'})` scoped to the
    panel's own scroll container (never scrolls the whole page), triggered from
    `StudyMode`'s existing `handleCursorLine`.
  Build (`tsc --noEmit` + vite) clean throughout; verified live at 2000px and
  390px, light + dark.

- **Top-bar true centering + search/mobile-nav polish.** Fixed a real
  centering bug: `.topnav-tabs` used `flex:1; justify-content:center`, which
  centers tabs in the *leftover space* between the logo (left) and
  search-box+avatar (right) — correct only if both sides are equal width.
  They weren't (search box + avatar > logo), so the tabs sat visibly left of
  the true viewport center, exactly as flagged from a live screenshot. Fixed
  by switching `.topnav` to `display:grid; grid-template-columns: 1fr auto
  1fr` and grouping the search box/button + avatar into one `.topnav-right`
  wrapper (new, in `NavBar.tsx`) so the two outer columns are forced equal —
  tabs now land within 0.01px of true center (verified via
  `getBoundingClientRect`), independent of the two sides' own content width.
  Alongside that:
  - **"/" search shortcut** (desktop top-bar only): `GlobalSearch` listens for
    `/` on `window` and focuses its input, ignoring it while already inside an
    editable field (input/textarea/select/contenteditable) or with a modifier
    held. A `/` `<kbd>` hint renders in the box at rest (hidden once there's a
    query) signaling the shortcut, Notion/Linear/GitHub-style. The always-on
    desktop search box also got a touch more visual weight (`--elev-1`
    resting shadow) — deliberately NOT promoted to a hero/landing element
    (see discussion: a study app's front door should invite reading, not
    priming lookup-and-leave search-engine behavior — the Bible library stays
    the deliberate landing surface).
  - **Mobile search button visibility.** It was `background: transparent`
    sitting on the header's own `--surface-2` background, so it visually
    disappeared into its own container — the literal cause of "hard to
    notice." Given a distinct `--surface` fill, hairline border, and resting
    shadow so it reads as a real tappable chip.
  - **Mobile "+ Study" tab.** The `nav-tab-action` class was already applied
    (shared `navTab()` helper) but had no bottom-nav-scoped styling. Added a
    light-touch treatment — permanently accent-tinted icon/label + slightly
    bolder label — at the *same* size/shape/position as the other three tabs
    (still one of four equal `flex:1` columns, no pill or badge), so it
    signals "this one's an action" without breaking the bottom bar's visual
    rhythm the way the desktop pill treatment would have.
  - **Font-size bump.** Top-bar nav tabs 13→14px, library/book-detail page
    titles 22→24px, library book names 14→15px, per a legibility pass against
    a real desktop screenshot.
  Verified live at 2000px and 390px, light + dark. Build clean. No
  schema/`BereanApi` change.

- **Page-shell centering on wide viewports (two passes).** The Bible Library and
  the book/chapter view (`BookDetailPage`) had no max-width, so on wide monitors
  their content pinned to the left edge with a large dead right margin. First
  pass added a shared `--shell-max` token (`tokens.css`) and centered
  (`max-width` + `margin: 0 auto`) the library header/testament sections and
  `BookDetailPage`'s header + chapter-pill row (new `.book-detail-header-inner` /
  `.chapter-selector-wrap-inner` wrapper elements so section-divider borders
  stay full-bleed while their content centers) — initially at 1180px, on the
  theory of a wide "masthead" over a narrower reading column. **Live feedback
  correction:** that still looked off — a left-aligned block (page title, a
  pill row, a grid) inside an *overly wide* centered box still reads as
  left-anchored, because the eye tracks the ragged content edge, not the
  invisible box; centering the container without the content filling it just
  relocates the dead space rather than removing the asymmetry. Fixed by
  shrinking `--shell-max` to 920px (a snug column, Notion/Basecamp-style,
  rather than a separate wide masthead width) and adding
  `justify-content: center` to the chapter-pill row specifically, since a short
  pill cluster (e.g. a 21-chapter book) is much narrower than even a 920px box
  and otherwise clusters left within it — verified this doesn't break the
  horizontal-scroll case for long books (Psalms, 150 chapters). The with-rail
  reading-column widths (`.book-chapter-content`, `.reading-content` when a
  margin rail is present) were also pulled in from 980px/1020px to 940px so
  they don't exceed the shell. Also tokenized two inline-style color literals
  found in `BookDetailPage.tsx` (`#7F77DD`→`var(--accent)`,
  `#BBB`→`var(--text-faint)`) missed by the earlier CSS-only migration since
  they lived in TSX, not a stylesheet. **Third correction:** the library grid
  itself still read left-skewed after the shell fix, because
  `.bible-books-grid` used `repeat(3, 1fr)` — equal-fraction columns much wider
  than the (short, left-aligned) book names, so each column's visual "ink"
  clustered toward its own left edge with a large empty trailing gap, worst in
  the rightmost column. The section box was centered, but its content wasn't,
  so the block still read left-heavy. Fixed by sizing columns to content
  (`repeat(3, minmax(0, 230px))`) and centering the column group itself
  (`justify-content: center`) — the "OLD/NEW TESTAMENT" divider stays at the
  shared shell width above it, while the names now form a tighter, genuinely
  centered block within it. No wrapping on the longest names (Song of Solomon,
  1/2 Thessalonians) at this column width. **Fourth correction:** that still
  left the "OLD/NEW TESTAMENT" label (and its divider rule) at the wider shell
  width while the grid beneath had become narrower, so the label no longer
  lined up with "Genesis" underneath it — the same mismatch one layer up.
  Rather than keep two different widths in play, gave the library page its own
  snug content width computed directly from the grid's own sizing
  (`--library-content-w: calc(3 * --library-col-w + 2 * --library-col-gap)`,
  scoped as CSS custom properties on `.bible-library`) and applied it to the
  header, testament label, and grid alike — one consistent, aligned column, not
  the shared (wider) `--shell-max` used by `BookDetailPage`. Verified live at
  2000px, light + dark: "OLD TESTAMENT" and "Genesis" now share the same left
  edge, the divider matches the grid's width exactly.

- **Theme picker in Settings.** Users can now choose a visual theme independent of
  light/dark mode: **Berean** (default, warm cream + indigo), **Scholarly Serif**
  (paper-white, quiet), **Warm Paper** (cream + amber, Newsreader scripture), and
  **Quiet Modern** (cool near-white, sans-serif scripture — the one direction that
  deliberately doesn't use a serif reading face). `src/utils/useTheme.ts` (mirrors
  `useDarkMode.ts`'s pattern) sets `data-theme` on `<html>` and persists to
  localStorage (`berean-visual-theme`, independent of the existing `berean-theme`
  light/dark key). `tokens.css` gained `[data-theme="…"]` light blocks plus dark
  variants scoped as `html[data-theme="x"] body.dark` — a descendant selector that
  out-specifies the generic Berean-dark `body.dark` block with no `!important`, so
  light/dark and theme compose correctly in all 8 combinations. `SettingsModal`
  renders a 4-row swatch picker (each row previews its *own* theme's canvas/accent
  colors so all four are comparable regardless of which is active), threaded through
  `App.tsx` alongside the existing dark-mode toggle. Newsreader font added to
  `index.html` alongside Source Serif 4 (Warm Paper needs it). Verified live:
  switching themes re-themes the whole app instantly, persists across reload, and
  each theme × dark mode renders correctly with no cross-theme color bleed. Build
  clean. No schema/`BereanApi` change.

- **Design-token layer (F1 — foundation of the visual polish pass).** Introduced
  `src/assets/tokens.css` (imported first in `main.tsx`, before `main.css`/`dark.css`)
  as the single source of truth for color, elevation, spacing, radii, motion, and
  scripture type. `:root` holds the research-backed **"Berean"** default — a warm
  cream reading canvas (`--bg #f4f0e8`), near-white surfaces, indigo accent
  (`--accent #6b62d6`, decoupled from the warm canvas because amber reads as
  "warning" as a primary UI accent), the four note-category hues, a soft layered
  `--elev-*` scale, and `--ease-*`/`--dur-*` motion tokens. `main.css`'s raw color
  literals for the **unambiguous** families were rewired to `var()`: accent + tints,
  category colors, page backgrounds (`#fafafa`/`#f7f6f3`→`--bg`), subtle fills
  (→`--surface-2`), borders (→`--border`), and primary ink (`#1a1a1a`→`--text`).
  Deliberately **left as literals for later** (see Deferred): `#fff` (contextual) and
  the gray-text ramp, plus the legacy `.welcome-*` navy (frozen desktop screen).
  `body.dark` reassigns the tokens to values **matching the app's existing cool dark
  palette**, so dark mode is unchanged by F1 while light mode adopts the cream+indigo
  canvas; the warm-tinted Berean dark + `dark.css` collapse is the deferred F1b step.
  A `[data-theme]` seam is documented in `tokens.css` for the future Settings theme
  picker. Direction chosen from `design/mockup.html` (a throwaway token-swap artifact
  comparing four directions), backed by reading-UX/color-psychology research. Build
  (`tsc --noEmit` + vite) clean; verified live in a real browser at 1280px, light +
  dark, on the reader/library/study surfaces — `--bg` resolves to `#f4f0e8`, accent
  to `#6b62d6`, dark mode visually identical to pre-F1. No schema/`BereanApi`/
  component change — CSS-only.

- **Post-sweep fixes: action-bar contrast bug + wider reading column.** Live
  testing caught a migration bug: `.verse-action-btn` ("Start study on {ref}")
  had `color: var(--surface-2)` — text mistakenly mapped to a background token,
  rendering it near-invisible (light-on-light) in the verse-selection floating
  bar. Fixed to `var(--text)` on a `var(--surface-2)` fill, plus tokenized the
  bar's remaining literals (`--border`, `--elev-3`). Swept `main.css`/`dark.css`
  for the same `color: var(--surface*)` pattern — no other instances. Also
  widened the desktop reading column (`.reading-content` 680→760px,
  `.book-chapter-content` 640→720px, their no-rail-widened variants +40px each)
  per feedback that scripture felt narrow on desktop. Verified live, light +
  dark; build clean.

- **Design polish sweep (F2/F3/#4/#6/F1b — static pass on the F1 token layer).**
  The visual/interaction quality pass on top of the token layer, everything up to
  (but not including) the F4 motion pass:
  1. **F2 reading typography.** Scripture is now the hero: `.verse-text` (shared by
     `ChapterView`, `ReadingMode`, and the StudyMode passage pane) renders in the
     serif reading voice (`--scripture-font` Source Serif 4, ~19px, `--scripture-lh`
     1.72) in **primary ink** — previously it was 13px sans in `--text-muted`, dimmer
     and smaller than the UI chrome. Verse numbers baseline-align as small print-style
     markers. Passage pane dialed to 16.5px. Font loaded in `index.html` (Georgia
     fallback; self-host backlogged).
  2. **Note-card weight (#4).** Inline notes went from a filled gray box to a
     transparent, category-ruled **annotation** (left border + label + verse chip),
     so notes read as marginalia against the Word. Reader column centering (`.no-rail`)
     was already correct.
  3. **Full color tokenization (F3 groundwork).** `main.css` + `dark.css` raw hex
     migrated to `var()` — including the `#fff` (contextual surface vs on-accent) and
     gray-ramp cases F1 had deferred. Every `var()` resolves to a `tokens.css` token;
     build + undefined-token checks clean.
  4. **F3 contrast.** `--text-muted` darkened to ~4.8:1 on cream (was ~3.8:1, below
     AA); **library book names** promoted from `--text-muted` to primary `--text`
     (they were ghosted). Added a UI **type scale** (`--text-xs…2xl`) to `tokens.css`.
  5. **UX (#6).** `+ Study` is now a distinct accent **action pill** (via a
     `nav-tab-action` class) rather than looking like a third destination tab; the
     `?` top-right is the account-menu avatar (placeholder initial in the stub), left
     as-is.
  6. **F1b warm dark.** `body.dark` tokens flipped to the warm-tinted Berean dark;
     the remaining legacy cool dark literals in `main.css` `body.dark` chrome blocks
     (nav menu, settings modal, toasts) tokenized so dark mode is cohesively warm with
     no cool/warm clash. `dark.css` was already fully token-driven.
  Frozen `.welcome-*` navy and the danger/amber-alert schemes left as literals
  (no semantic token yet). Build (`tsc --noEmit` + vite) clean throughout; verified
  live at 1280px on reader/library/study/settings, **light + dark**. CSS/token +
  one NavBar class + `index.html` font link; no schema/`BereanApi`/data change.
  Direction from `design/mockup.html` (throwaway compare-artifact) + reading-UX/
  color research. Remaining design work (F4 motion, font self-host, theme picker)
  is in Deferred.

- **Reading-view interaction hardening.** Five fixes to the study-Bible reading
  layout (`BookDetailPage` ChapterView + `ReadingMode`), from live testing across
  three commits (`30854f2`, `18573dc`, `de054fd`):
  1. Range-note rail brackets now span their full verse range — the `.rail-note`
     grid item fills its `grid-row` span via `align-self: stretch` (the grid's
     `align-items: start` had shrunk it to content height, so the bracket only
     covered the note text).
  2. Overlapping range notes get side-by-side lanes via greedy interval coloring
     (`assignRailLanes`, `LANE_STEP`).
  3. Note-highlight (`highlightedVerses`/`highlightedNoteIds`) and range
     selection (`selAnchor`/`selFocus`) are mutually exclusive and fully
     clearable — a plain click on empty scripture whitespace and Escape both
     clear everything, and the stale `onMouseEnter` hover-highlight was removed.
  4. The marquee drag origin moved twice: first from `.scripture-grid` to the
     centered reading column (`30854f2`), then to the full-width surface around
     it — `.reading-layout` in `ReadingMode`, a new `.chapter-marquee-surface`
     wrapper in `ChapterView` (`18573dc`) — so a drag can start in the side
     margins outside the centered column, not just inside it.
  5. The marquee hit-test now requires the drag box to overlap a verse row on
     BOTH axes, not just vertically (`de054fd`) — previously a box drawn
     entirely in the side whitespace, at the same height as some verses but
     never crossing their text, still selected them, because verses were
     effectively treated as spanning the full width. `hitTest` now also checks
     horizontal overlap and clears the selection when the box hits no rows.
  Also (`de054fd`): mobile range notes (no rail there) now render inline right
  after their LAST anchored verse instead of stacking at the bottom of the whole
  chapter — `.mobile-range-notes` replaces the old bottom `.mobile-note-stack`,
  keyed per-verse via `mobileRangeByVerse`, styled light + dark. Build/test/lint
  clean; verified live in a real browser (puppeteer-driven pointer sequences,
  not synthetic `dispatchEvent` alone) at both desktop and 390px, light + dark,
  on both surfaces.

- **Marquee (box) verse selection (desktop).** Replaces the earlier
  gutter-only click-drag (retired `useVerseDragSelect`) with a Windows-style
  marquee: `useVerseMarquee` (`src/utils/useVerseMarquee.ts`), used by both
  `ReadingMode` and `BookDetailPage`'s ChapterView, without touching
  `selAnchor`/`selFocus` ownership (the hook only calls back into it).
  `onPointerDown` on the `.scripture-grid` container begins a drag *unless* it
  lands on an interactive child (`button, a, input, textarea, [contenteditable],
  [data-no-drag]`); it tracks a rectangle from the start point to the current
  pointer, renders a subtle accent-tinted overlay (`.verse-marquee`, dark-mode
  variant in `dark.css`), and hit-tests every registered verse row via
  `verseRowRefs` — any row whose `getBoundingClientRect` overlaps the box
  vertically is selected, and `min..max` of those verse numbers drives the same
  selection state as the tap gesture, so the floating action bar ("Quick note"
  primary / "Start study on {ref}") appears and works unchanged. On `pointerup`
  the overlay is removed and the range is committed. **Tradeoff (user-chosen):**
  click-drag over verse text now marquee-selects instead of doing native
  text-copy; native selection is suppressed for the duration of a drag
  (`document.body` `user-select: none`, restored on release) and the initiating
  `pointerdown` is `preventDefault`ed. A modifier-to-copy escape hatch is
  backlogged (see Deferred). **Stale-state guards** (learned from the prior
  gutter-drag "selection drops to 0" bug): per-gesture refs
  (`dragMoved`/`justDragged`/rects) reset at the START of every `pointerdown` so
  nothing leaks across gestures; a small `DRAG_THRESHOLD` keeps an accidental
  micro-move from being read as a drag (so a plain click still falls through to
  tap-anchor/tap-extend); `suppressNextClick()` is a one-shot consume that
  swallows exactly the one trailing `click` a real drag emits (whichever element
  it lands on) so a stray post-drag click can never clear the just-made range.
  Touch (`pointerType === 'touch'`) and non-primary buttons are ignored — the
  tap gesture is untouched. Listeners are window-scoped and cleaned up on
  unmount; `pointercancel` ends the drag like `pointerup`. Verified against a
  manually-started `vite --port 5238 --strictPort` (with `.env` moved aside per
  the memory-stub convention) at 1280px (light + dark) and 390px, driving a real
  pointer sequence through the actual verse elements on BOTH surfaces: a visible
  box appears, the covered verses select, the action bar shows the correct
  `{ref}` (e.g. `John 3:1-4`, `John 3:3-5`), a plain tap immediately after a
  marquee correctly extends the range (no stale suppression), and a
  single-verse-only chapter shows `.scripture-grid.no-rail` (centered column,
  no rail). No schema or `BereanApi` change.

- **Note placement by anchor width (inline vs rail).** Refinement of the margin/
  span-notes layout below, from live user testing: verse-anchored notes are now
  split by how many verses they span. **Single-verse notes** (`anchor_start_verse
  === anchor_end_verse`, or `anchor_end_verse` null) render **inline beneath their
  verse row** (an `.inline-verse-notes` group in the scripture column), with their
  indented sub-notes inline too — the way inline notes read before the
  margin-rail change. **Multi-verse range notes** (`anchor_end_verse >
  anchor_start_verse`) keep the right-hand rail with the category bracket spanning
  the anchored rows (the grid-row mechanism below). **Anchorless notes** stay
  passage-level (top block, never bracketed). The **rail only appears when there
  is at least one range or passage-level note** (`hasRail`); if every note is
  single-verse (or there are none) the `.scripture-grid.no-rail` path collapses
  the margin column and the scripture column centers as a block. On mobile,
  single-verse notes stay inline under the verse and only range notes appear in
  the stacked list (bracket + `vv.x-y` chip). Applied to BOTH ChapterView and
  ReadingMode; all prior behaviours (category pills/labels, timestamps, the
  note→study bridge, quick-note creation, cross-ref pills, bidirectional
  hover/click highlight, dark mode) preserved. Verified with a real pointer drive
  at 1280px + 390px, light + dark. No schema or `BereanApi` change.

- **Margin / span notes.** Both reading surfaces — `ReadingMode` (saved-passage
  reader) and `BookDetailPage`'s ChapterView (Bible-home chapter reader) — now
  render verse-anchored notes as a study-Bible layout. (Superseded in part by the
  inline-vs-rail split above: single-verse notes moved back inline; the rail is
  range/passage notes only.) **Desktop (>768px):** a
  two-column CSS grid (`.scripture-grid`) — scripture in column 1, a 260px margin
  rail in column 2. Each verse row is placed on an explicit numeric grid row
  (`gridRow: index+1`, assigned in JSX); a rail note anchored to `[start..end]` is
  placed at `grid-row: startRow / endRow+1`, so its accent bracket (`.rail-bracket`,
  category-coloured) spans EXACTLY the anchored verse rows — a single-verse note
  brackets one row, a v4-15 note brackets that whole span. **Numeric grid-row
  placement was chosen over DOM-offset measurement** because it is declarative and
  reflow-proof: it survives font-size/zoom/wrap changes with no ResizeObserver and
  no measurement race (commented at the `.scripture-grid` CSS block and at both
  components' row-map). **Mobile (<=768px):** the grid collapses to a single column
  (`display:block`); each spanned verse row carries a `.verse-span-bracket` accent
  indicator, and anchored notes render in a stacked list (`.mobile-note-stack`,
  desktop-hidden) each with a `.note-range-chip` ("v4" / "vv.4-15") that scrolls to
  the anchored verse row (ref-map linkage). **Anchorless notes** (`anchor_start_verse
  === null`) are handled as passage-level notes: rendered in a `.rail-passage-notes`
  block above the grid (a "Passage notes" label), never bracketed. Highlight linkage
  is preserved and bidirectional: hovering/clicking a rail note highlights its verses
  (`onMouseEnter`/`handleNoteClick` → `highlightVersesForNote`) and clicking a verse
  highlights its notes. **Centered passage column:** the scripture column is centered
  as a block with a comfortable reading measure while verse *text* stays left-aligned
  — `.reading-content`/`.book-chapter-content` get `margin: 0 auto` (widened via
  `:has(.scripture-grid)` when a rail is present), and `PassagePane` gained a
  `.passage-pane-col` centered wrapper for the StudyMode passage pane; mobile stays
  full-width. All existing behaviours preserved: the note→study bridge (Edit note
  primary / Open study / Delete), quick-note creation, category pills/colours, subtle
  timestamps, verse-range selection + floating action bar, cross-ref pills, dark mode
  (rail brackets/chips themed in `dark.css`). Pure re-presentation — no schema,
  `BereanApi`, or note-data change; reused the existing anchors. Verified with
  puppeteer at 1280px and 390px, light + dark: desktop rail with a correctly
  3-row-spanning v2-4 bracket, mobile bracket + "vv.2-4" chip, centered column,
  bidirectional hover/click highlight, and the bridge actions intact on both
  surfaces. NOTE for the drag-to-select workstream: the desktop grid changed the
  verse-row DOM (rows are now `.scripture-grid > .reading-verse-block` grid items
  with an inline `gridRow` style, and each row registers a `verseRowRefs` entry and
  may contain a `.verse-span-bracket` child) — verse-selection creation logic
  (`handleVerseClick`/`selAnchor`/`selFocus`) was left untouched, but any drag
  handler must account for the new grid wrapper and the bracket child element.

- **Search breadth in the scripture section (Studies & Notes model,
  workstream 3).** `parseScriptureQuery` (`src/utils/noteParser.ts`) now
  returns `ScriptureQuery[]` instead of a single-or-null result, so early and
  partial queries surface jump targets instead of nothing: a bare book name or
  unambiguous prefix ("matthew", "matt", "rom", "1 cor") yields a single
  book-level result (`kind: 'book'`, chapter 1, verse null); "book + chapter"
  and "book + chapter:verse" keep returning exactly one result as before
  (`kind: 'chapter'` / `'verse'`); an ambiguous prefix ("j", "jo") yields up to
  `MAX_SCRIPTURE_RESULTS` (5) ranked results via a new `rankBookCandidates`
  helper — exact alias match first, then startsWith, then contains, ties
  broken by canonical `BIBLE_BOOKS` (USFM) order. No new alias table; reuses
  `findBookByAlias`/`BIBLE_BOOKS` from `bibleBooks.ts` entirely. `GlobalSearch`
  (`src/components/GlobalSearch.tsx`) renders the scripture section as a list
  (0..N results, "Open book" vs "Open chapter" label per kind) instead of a
  single button; the notes section (independent debounced `searchNotes` call)
  is untouched and still populates on its own. No schema or `BereanApi`
  change — pure client-side parsing. Test coverage extended in
  `noteParser.test.ts` for bare book, unambiguous prefix, ambiguous prefix
  (ordering + cap), book+chapter, book+chapter:verse, and empty/garbage query.
  Verse-text search remains out of scope/backlogged (see below).

- **One selection gesture + notes-as-front-door (Studies & Notes model,
  workstream 2).** In `BookDetailPage`'s ChapterView (the Bible home reader),
  the standalone per-verse "+" quick-note button is gone — verse selection is
  now the single gesture. Tapping a verse selects it and the floating action
  bar (already existing from the UX-overhaul verse-range work) appears
  immediately, even for a single verse, since `selAnchor`/`selFocus` are both
  set on the first tap. The bar's button order/emphasis flipped: **Quick note**
  is now the primary (`.verse-action-btn.primary`, filled accent) button and
  **"Start study on {ref}"** is secondary — same underlying handlers
  (`handleQuickNoteFromSelection` / `handleStartStudyOnSelection`), only the
  visual weight and DOM order changed. Verse numbers (`.verse-number`) gained a
  tappable affordance: an accent tint on `.reading-verse-row:hover`/`:active`/
  `.selected`, in both `main.css` and `dark.css` — CSS-only, no new state. In
  `ReadingMode` (the saved-passage bridge), the note action row reordered/
  re-emphasised: **inline quick-edit (pencil) is now visually primary**
  (`.se-icon-btn.se-icon-primary`, accent-tinted at rest, not just on hover) and
  listed first; **"Open study" is now unconditional** (`onOpenStudy` changed
  from optional to a required prop — `ReadingMode` is only ever rendered from
  `App.tsx` where it's always supplied via `handleOpenStudy`, so this is a type
  tightening, not a behavior change) and always shown between Edit and Delete.
  No schema or `BereanApi` change; reused all existing methods and the WS1
  `handleOpenStudy` path. Verified with puppeteer at 390px/1280px, light+dark:
  single-verse tap shows the bar with Quick note emphasised, range-extend
  updates the {ref} label live, Quick note creates a verse-anchored note,
  Start study opens `StudyMode` on the exact range, and the reading-view bridge
  correctly opens the existing passage (no duplicate) via Open study.

- **Search v1 (UX overhaul, workstream 6).** One search box with two
  independently-populating result sections. Section 1 (scripture reference) is a
  pure client-side parse — `parseScriptureQuery` in `src/utils/noteParser.ts`
  reuses the book-alias table (`findBookByAlias`) to turn "mat 2:13" / "john 1" /
  "1 cor 13:4" into a `{ bookNumber, bookName, chapter, verse }` jump target
  (chapter clamped to the book's real count). Bare book names/prefixes and
  ambiguous-prefix multi-result ranking were added later in workstream 3 above
  — see that entry for the current `ScriptureQuery[]` shape.
  Clicking navigates the Bible view to that book+chapter (App gained a
  `selectedChapter` and `handleJumpToChapter`; `BookDetailPage` gained an
  `initialChapter` prop). Section 2 (notes) is an additive `BereanApi.searchNotes`
  method — case-insensitive substring over note content, implemented in BOTH
  `memory.ts` (workspace scan) and `berean-api.ts` (SupabaseBereanApi: `ilike`
  joined notes→sessions→passages, workspace-filtered, newest-first, limit 50);
  clicking opens the study in context via `handleOpenStudy`. The
  `GlobalSearch` component (`src/components/GlobalSearch.tsx`) renders as a top-bar
  popover on desktop (`variant="bar"`) and a dedicated full-screen surface on
  mobile (`variant="surface"`, opened from a top-bar search button since the
  desktop box is hidden under 768px). The two sections are decoupled — section 1
  is a synchronous `useMemo`, section 2 an independently-resolving debounced
  effect — so neither blocks the other and a future staggered-populate animation
  can key off each mounting on its own (structure only; no motion yet). Test
  coverage: `parseScriptureQuery` cases added to `noteParser.test.ts`. No schema
  change. Scripture verse-text search and a Postgres FTS index for note search are
  backlogged above.

- **Mobile study layout (UX overhaul, workstream 5).** On mobile (<=768px) the
  scripture pane is now a pinned, collapsible panel at the TOP of the study view
  (`StudyMode`): it peeks (~34vh) by default and expands (~62vh) on tapping its
  header, which shows the loaded reference + a chevron. It scrolls internally and
  never scrolls fully off-screen; notes render below it and scroll independently.
  Achieved with CSS only (flex `order: -1`, bounded `max-height`, a
  `.study-scripture-body` wrapper that is `display: contents` on desktop so the
  side-by-side layout is untouched) plus one `scriptureExpanded` state + toggle
  header in `StudyMode`. Desktop side-by-side (`.study-left`/`.study-right`) is
  unchanged (toggle hidden). Caret-visible-above-keyboard: `NoteEditor`'s
  `scrollLineIntoView` gained a `keyboardAware` mode that clamps the effective
  container bottom to `visualViewport.offsetTop + height`; a `visualViewport`
  resize/scroll listener (keyed to the focused line) and the input handler re-run
  it so the caret stays above the soft keyboard as lines wrap/add. No-op where the
  API is absent (desktop). Add-on: an extremely subtle note timestamp
  (`.note-timestamp`, muted 10px, trailing edge) rendered on note cards in
  `ReadingMode` and `SessionEditor` via a shared `formatRelativeTime` helper
  (`src/utils/relativeTime.ts`), using `updated_at` (falling back to
  `created_at`). No schema or `BereanApi` changes. NOTE for future: timestamps are
  intentionally NOT shown on the ephemeral `NoteEditor` editing lines (those rows
  carry no persisted timestamp) — only on rendered/persisted note cards.

- **Editor behaviors (UX overhaul, workstream 4).** Reference field commits on
  Enter/Tab and moves focus to the first note line *immediately* (synchronous —
  never on the async verse fetch); parse failure keeps focus in the field and
  shows an inline error; `enterKeyHint="go"` for mobile. `ReferenceInput.onSubmit`
  now returns a boolean so the field can decide focus-vs-error, and `StudyMode`
  bumps a `focusNonce` prop the `NoteEditor` watches to imperatively focus the
  target line. Outdent rules in `NoteEditor` keydown: Enter on an empty bullet at
  indent > 0 outdents in place (keeps the bullet, no new line); Enter on an empty
  level-0 bullet is a no-op; Backspace at the start of an empty indented bullet
  also outdents; Shift+Tab unchanged. The keydown *decisions* were extracted to a
  pure module (`src/utils/noteKeydown.ts`) so they're unit-testable without a
  contenteditable — tag parsing stayed in `noteParser.ts`, layers kept separate.
  Tag discoverability (all passive): every empty note line shows the placeholder
  "Type your note — @ for a category, v4 to tag verse 4"; recognized tags render
  as pills as parsed (already the case); a one-time first-use hint popover fires
  on first note-line focus (localStorage flag `berean.noteHintSeen`); a mobile
  chip row above the keyboard offers tap-to-insert for verse/category tags (same
  data model, input method only — desktop hides it). Test infra added: Vitest
  (`npm test` → `vitest run`), covering the keydown decisions and a regression
  pin on `@`-tag + verse parsing. No schema or `BereanApi` changes.

- **Study entry points + verse-range selection (UX overhaul, workstream 3).**
  Renamed Capture→Study across UI copy and code (`CaptureMode`→`StudyMode`
  component/handle, App state `capture*`→`study*`, `.capture-*` CSS →
  `.study-*`, `btn-capture-chapter`→`btn-study-chapter`, Onboarding "Study
  mode", chapter button "Study chapter"). Three convergent entry points to the
  same `StudyMode`: blank from the nav, prefilled from the current chapter
  ("Study chapter"), and verse-range selection in the Bible chapter reader
  (`BookDetailPage` ChapterView) — tap a verse to start, tap another to extend,
  a floating action bar offers "Start study on {ref}" (prefills StudyMode with
  the exact range) and "Quick note" (opens the inline note input prefilled with
  the verse-range tag). Quick note reuses the existing session+note flow — no
  schema or `BereanApi` change. The floating bar clears via its × or by tapping
  the sole selected verse again; on mobile it floats above the bottom tab bar. Journal is a
  browseable index of studies grouped by book (newest first within a group;
  reference, date, note count, first-line preview) via a new
  `BereanApi.getJournalEntries()` (implemented in both `SupabaseBereanApi` and
  the memory stub); tapping a row opens the study in `SessionEditor`. Notes in
  `ReadingMode` now offer "Edit note" and "Open study" (jumps to the
  SessionEditor under the Journal destination).

- **Nav restructure (UX overhaul, workstream 1).** Sidebar/drawer removed; top
  nav (desktop) + bottom tab bar (mobile) with Bible · Journal · + Study ·
  Profile; workspace-selector stub ("Personal ▾"); avatar/profile menu absorbing
  the Settings entry point; Bible library is home. Journal is a placeholder
  until workstream 2.
