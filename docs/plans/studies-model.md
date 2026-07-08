# Studies & Notes model — unify the study surface

Follow-up to `ux-overhaul.md` (which landed as WS1–6). This milestone acts on the
settled conceptual model from the July 2026 design discussion. Execute
top-to-bottom; each workstream is independently committable.

## The settled model (do not relitigate)

- **Notes belong to verses, not to studies.** A note is anchored to a verse/range
  (`anchor_start_verse`/`anchor_end_verse`) and is the durable artifact.
- **The Bible/reading view is the cumulative surface.** All notes anchored in a
  chapter already render inline there (`getNotesByBook`) regardless of which
  passage/session created them — this is where "all notes on a verse always show"
  lives, and it already works. Do not regress it.
- **A "study" is one deliberate effort** = a `Passage` (range + `reference_label`)
  with its notes. The heading *is* the range; there are no thematic titles.
- **The Journal lists efforts** (passages), range-labelled, newest-first, with a
  note count — already built in WS2.
- **Quick notes are ungrouped jottings** — a verse-anchored note that shows in
  context but is a first-class in-Bible margin note, not a Journal-worthy effort.
- **Editing an existing study does not spawn a new Journal entry** (same passage);
  a new entry appears only when you deliberately start a new study.

### Deferred to a FUTURE milestone (backlog, NOT this build)
- A lightweight `study_id` group stamp on notes enabling **multiple distinct study
  instances over the same verses** (user chooses/starts a new instance), and
  cross-effort anchor merging inside the editor.
- **Margin / span notes**: desktop margin rail with bracketed multi-verse spans;
  mobile bracket + verse-range chip.
- Drag-to-select verse ranges on desktop; quick-note input visual polish
  (these belong to the separate visual/animation pass).

Record all of these in `docs/BACKLOG.md` in the docs workstream.

## Workstreams (order matters)

1. **Unify on StudyMode; retire SessionEditor; non-destructive save.**
   - Route every "open a study" path — Journal tap, the reading-view bridge
     "Open study", blank "+ Study", verse-range "Start study", chapter prefill —
     to `StudyMode`. There is ONE study surface.
   - `StudyMode` opening an existing passage: load its notes as dot-point lines
     that carry their source note id; load scripture from the passage reference;
     show the reference in the heading.
   - **Reconciling save (critical):** diff the editor lines against the existing
     notes by their carried note id — `updateNote` changed lines (only bump
     `updated_at` when content/indent actually changed), `createNote` new lines,
     `deleteNote` notes whose line was removed. NO more delete-all-then-recreate.
     This preserves note ids and the `created_at`/`updated_at` timestamps that the
     subtle-timestamp feature renders.
   - Opening an existing passage reuses it (no duplicate passage on open).
   - Delete `SessionEditor.tsx`, its `.se-*` CSS (light + dark), and its App
     routing/state. Keep `InlineTagInput` (used by the in-Bible quick-note path).
2. **One selection gesture + notes-as-front-door.**
   - Retire the standalone per-verse "+" quick-note affordance. Verse selection is
     the single gesture: tapping a verse selects it and the floating action bar
     appears immediately with **Quick note emphasised (primary)** + **Start study
     on {ref}**; tapping another verse extends the range; tapping the sole selected
     verse again, or the bar's ✕, clears. Style verse numbers so they read as
     tappable (subtle press/hover affordance).
   - Reading-view note bridge: **inline quick-edit is the primary/default action**,
     **"Open study" is secondary and always present** (routes through WS1's unified
     open-study path). A quick note graduates into a study by being opened.
3. **Search breadth (scripture section).**
   - Broaden `parseScriptureQuery`: a bare book name ("matthew", and prefixes like
     "matt") yields a jump result; book + chapter and book + chapter:verse as
     today. Allow more than one match where a prefix is ambiguous. The two result
     sections (scripture top, notes bottom) must both still populate independently.
   - Extend `noteParser.test.ts` for the new query shapes.
4. **Docs + final review** (orchestrator): ARCHITECTURE.md "Notes & Studies model"
   section; BACKLOG.md deferred items above; full build/test/lint + puppeteer
   screenshot pass at 390px and 1280px.

## Constraints (binding, same as ux-overhaul.md)

- Pure web only; no Node/Electron APIs under `src/`.
- **No schema changes** this milestone (the `study_id` stamp is deferred). Any
  BereanApi addition is additive and implemented in BOTH `berean-api.ts` and
  `memory.ts`; the memory stub keeps `npm run dev` working with no env.
- Existing visual language; no motion polish (deferred pass).
- Strict TS; two-space indent, single quotes; no repo-wide reformat.
- Gates: `npm run build` + `npm test` pass; `npm run lint` keeps only its 3
  pre-existing errors. Verify with puppeteer at 390px and 1280px, light + dark.
