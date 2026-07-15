# design/ — review artifacts

Static, self-contained HTML mockups used for the "see before implement" loop.
Open them directly in a browser (no build step, no imports from `src/`).

**These three are committed because they are the approved SPEC for the landing
page build.** They are temporary: delete them once the landing page is ported to
real React components.

| File | What it is |
| --- | --- |
| `lantern-hero.html` | **APPROVED hero animation.** Make two notes (single-verse inline + multi-verse rail), then fly through a chapter full of study, on a seamless infinite loop. |
| `lantern-features.html` | **APPROVED feature clips.** Three looping clips: Four lenses; Notes on the verse (set in the **Study view**); Find and return (search → journal). |
| `lantern-mockup.html` | Landing page layout + login screen direction (Google prominent, email fallback). Copy and section structure. |

## Do not "simplify" the hero's loop

`lantern-hero.html` looks over-engineered in two places. Both are load-bearing —
removing either visibly breaks the loop:

1. **The chapter is cloned** (`setupClone`). Scrolling exactly one chapter-height
   brings the duplicate's top to the same screen position as the real top, so the
   scroll can reset to 0 with no visible jump. That is what makes the loop
   seamless rather than a fade.
2. **The verse-1 note is collapsed off-screen with a translateY compensation.**
   The note must *open* when written (no pre-reserved gap), but must be *gone* by
   the time the top comes back around, or the reset would show a mismatch. So
   mid-scroll it collapses and the scroll position shifts by the exact same
   measured amount in the same instant — on-screen content does not move (verified:
   0px shift). The scroll is `linear` for the same reason: constant velocity keeps
   the splice invisible.

Tunables live in the `CONFIG` block at the top of each file's script.

## Uncommitted files here

Anything else in this directory is superseded scratch (earlier landing mockup,
early animation studies, the logo exploration that ended in a wordmark-only
identity). It is deliberately untracked — treat it as disposable.
