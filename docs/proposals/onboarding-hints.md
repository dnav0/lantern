# Point-of-use onboarding hints — proposal

Replaces dropped task `128f50a1`, which gated the whole job on taste when only
the copy is taste-based. This document is the research and recommendation;
Dennis picks/rewrites the copy.

## Method

Driven live with Playwright against `npm run dev` (port 5173). No `.env` file
exists in this checkout, so the dev server was already serving the in-memory
stub — nothing to move aside. Screenshots are in this run's artifacts
(`screenshots/01`–`11`); referenced by number below.

**Two things the verify plan assumed that turned out not to hold, and which are
themselves findings:**

1. **The memory-stub path never shows sign-in or `Onboarding.tsx` at all.**
   `Root.tsx` picks between `MemoryRoot` and `SupabaseRoot` on whether Supabase
   env vars are present. `MemoryRoot` renders `App` directly — it has no phase
   state, so it can't be in `'onboarding'`. Sign-in and the onboarding screens
   only exist on the Supabase-backed path, which needs a real project and a
   real account to drive with Playwright; that isn't available in this sandbox
   and isn't something this brief's scope (`docs/proposals/**` only) can wire
   up. Onboarding.tsx below is analyzed from source (quoted in full, it's 65
   lines of plain conditional JSX with no dynamic behavior worth a live
   capture) rather than screenshotted. Flagging this plainly rather than
   quietly treating a source read as a live capture.
2. **The stub isn't a "genuinely empty account."** `seedMemoryApi()` seeds four
   passages (Genesis, John, Romans, Psalms) with real notes already on them —
   see screenshot 01. Every dev-mode session boots into a partially-studied
   library, not a blank one. I worked around this by treating an *unseeded*
   book (Mark) as the stand-in for "first chapter a new user opens," which is
   an accurate proxy for the reading path even though the Library header
   itself never shows its true empty state (`'Click any book to begin
   reading'`, read from `BibleLibrary.tsx:104`, not observed live).

Neither gap blocks the brief: the parts explicitly asked for (first chapter,
first note, first study) are all reachable and screenshotted through `App.tsx`
without auth. But a proposal that didn't say so would be overstating what it
verified.

## What a new user actually encounters

### Sign-in → Onboarding (source-read, not live — see above)

`Onboarding.tsx` is three steps, skippable at every one except the last:

1. Optional name ("What should we call you?" / "Optional. Used to greet you
   when you open the app.")
2. A static explainer: "Study mode... Type a reference, read the passage, and
   write what you see — observations, historical context, application,
   personal reflection. Notes anchor to the verses they belong to."
3. A static explainer: "Reading mode... Come back to any passage to read your
   notes against the text, browse the whole Bible by book, and pick up where
   you left off," then "Start reading."

All abstract, none anchored to anything on screen yet — the exact shape of
explainer copy that point-of-use hints exist to replace.

### First chapter (screenshot 02, `Mark 1`)

A plain reading view: verse numbers, verse text, a "+ Study chapter" button.
**Nothing indicates a verse is clickable.** No cursor affordance, no hover
state, no label. A user who doesn't already know to tap a verse (nobody told
them — see above) has no reason to try.

### First selection (screenshot 03)

Once you *do* click a verse (a single tap starts a range; a second tap
extends it — `BookDetailPage.tsx:275-303`), a floating action bar appears:
reference, "Hold Alt and drag to select the text to copy," "Quick note,"
"Start study on {ref}." This bar is itself a point-of-use hint, and a recent
one — `docs/BACKLOG.md`'s 2026-07-19 entry shows the Alt-drag line was added
deliberately, scoped to exactly this bar, "not a new persistent banner." It
works. The gap is upstream of it: nothing gets you here in the first place.

### First note (screenshot 04, inline quick-note; 05/06/07, full Study mode)

The inline quick-note editor and the full `+ Study` surface share the same
`NoteEditor`, which already has real, working discoverability infrastructure
(`docs/BACKLOG.md`, "Editor behaviors" workstream):

- Every empty line placeholders `Type your note — @ for a category, v4 to tag
  verse 4`.
- A one-time popover (`berean.noteHintSeen`) fires on first note-line focus,
  screenshot 07: "Tip: type @ to tag a category, or v4 to anchor a note to
  verse 4. A reference like Matt 5:9 becomes a link."
- A mobile chip row offers the same tags as tap targets.

Category tagging and verse anchoring are **already handled.** This is not a
gap.

### Sub-notes (screenshots 09/10)

Pressing Tab on a line indents it one level (`◦` bullet, 24px padding,
`NoteEditor.tsx:404-409`) — this is real and works (verified via DOM class,
not just the screenshot: `note-line--indent-1` applies correctly). **It is
mentioned nowhere** — not the placeholder, not the tip popover, not the chip
row. It's the one real gap in an otherwise well-covered editor.

### Reading a study back (screenshot 11, `Psalm 23`)

Past notes render inline under their verse, with a colored category label
(`HISTORICAL`, `PERSONAL`). This is where "study" and "reading" visibly blur
together on purpose: the same chapter view that shows scripture also shows
your notes and lets you add more via Quick note, without ever opening the
dedicated `+ Study` split-pane surface. See the Onboarding recommendation
below — this is why I don't think that distinction needs its own hint.

## Recommended hints, ranked

### 1. Verses are selectable (new)

- **Trigger:** first time a chapter reader (`BookDetailPage`'s `ChapterView`)
  mounts with no selection ever made (`localStorage` flag, e.g.
  `berean.verseSelectHintSeen`), shown once near the verse list, dismissed
  automatically on the user's first real selection or by an explicit close.
- **Why here:** this is the one dead end in the whole flow. Everything past
  the first tap (the action bar, quick note, the tag tip) already teaches
  itself. Nothing teaches the tap.
- **Why it earns interrupting:** it's the fastest note-taking path the app
  has (tap → Quick note, no reference typing, no leaving the chapter). Missing
  it doesn't block the app — "+ Study chapter" still works — but it silently
  downgrades every new user to the slower path forever, because they never
  learn the fast one exists.

### 2. Tab indents a line as a sub-note (new)

- **Trigger:** the first time a user's note ever grows past one line (line
  count transitions 1 → 2 for the first time — a genuine point-of-use moment,
  distinct from the existing first-focus tip which is already covering @/v4
  and would be crowded by a third instruction). Flag e.g.
  `berean.indentHintSeen`.
- **Why here:** it's the only way the flat four-category model expresses "this
  is a smaller thought under that bigger one." Nothing else in the UI hints at
  hierarchy at all.
- **Why it earns interrupting:** without it, every note stays flat, which
  quietly defeats a feature that was clearly built (indent logic, outdent
  rules, dedicated CSS) and then never mentioned. Low interruption cost — one
  popover, once, right when the second line appears.

## Rejected candidates

- **Alt-drag copy hint.** Already shipped (2026-07-19, see above), already
  scoped correctly (inside the action bar, not a banner), already hidden on
  touch. Adding anything here would be redundant.
- **Category (`@`) / verse-anchor (`v4`) tagging hint.** Already shipped
  (placeholder + `berean.noteHintSeen` popover + mobile chip row). Same
  verdict.
- **"Study mode vs. reading mode" explainer.** Considered and rejected. The
  action-bar buttons already name the distinction at the moment it matters
  ("Quick note" sits next to "Start study on {ref}" in the same bar,
  screenshot 03), and `BookDetailPage`'s own "+ Study chapter" button and the
  library's own copy (`'Click any book to begin reading'` /
  `'{n} books · {n} passages studied'`) already carry the structural story.
  A popover restating "these are two different modes" would be explaining
  something the button labels already show in context — the exact
  front-loaded-abstraction problem this brief exists to move away from.
- **Desktop marquee (click-drag box-select) as its own teachable moment.**
  It's a bonus input method for a result (a verse range) that tap-to-extend
  already reaches more discoverably. Teaching a second way to do the same
  thing isn't worth a hint; recommendation #1 above already covers "you can
  select verses" without picking a gesture.

## Draft copy (2 variants each — starting points, not final)

**Hint 1 — verse selection**
- A: "Tip: tap a verse to select it. From there you can add a note or start a
  study on it."
- B: "Tip: verses are tappable. Select one, or a range, then add a note or
  start a study."

**Hint 2 — sub-notes via Tab**
- A: "Tip: press Tab to indent this line under the one above it, as a smaller
  note under a bigger one."
- B: "Tip: Tab indents a line as a note under the note above. Shift+Tab undoes
  it."

## Onboarding.tsx: trim it to the name step only

Recommend **removing** the two explainer screens (Study mode / Reading mode),
**keeping** the optional name step, so onboarding becomes one skippable screen
that ends in "Start reading."

Reasoning: both explainer screens describe things the app now teaches (or, with
the two hints above, will teach) in context, closer to the moment they're
needed:

- The Study-mode screen's content (categories, verse anchoring) is already
  covered live by the `NoteEditor` tip.
- The Reading-mode screen's content (revisit passages, browse by book) is
  already covered by self-explanatory nav labels (`Bible`, `Journal`) and the
  library's own state-dependent copy.

Nothing in either screen would be lost by removing them; both are abstract
restatements of things a point-of-use hint (existing or proposed) says more
concretely, at a moment the user can actually act on it. Shortening onboarding
to one screen also gets a new user into a real passage faster, which matters
more for retention than front-loading two paragraphs of mode description.

## Implementation sketch (for a follow-up task)

- **Hint 1:** `src/components/BookDetailPage.tsx` (the `ChapterView` piece) —
  new dismissible tip block, same shape as `NoteEditor`'s existing
  `note-hint-popover`, new CSS rules in `src/assets/main.css` reusing that
  class's look. New localStorage key `berean.verseSelectHintSeen`, read/write
  helpers mirroring `hintAlreadySeen`/`markHintSeen` in `NoteEditor.tsx:50-63`.
  Rough size: ~40-60 changed lines, two files, no `BereanApi`/schema change.
- **Hint 2:** `src/components/NoteEditor.tsx` — a second one-time popover keyed
  on the lines-array growing past length 1 for the first time, new key
  `berean.indentHintSeen`, reusing the same popover component/CSS the
  existing `@`/`v4` tip uses. Rough size: ~30-50 changed lines, one file
  (`NoteEditor.tsx`), CSS reused as-is.
- **Onboarding trim:** `src/components/Onboarding.tsx` — delete the `step ===
  1` and `step === 2` blocks, collapse `step 0`'s "Continue" into `finish`
  directly (name step becomes the whole flow). Rough size: ~30-40 removed
  lines, one file. `berean.onboarded` key and gating logic in `Root.tsx`
  untouched.
- Combined, this is comfortably a single "normal"-effort follow-up task, not a
  split — all three pieces reuse one existing pattern
  (localStorage-flag + dismissible popover) rather than inventing a new one.

## Working tree

No `src/` changes were made for this brief. Proof (before this file was staged):

```
$ git status --short
?? docs/proposals/
```

Only this new proposal directory/file — nothing under `src/`.
