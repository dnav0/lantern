# Scripture full-text search — approach, index strategy, and cost

**Recommendation: build it, and skip the index.** Debounced client-side
linear scan over the already-shipped `public/bible/bsb.json.gz` bundle,
lazy-loaded on first scripture-search keystroke, exactly mirroring how
`SelfHostedBibleProvider` already lazy-loads it on helloao failure. No new
build step, no shipped index artifact, no schema change. This is the
"cheapest correct answer" the acceptance criteria for this brief asked for,
and the measurements below are why it's correct: a full 31,086-verse scan
takes single-digit milliseconds, which is faster than the network round trip
that would be needed to serve a prebuilt index in the first place.

Trigger to revisit: not now (see §8).

All numbers below are real, not estimated — see §9 for the exact scripts.

## 1. What exists today, and how a third search lands in the same box

`GlobalSearch.tsx` already runs two independent search flows against one
query string, rendered as two sections in one dropdown:

1. **Reference parsing** (`parseScriptureQuery`, `src/utils/noteParser.ts:209`)
   — pure, synchronous, zero I/O. Turns "mat 2:13" into a *jump target*
   (book/chapter/verse), never touches verse text. Capped at 5 ranked
   candidates (`MAX_SCRIPTURE_RESULTS`) for ambiguous prefixes like "j".
2. **Note search** (`BereanApi.searchNotes`, `src/api/berean-api.ts:378`) —
   async, debounced 120ms, searches the *user's own notes* (`ilike
   '%q%'` in Postgres; `content.toLowerCase().includes(q)` in the memory
   stub). Capped at 50 results, ordered newest-first.

Scripture text search is a genuinely third thing — it searches the ~31k
*verses of the Bible itself*, a fixed corpus that's the same for every user,
as opposed to each user's own growing note set. It does not replace either
existing flow:

- It is not reference parsing. "love" is not a reference; "mat 2:13" is not
  a word one would search scripture text for. `parseScriptureQuery` should
  be left alone.
- It is not note search. A user searching "Melchizedek" plausibly wants
  *both* "here's what scripture says" and "here's what I wrote about him" —
  these are complementary answers to the same query, not competing ones.

**They should coexist as a third section in the same box**, not a separate
search surface: `GlobalSearch` already renders `search-section` blocks keyed
by `data-section` (`"scripture"`, `"notes"`); a third `data-section="verses"`
block slots into the same pattern with no new UI surface to learn. See §6.

## 2. Measured cost of the bundle itself

`public/bible/bsb.json.gz` on disk today:

```
gzip bytes:          1,273,758   (~1.24 MB — matches the "~1.2 MB gzip" figure in BACKLOG.md)
decompressed bytes:  4,098,940   (~4.10 MB — matches the "~4.1 MB decompressed" figure)
verse count:         31,086
```

Cold-load timings, Node 22 (`zlib.gunzipSync`, warmed CPU, single run —
representative of the decompress+parse cost regardless of host; a Vitest/CI
box will be similar or faster than this GH Actions runner):

| step | time |
|---|---|
| gunzip (1.24 MB → 4.10 MB) | 15.4 ms |
| `JSON.parse` | 26.0 ms |
| flatten into `{book, chapter, verse, text}[]` | 8.9 ms |
| **total, one-time, per session** | **~50 ms** |

Cross-checked in a real browser (Chromium via Playwright, against this
repo's `npm run dev` on `localhost:5173`, page already loaded):

| step | time |
|---|---|
| `fetch('/bible/bsb.json.gz')` (localhost) | 56.6 ms |
| decode → JSON string | 6.6 ms* |
| `JSON.parse` | 14.9 ms |
| flatten | 4.9 ms |

\* Vite's dev server tags the response `Content-Encoding: gzip`, so Chromium
transparently decompresses on the wire — the 6.6 ms here is string decode
overhead, not a real `DecompressionStream` gunzip. On the actual deploy
target (Cloudflare Pages serving the `.gz` opaquely, per the comment in
`self-hosted.ts:36-40`), the browser runs `DecompressionStream('gzip')`
explicitly; that API is a thin wrapper over the same native zlib the Node
number above already measured, so ~15 ms is the right expectation, not the
6.6 ms artifact of this dev-server quirk.

Net: **loading the whole Bible into memory costs on the order of 50-80 ms,
once per session**, dominated by network fetch time (which a prebuilt index
would pay too — see §3) rather than by parsing.

## 3. Scan vs. index — decide with real timings, not intuition

Two approaches were actually built and timed against the flattened
31,086-verse array (Node 22, warmed, averaged over 20 calls for the scan,
5 calls for the index build):

**A — linear scan**, `text.toLowerCase().includes(needle)` over every verse:

| query | hits | time |
|---|---|---|
| "love" (common) | 583 | 6.82 ms |
| "Melchizedek" (rare) | 14 | 5.62 ms |
| "zzzznomatch" (no hits, worst case) | 0 | 4.78 ms |

**B — inverted index**, tokenize every verse (`toLowerCase().split(/[^a-z0-9']+/)`)
into a `Map<token, Set<verseIndex>>`:

| metric | value |
|---|---|
| build time | 186.2 ms |
| unique tokens | 14,182 |
| index size, JSON | 3,533,382 bytes (3.53 MB) |
| index size, gzip | 1,484,710 bytes (1.48 MB) |
| lookup time, "love" | 0.0007 ms |
| lookup time, "melchizedek" | 0.0001 ms |

**Decision: scan, not index.** Three independent numbers all point the same
way:

1. **The scan is already fast enough for search-as-you-type.** 5-7 ms is
   comfortably inside a single animation frame (16.7 ms @ 60fps) and far
   under the 120 ms debounce `GlobalSearch` already uses for note search —
   i.e. the existing debounce budget alone hides the entire scan cost. There
   is no user-perceptible win to chase with an index.
2. **A shipped index is not actually cheaper to load.** At 1.48 MB gzip, the
   index is *larger* than the 1.24 MB scripture bundle itself — because an
   inverted index over English prose (14k unique tokens, most verses sharing
   most tokens) doesn't compress as well as the prose it's built from.
   Shipping "bundle + index" roughly doubles the download for a lookup that
   only saves ~5 ms once the bundle is already in memory.
3. **A client-built index adds 186 ms of blocking build time** for a payoff
   (sub-millisecond lookups) nobody will notice, since the thing it's saving
   time on (the scan) is already imperceptible.

An index would earn its cost at a materially larger corpus (multiple
translations, cross-references, commentary) or if search needed to run
before the full bundle is in memory. Neither is true today. If this changes,
re-run `/tmp`-style timings against the new corpus size before deciding —
don't re-derive this from intuition either.

## 4. Search quality — folding, matching, ranking (worked examples)

**Case folding:** required and trivial — `.toLowerCase()` both sides, as the
scan above already does. BSB text is mixed-case ("LORD" for the Tetragrammaton,
title-case names), so an unfolded search would miss almost everything typed
in ordinary lowercase.

**Punctuation folding — concrete finding, not hypothetical:** the BSB text
uses **typographic (curly) punctuation**, not ASCII. Confirmed by inspection:
quotation marks are U+201C/U+201D (`"…"`), and possessives use the curly
apostrophe U+2019 (`’`), e.g. `"the LORD's compassion"` — not the straight
`'` a user's keyboard actually types. A search box that doesn't normalize
this will fail on every possessive/contraction query. Required normalization:
fold `’`/`‘` → `'` (and drop or fold em-dashes `—` at tokenization boundaries)
before comparing.

**Stemming — decided by evidence, not assumption:**

- `love` / `loved` / `loves` / `loving` are 4 **separate word forms** in the
  BSB (185, 54, 193 hits respectively for the inflected forms above, checked
  independently of the 583 "love" substring hits).
- `loveth` / `lovingkindness` — 0 hits. This is BSB (a modern-English
  translation), not KJV; archaic forms don't exist in this corpus at all, so
  there's nothing to stem *for* on that axis.
- **Substring matching already gets a useful approximation of stemming for
  free**, with a caveat: `.includes('love')` matches `loved`, `loving`,
  `unloved`, `beloved` (all correctly related) but also `lovely` (borderline)
  and would false-positive on words like "glove" *if* the corpus contained
  any (verified it doesn't — spot-checked all 16 non-exact-word substring
  hits for "love" by hand, none are false positives like "glove"/"clover").
  **Recommendation: plain substring match, not a real stemmer.** A real
  stemmer (Porter/Snowball) is a new dependency for a corpus small enough
  that substring recall is already good, and stemmer false-positives
  (`"organ"` stemming to match `"organize"`) are a worse failure mode than
  the rare substring coincidence above.
- Do **not** token-exact match (i.e. do not reuse the §3 inverted-index
  tokenizer for the shipped feature) — that mode requires typing the exact
  inflected form and is a strictly worse UX than substring for this corpus.

**Phrase vs. term matching:** substring scan naturally does phrase matching
for free — `"love your neighbor"` as one search string returns exactly the
10 verses containing that exact phrase (Leviticus, Matthew ×3, Mark, James,
Galatians, Romans), not verses containing "love", "your", and "neighbor"
separately. **Recommendation: treat the whole query as one substring** (like
note search already does), not a multi-term AND. Multi-word AND-matching is
a real feature some users will want eventually, but it's a second query mode
("love AND neighbor" independent-word matching vs. "love your neighbor"
phrase matching) with its own UI affordance — out of scope for v1, worth a
BACKLOG line if it comes up, not something to silently conflate with phrase
search now.

**Ranking and grouping — worked examples:**

- **"Melchizedek" (rare, 14 hits, one section of Hebrews + Genesis + Psalms):**
  small enough to show all 14 with no cap. Group by book in canonical (not
  alphabetical) order — Genesis 14 first, then Psalm 110, then Hebrews 5-7 —
  matching how `bibleBooks.ts`'s `book_number` already orders everything
  else in the app. This reads as "here's every place scripture mentions
  this," which is exactly what a rare-term search is *for*.
- **"love" (common, 583 hits):** must be capped and paginated/truncated, not
  dumped. Recommend the same pattern `parseScriptureQuery` already
  established for ambiguous book prefixes: return a small ranked slice (e.g.
  20) plus a "583 matches — refine your search" affordance, rather than
  inventing a relevance-scoring model. Verse order (canonical, not
  relevance-scored) is the right default ranking — there is no click-through
  or usage data yet to rank by relevance, and canonical order is at least
  predictable and matches how a Bible search users already know (e.g. a
  concordance) behaves.

## 5. UI surface — extend the existing command palette, don't invent one

`GlobalSearch.tsx` (`src/components/GlobalSearch.tsx`) is already the
desktop command-palette-style search: the `'bar'` variant expands from the
resting top-nav slot to a centered, backdrop-dimmed palette on focus
(Notion/Linear/GitHub-style — see the comment block at line 37), with a `/`
keyboard shortcut, arrow-key navigation across a single flattened result
list, and a `'surface'` variant that's the equivalent full-page search for
mobile. This is the surface to extend, not a new one to build.

Concretely:

- **A third `search-section`**, `data-section="verses"`, between the
  existing "Jump to scripture" and "Notes" sections (reference jump first —
  it's the fastest, most deterministic answer when the query *is* a
  reference; verse text next; user notes last, since notes are about the
  user's own prior thinking on a passage and are most useful once they've
  already seen what scripture and other-people's-scripture-search turned up).
- **Visual distinction from note results** is mostly free: verse rows reuse
  the existing `.search-result-ref` treatment (bold reference label, same
  as scripture-jump rows) but need the *matched verse text* (with the query
  substring highlighted, e.g. `<mark>`) where note rows show a content
  preview — same layout shape (`.search-result-note-top` +
  `.search-result-note-preview` from `main.css:810+`), different label
  ("Genesis 14:18" not "Do not commit adultery…").
- **Visual distinction from a reference jump** is inherent: reference-jump
  rows show a book/chapter *destination* with an "Open chapter" affordance
  and no snippet; verse-search rows show matched *text* with a highlighted
  term and no "open" verb — the shapes don't overlap even before styling.
- **Empty result:** fold into the existing `nothing` empty state
  (`"No scripture reference or notes match…"` → extend the copy to mention
  verses), not a separate empty state per section — `GlobalSearch` already
  treats "no scripture reference candidates" as a normal, silent
  zero-section case (see `scriptureResults.length > 0 &&` guard); verse
  search should do the same.
- **Huge result set (the "love" case):** capped ranked slice + a "N
  matches" affordance per §4, not an infinite/paginated list inside a
  dropdown — a command palette is for getting somewhere fast, not for
  reading a concordance report.

## 6. Offline interaction — honest coupling to the prefetch item

Verse search **depends on the same `public/bible/bsb.json.gz` bundle** as
the deferred "Full-Bible offline prefetch" BACKLOG item, but the dependency
is **one-directional and does not block search**:

- Search needs the bundle **in memory for the duration of the search
  session** — a single lazy fetch-and-decompress (§2, ~50-80 ms, once),
  exactly like `SelfHostedBibleProvider` already does on helloao failure.
  It does **not** need the bundle written into IndexedDB
  (`berean-bible-cache`), and it does **not** need every chapter
  pre-cached for offline *reading* — those are what the prefetch item is
  actually about.
- **Verse search can and should stand alone**, lazy-loaded only when the
  user's query looks like a text search (not a reference — `parseScriptureQuery`
  already tells them apart) rather than on every app load. This preserves
  the explicit design constraint already on record in BACKLOG.md: the
  bundle is deliberately excluded from the service-worker precache
  (`globIgnores` in `vite.config.ts`) specifically so it doesn't cost every
  user ~1.2 MB on first load. **Search must not silently reverse that
  decision** — the first scripture-text keystroke, not app boot, is the
  trigger for the fetch, and only for the searcher, one time per session
  (module-level memoization, same pattern `SelfHostedBibleProvider.load()`
  already uses).
- The prefetch item remains valuable independently (guaranteed offline
  *reading*, no search involved) and shipping search first does not
  foreclose it — if anything, once verse search exists and a user has
  triggered the lazy load once, the marginal cost of also writing that
  in-memory bundle into IndexedDB (what the prefetch item wants) drops,
  since the parse work is already paid for. **Do not gate search on
  prefetch shipping first; they're independently shippable, in either
  order.**

## 7. Diff size, effort, and whether this splits

Estimated as a single small-to-medium feature, one PR, roughly:

| piece | estimate |
|---|---|
| `src/bible/search.ts` (or similar) — lazy-load bundle via a reused/exported loader from `self-hosted.ts`, flatten, substring-scan + phrase logic, cap/truncate, canonical-order group | ~80-120 lines + tests |
| `GlobalSearch.tsx` — third async section (mirrors the existing note-search `useEffect`/debounce shape), wiring into `flatResults` for keyboard nav | ~40-60 lines |
| `main.css` — verse-result row style (reuses existing `.search-result*` classes, adds a `<mark>` highlight style) | ~15-25 lines |
| tests (`search.ts` unit tests: fold, phrase, cap; a `GlobalSearch` render test for the third section) | ~60-100 lines |

**Total: roughly 200-300 changed lines, one PR, no schema change, no new
dependency.** This does not need to be split — it's one coherent seam
addition (a new `getVerseSearchResults`-shaped function plus one UI section
consuming it), smaller than the `study-id` investigation this brief's
BACKLOG neighbor produced, and there's no natural phase boundary inside it
(an index-first phase was considered and rejected in §3, which would have
been the only plausible split point).

If effort estimation during implementation proves this wrong (e.g. the
lazy-load/memoization plumbing turns out to want its own refactor of
`self-hosted.ts` to share the loader cleanly), the natural split is:
**(1) extract/export a shared `loadBsbBundle()` loader from `self-hosted.ts`
with no behavior change, (2) build search on top of it.** That split is
cheap to make later and not worth pre-emptively doing now.

## 8. Build now, or wait? — a named trigger either way

**Recommendation: build it now.** Every blocker that justified deferring
this is gone:

- "We don't have the full text" — solved 2026-07-20 (`bsb.json.gz` ships).
- "We don't know if a scan is fast enough" — answered in §3 with real
  numbers: yes, by a wide margin.
- "It might force every user to download the whole Bible" — addressed in
  §6: it doesn't have to, and the lazy-load design avoids it.

The remaining honest reason to wait would be **prioritization, not
feasibility** — Lantern has one real user and is about to be shared with a
small group per the task brief. If the call is to wait, the trigger to
revisit should be **the first time a real user (Dennis or someone in the
small group) reaches for the existing note search expecting it to also
search scripture text and it doesn't** — i.e. a real "I typed 'Melchizedek'
and expected to see Genesis 14, not just my own notes" moment. That's a
cheap, concrete, personally-observable signal, not a vague "someday." Given
the diff size in §7 is small and the risk (per §6) is well-contained, there
isn't a strong case for waiting for that signal rather than just shipping
ahead of it — but if Dennis's priority stack has something more pressing,
that trigger is the right one to park this behind, not a calendar date.

## 9. Evidence — reproduce these numbers yourself

Two scratch scripts (not committed — this brief is docs-only per its
`files_out_of_scope`) produced every number above:

**Node, native zlib** (`gzip`/decompress/parse/flatten + scan + index
timings, §2/§3):

```
gzip bytes: 1273758
decompressed bytes: 4098940
decompress time (ms): 15.44
JSON.parse time (ms): 26.04
flatten time (ms): 8.92
verse count: 31086
linear scan "love": 6.823 ms/call, 583 hits
linear scan "Melchizedek": 5.615 ms/call, 14 hits
linear scan "zzzznomatch" (no match): 4.784 ms/call, 0 hits
build inverted index: 186.187 ms/call, 14182 unique tokens
index JSON size (bytes): 3533382
index gzip size (bytes): 1484710
index lookup "love": 0.0007 ms/call, 331 hits
index lookup "melchizedek": 0.0001 ms/call, 14 hits
tokens present: love= true loved= true loveth= false
sample Melchizedek verse: 1 14 18 Then Melchizedek king of Salem brought out bread and wine—since he was priest of God Most High—
```

(583 vs. 331 for "love" is the §4 distinction made concrete: 583 is the
substring scan — it also catches "loved"/"loving"/"beloved"/etc. — while 331
is the token-exact index lookup, which only matches the literal word "love"
and misses every inflection. This is the actual evidence behind the "don't
token-exact match" recommendation in §4, not just an assertion.)

**Chromium via Playwright**, against `npm run dev` on `localhost:5173`
(§2 browser cross-check):

```json
{
  "fetchedBytes": 4098940,
  "wasGzipOverWire": false,
  "decodedJsonLength": 4058608,
  "fetchMs": 56.6,
  "decompressMs": 6.6,
  "jsonParseMs": 14.9,
  "flattenMs": 4.9,
  "verseCount": 31086,
  "loveScanMs": 15.4,
  "loveHits": 583,
  "melchScanMs": 6.8,
  "melchHits": 14
}
```

`git status --short` at the time of writing this proposal (no `src/`
changes — this brief is docs-only):

```
?? docs/proposals/scripture-search.md
```
