# UX Overhaul — Bible-centric IA

Agreed redesign (July 2026) replacing the capture/reading mode toggle with a
Bible-centric information architecture. Execute top-to-bottom; each numbered
workstream is independently committable. The visual/animation polish pass and
onboarding content come AFTER this plan lands; SMTP + deployment after that.

## Design decisions (settled — do not relitigate)

**IA.** Home = the annotated Bible (library → book → chapter, notes inline).
No mode toggle. The sidebar/drawer is REMOVED entirely. Navigation: top bar on
desktop, bottom bar on mobile — Bible · Journal · + Study · Profile.
- Top bar leading slot: app logo + "Personal ▾" — a workspace selector stub
  (renders the personal workspace only; dropdown lists it + a disabled hint of
  future groups; this is a placeholder so the future group switcher drops in
  without restructure).
- Trailing slot / mobile Profile tab: avatar menu — display name, Settings,
  Export, Sign out (absorbs today's SettingsModal entry point).

**Study (rename of Capture — use the word "Study" everywhere).** The existing
capture surface, reached three ways, all converging on the same component:
1. "+ Study" in the nav → blank, reference entry as today.
2. "+ Study" while reading a chapter → prefilled with that chapter (editable).
3. Verse-range selection in the Bible view: tap a verse → tap another to extend
   the range → floating action bar: "Start study on {ref}" / "Quick note".

**Quick note.** In-Bible margin-note flow (tap verse → jot a short note) stays,
uplifted to feel first-class. It creates a session+note under the covers, same
data model.

**Journal.** New page: browseable index of study sessions (grouped by book,
newest first; shows reference, date, note count, first-line preview). Replaces
the sidebar's passage list. Tapping opens the study for editing (SessionEditor
flow today).

**The bridge.** Tapping a note in the Bible reading view offers two actions:
"Edit note" (inline quick edit, exists today) and "Open study" (jump into the
full session that contains it). This removes the old find-it-in-the-sidebar
editing path.

**Search.** One search box (top bar / dedicated mobile surface) with two
result sections that populate as you type: (1) scripture reference matches —
smart parse ("mat 2:13") with click-to-jump, reuse the existing reference
parser/alias logic; (2) matching notes — Postgres full-text (or ilike v1) over
note content in the user's workspace, tapping jumps to the note in context.
Sections should animate in smoothly (staggered populate) — final motion polish
comes in the UI pass, but structure the DOM/state so the animation is natural.
Scripture FULL-TEXT search (searching verse text) is BACKLOGGED — do not build;
it depends on the full-Bible prefetch backlog item.

**Editor behaviors.**
- Reference field: Enter (and Tab) commits the reference → moves focus to the
  first note line immediately (do NOT wait for the verse fetch; never move
  focus on async completion). On parse failure, keep focus in the field with
  the error. Mobile: `enterKeyHint="go"` on the reference input.
- Outdent: Enter on an EMPTY bullet at indent > 0 outdents one level (keeps the
  bullet, no new line). Enter on an empty level-0 bullet: no-op. Backspace at
  the start of an empty indented bullet also outdents. Shift+Tab unchanged.
  MUST NOT regress tag parsing (@ menu, verse syntax) — add regression coverage
  for keydown handling around these (the behaviors live in NoteEditor keydown;
  tags in noteParser — keep the layers separate).
- Tag discoverability (all passive, no enforced selectors): placeholder text in
  an empty note line ("Type your note — @ for a category, v4 to tag verse 4");
  render recognized tags as styled pills as soon as parsed (if not already);
  one-time first-use hint popover on first note-line focus; mobile chip row
  above the keyboard with tap-to-insert for category/verse tags (same data
  model, an input method only).

**Mobile study layout.** Scripture becomes a pinned, collapsible panel at the
top (peek a few lines, tap to expand), notes below — scripture must never
scroll fully off-screen. While typing, keep the caret visible above the
keyboard: scroll the active note line into view as lines wrap/add, using the
visualViewport API to account for keyboard height.

## Constraints

- Read CLAUDE.md first; obey the pure-web rule and the backlog rule
  (docs/BACKLOG.md updated for anything touched/deferred, e.g. scripture
  full-text search).
- Data model/schema: NO changes required or wanted. Sessions/notes/passages
  stay as-is; "Study" is presentation language only.
- BereanApi seam: additive only (e.g. a note-content search method). Both
  SupabaseBereanApi and the memory stub must implement additions; memory stub
  keeps `npm run dev` working with no env.
- Existing visual language (colors, spacing, typography, dark mode) — build new
  surfaces cleanly on it; no throwaway styling, but no motion-polish yet.
- Verify at 390px and 1280px (puppeteer screenshots) plus tsc/build gates.
- Update docs/ARCHITECTURE.md's UI section when the IA lands.

## Suggested workstreams (order matters)

1. **Nav restructure**: remove Sidebar/drawer; top bar (desktop) + bottom bar
   (mobile); workspace-selector stub; profile menu absorbing Settings/Export/
   sign-out; Bible view becomes home; App.tsx state/routing reshaped around
   Bible/Journal/Study/Profile destinations.
2. **Journal page** + the bridge actions on notes in the Bible view.
3. **Study entry points**: rename Capture→Study throughout UI copy; prefill
   from current chapter; verse-range tap-selection + floating action bar
   (study / quick note); quick-note flow uplift.
4. **Editor behaviors**: reference commit focus; outdent rules; tag
   discoverability layers; regression coverage.
5. **Mobile study layout**: pinned collapsible scripture; caret-visible
   scrolling via visualViewport.
6. **Search v1**: reference jump + notes search, two animated sections.

After all six: screenshot review pass at both widths, ARCHITECTURE.md update,
then hand back for the dedicated visual/animation pass (separate effort), then
SMTP setup and Cloudflare Pages deployment.
