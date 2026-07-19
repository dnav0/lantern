# Backlog

Deferred work. This file is the single source of truth for it. **Rule:** whenever
an item is started, finished, or dropped, update this file in the same change —
move completed items to the bottom section, add a line when you defer something
new. Don't let it drift.

Items are roughly ordered by when they're likely to matter, not strictly
prioritized.

## Deferred

- **Lantern rebrand — remaining bits.** The user-visible rebrand landed (see
  Done). Left over:
  - **Outline the wordmark to SVG paths.** `Wordmark.tsx` renders live text in
    the self-hosted **static** Source Serif 4 (the variable package registers
    under a different family name, so there's no `opsz` axis — see the font
    self-host entry in Done). Real brands ship the wordmark as outlined vector
    so it's font-independent and can use the display optical cut. Cosmetic.
  - **Internal `Berean*` identifiers left alone, deliberately.** `BereanApi`,
    `berean-api.ts`, `SupabaseBereanApi`, and the persisted keys
    (`berean.onboarded`, `berean-theme`, `berean-visual-theme`,
    `berean-offline-mirror`, `berean-bible-cache`) were NOT renamed. Renaming
    the storage keys/DB names would silently reset every user's prefs and
    orphan their cached data; `BereanApi` is the documented seam in CLAUDE.md.
    Purely cosmetic — do it only if it ever stops being churn-for-nothing. The
    default theme's stored id also stays `berean` for the same reason (only its
    visible label became "Lantern").

- **Design sweep — remaining work.** The visual/structural + motion polish
  passes are both done: token layer (F1 + F1b warm dark), serif reading
  typography (F2), contrast (F3), top-bar/library true centering, the theme
  picker, the overlap-aware study flow, F4 motion (entrance/press/spring
  micro-interactions), and a round of mobile study-editor/nav fixes (see Done,
  below, for the full history). Bible/Journal toggle-vs-tabs was discussed and
  decided against — not adopting it, not revisiting. The note→study bridge in
  ChapterView and the font self-host are also done now (see Done). Mobile nav
  priority is closed as a deliberate decision (see Done). What's left is
  optional polish only:

  - **dark.css redundancy prune (cosmetic).** `dark.css` is now fully token-driven
    and consistent, but many of its `body.dark …` rules only restate a value the
    `tokens.css` `body.dark` reassignment already produces. They're harmless but
    could be deleted to shrink the file. Low priority, skip for the deploy pass.
  - **Elevation-over-borders + cross-surface max-width polish.** Optional refinement:
    apply the `--elev-*` scale to reader/journal/study cards (currently border-led)
    and reconcile the library vs. journal vs. book-detail max-widths for a fully
    consistent measure across every page. Optional, skip for the deploy pass.

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

- **Normalize the repo with Prettier, in its own commit (low priority).** The repo
  was never formatted with the current Prettier config, so `npm run format`
  reformats ~40 otherwise-untouched files (~2700 lines). That's a landmine: run it
  as part of a feature change and the real diff drowns in reflow. Fix once, alone,
  when no other chat is mid-change in the repo — a single `npm run format` +
  `tsc --noEmit` + one commit. Until then, every contributor (human or agent) must
  avoid running the formatter as a side effect. Deliberately deferred, not
  forgotten.

- **Landing page — leftovers from the build.** The page itself is done (see
  Done). Still open:
  - **Delete the design/ specs.** `design/README.md` says the three committed
    specs are temporary and should be deleted once ported. All three now are
    (hero, features, and the mockup's layout/copy/login direction), so they can
    go — deferred only so they stay diffable while the landing settles. They are
    in git history regardless.

- **Custom SMTP email templates — SMTP is LIVE, templates remain.** The Brevo
  SMTP pipe is set up and verified (2026-07-19): a real sign-in email arrives from
  `no-reply@lanternword.com`. Supabase Auth → SMTP Settings points at
  `smtp-relay.brevo.com:587` with the Brevo login `b274a0001@smtp-brevo.com` and a
  generated SMTP key (no-expiry; note Brevo keys still die after 90 days of *zero*
  sending, so if auth email ever stops silently, regenerate the key first). Domain
  `lanternword.com` is authenticated in Brevo (DKIM/SPF/DMARC via the automatic
  Cloudflare DNS flow), branded subdomain `send.lanternword.com`.

  **Templates are BUILT (2026-07-19), pending two steps.** Live in the repo at
  `supabase/templates/magic-link.html` (the one that matters — `signInWithOtp`
  with `enable_confirmations = false` routes through the "Magic Link" template
  for both new and returning users) and `supabase/templates/confirm-signup.html`
  (defensive duplicate). Both lead with the 6-digit `{{ .Token }}` and offer
  `{{ .ConfirmationURL }}` as the secondary path, matching `SignIn.tsx`'s code
  screen. Design-verified in-browser against the tokens (card `#fbf9f4`, indigo
  code, accent button, Georgia serif wordmark + Psalm 119:105, table layout, all
  inline styles, entities for curly quotes).

  **VERIFIED LIVE (2026-07-19):** owner pasted the template; a real sign-in email
  arrives from `no-reply@lanternword.com` (subject "Your Lantern sign-in code")
  and renders exactly as designed in a real Gmail inbox (curly quotes intact, no
  mojibake). `verifyOtp` succeeds and the app signs in — the template + delivery +
  verify loop all work.

  **OTP length mismatch — CAUGHT AND RESOLVED (2026-07-19).** The first live run
  exposed that the HOSTED Supabase project was issuing an **8-digit** code while
  `SignIn.tsx` caps the code field at `maxLength={6}`, so a real user typing the
  code could only enter 6 of 8 and sign-in would fail (the first test only passed
  because the full code was injected programmatically, bypassing the typing cap).
  `config.toml` (`otp_length = 6`) and the app copy both say 6, so the hosted
  project was the outlier. Fixed at the source: owner set the hosted Email OTP
  length to 6 (dashboard; config.toml drives only the local CLI). No code change.
  **Re-verified clean:** a fresh sign-in emailed a 6-digit code, it fit the
  field's own cap, and `verifyOtp` signed in with no bypass. **This item is now
  fully DONE** — templates built, pasted, rendered correctly in a real inbox, and
  the OTP code path works end to end for a real user.

  (Provider rationale, kept for the record: **Brevo** over Resend — its free tier
  is reserved for another project — and over Mailtrap, because the future "email
  updates to users" need is a broadcast job, contact list + campaigns + unsubscribe
  compliance, and Brevo does that plus the transactional relay in one free account.
  For *auth* email the pretty template is HTML in Supabase's own editor and the
  provider is just the send pipe, so the marketing side was the deciding factor.)

- **Google OAuth — CREDENTIALS CONFIGURED, PENDING LIVE VERIFICATION.** The code
  path (`signInWithGoogle()` in `src/api/auth.ts`, wired to the hero + dialog
  buttons) was verified locally earlier via the "provider is not enabled" error.
  As of 2026-07-19 the owner has done the dashboard setup: a Google Cloud OAuth
  client (Web application, redirect URI
  `https://dyfyxrcwxyvknupkugiv.supabase.co/auth/v1/callback`, consent screen with
  non-sensitive scopes email/profile/openid so no verification/warning), and the
  Supabase Google provider enabled with the client id + secret (Skip-nonce OFF,
  Allow-users-without-email OFF — both deliberate; the email requirement is what
  identity linking depends on).

  **Still to do (agent, verify LIVE — can be done on localhost dev):**
  1. Real flow end to end: click Continue with Google, complete Google, land
     signed in.
  2. **Identity-linking check, the important one:** sign in by email, sign out,
     sign in with Google on the SAME address, and confirm the notes are still
     there and NO second personal workspace was created. Supabase auto-links
     identities sharing a *verified* email into one `auth.users` row; that is what
     stops the signup trigger minting a duplicate workspace. Never exercised in
     this project, so it is the acceptance test for Google. This would silently
     corrupt a user's data if wrong.

  Note `signInWithOAuth` does not validate the provider (supabase-js builds the URL
  and hands the browser over with no round-trip), so before the provider was
  enabled a click stranded the user on a raw JSON error page. Now that it's live
  that risk is gone, but it's why the button was kept off until the dashboard side
  was done.

  **Consent-screen branding verification (IN PROGRESS, 2026-07-19).** Google shows
  the raw `…supabase.co` host on the account picker (not "Lantern") until the
  OAuth app's branding is verified — cosmetic, does NOT block sign-in. First
  submission was rejected with three issues; status:
  1. *"Homepage not registered to you"* — OWNER: verify `lanternword.com`
     ownership in Google Search Console using the SAME Google account as the GCP
     project (Domain property → TXT record in Cloudflare DNS), then ensure it's an
     Authorised domain on the consent screen. Primary gate; still open.
  2. *"Homepage does not explain the app's purpose"* + 3. *"App name doesn't match
     homepage"* — the app is a client-rendered SPA whose landing is a lazily-loaded
     chunk, so the served `index.html` had an empty `#root`. First fix (meta +
     `<noscript>`) was INSUFFICIENT and it re-flagged: Google's reviewer runs JS
     (so `<noscript>` is hidden) but captures before the landing chunk paints, and
     it doesn't count `<meta>`/`<title>` as homepage content (confirmed against the
     support articles answer/13807376 + answer/13804963). SECOND fix, live: a
     VISIBLE server-served fallback inside `#root` (app name "Lantern" + a plain
     description + policy links) that `createRoot` replaces on mount, plus explicit
     `application-name` and `og:site_name` = "Lantern" to match the consent-screen
     name. Real users still get the full React landing (verified: React replaces
     the fallback; crawlers/no-JS/early-capture see real content).
     THIRD attempt also failed with the identical two issues, which prompted
     research beyond Google's own docs. Two findings, both now acted on:
     - **Google caches a verification verdict PER HOMEPAGE URL.** Once a URL has
       failed, re-review does not appear to re-crawl it, so no amount of fixing
       that URL clears it. Multiple developers on the Google developer forums
       report exactly this symptom ("everything confirmed matching", still
       rejected); the fix that works for them is to point the Branding
       "Application home page" at a URL Google has NEVER crawled, which then
       passes almost immediately. See
       discuss.google.dev/t/…/372022 (fresh `/about/` URL passed "within
       seconds" after the original was stuck for a week) and …/381451.
     - **A real content gap:** the requirements say the page must "explain with
       transparency the purpose for which your app requests user data". The
       marketing landing never explained WHY Lantern asks for a Google account.
     Action: added `public/about.html` — a fresh, never-crawled URL
     (`https://lanternword.com/about`) whose `<h1>` is exactly "Lantern" and which
     states what the app does, who it is for, explicitly why Google sign-in is
     requested and which scopes (email + basic profile only, no Gmail/Drive/etc.,
     and that email OTP is an alternative), plus privacy/terms links. OWNER: set
     the Branding "Application home page" to that URL and re-submit.
     FOURTH attempt (fresh `/about` URL) also failed. Further diagnosis ruled out
     the remaining technical causes with evidence: fetching `/about` with a
     Googlebot UA returns 200 + full content (so Cloudflare is NOT blocking the
     crawler), there is no redirect, and publishing status is already
     **In production / External** (not Testing). One real bug was found and fixed
     along the way: `/robots.txt` was being served as the app's HTML by the SPA
     catch-all — `public/robots.txt` + `public/sitemap.xml` now exist.
     Two further findings that shape what to do next:
     - **Full app verification is NOT required.** With only non-sensitive scopes
       (email/profile/openid), Google's own docs say app verification is optional
       and only *brand* verification is needed to show a name/logo. So do NOT
       submit through the Verification Centre's "submit app for review" (that is
       the heavy sensitive-scope path) despite the generic banner on the Audience
       page prompting it. Brand verification is automated (minutes), falling back
       to a 2-3 business day manual review.
     - **Brand verification validates the name AND THE LOGO.** The uploaded OAuth
       logo (the navy "L", `public/icon.svg` → `icon-192.png`) appeared NOWHERE on
       the site — the public pages use a text wordmark only — so a checker
       comparing consent screen to homepage found no matching logo. That logo is
       now rendered next to the exact app name on both `public/about.html` and the
       `index.html` fallback. Keep those in sync with whatever logo is uploaded.
     FIFTH attempt also failed. Further fixes + eliminations:
     - **Logo file now byte-identical.** The logo uploaded to Google is
       `icon-512.png`, but the pages rendered `icon-192.png` (same artwork,
       different file). Brand verification compares the consent-screen logo to the
       site, so both pages now serve `/icon-512.png`.
     - **Googlebot allowed explicitly** in `robots.txt` (a reported stuck
       verification came down to Googlebot lacking an explicit Allow).
     - **Cloudflare caching RULED OUT** with evidence: `/about` returns
       `cf-cache-status: DYNAMIC` and `Cache-Control: max-age=0, must-revalidate`,
       so the edge never serves stale HTML.
     NEXT, and the best remaining diagnostic: **Google Search Console → URL
     Inspection** on `https://lanternword.com/about`. "Test live URL" shows
     exactly what Googlebot fetches and renders right now (screenshot + any
     resources that failed to load — that is how one forum case found a blocked
     script), and "Request indexing" forces a recrawl, which is the only way to
     refresh Google's own cached copy. If Test-live-URL renders the page
     correctly, the page is provably fine and the failure is Google's pipeline —
     which is the justification for escalating via "request additional review".
  Also fill the Branding form's homepage / privacy / terms URLs with
  `https://lanternword.com`, `/privacy`, `/terms` (now live). Then re-submit "I
  have fixed the issues". The alternative to verification entirely is the Supabase
  Custom Auth Domain add-on (paid), which changes the shown host directly.

  Original rationale follows. Adds
  alongside email OTP; links automatically to the existing account via
  verified email, so no account-merge flow needed (already a low-risk addition
  per the existing architecture). Worth it for a public launch: one-click
  sign-in removes the OTP-code/magic-link friction entirely for most visitors,
  and Google sign-in is a highly familiar, trusted pattern for a general
  (not especially technical) audience — exactly the kind of friction that
  determines whether a first-time visitor actually creates an account. Do this
  at the same time as the login redesign, not as a separate pass — same
  screen, same testing surface. **Decided: keep both Google and email, not
  Google-only** — Google as the prominent one-click default, email kept as
  the fallback ("or continue with email"). Reasons to not drop email
  entirely: account-lockout risk if something goes wrong on Google's side
  (no way back into the app's own data); a real minority of users
  specifically avoid Google-linked sign-in for a personal spiritual-journal
  app; and Apple's App Store guidelines require offering Sign in with Apple
  as a parallel option if Google/Facebook sign-in is offered — a Google-only
  app today would force adding a *third* auth method later just to ship on
  iOS (the "Capacitor mobile wrap" item below), whereas keeping email as the
  neutral fallback avoids that trigger.


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
  Still the real answer for offline readers and for `bible.helloao.org` being
  down (see the availability risk below): the cache is lazy, so today a user only
  holds chapters they have already opened, and `HelloaoBibleProvider` *throws* on
  a failed fetch rather than degrading.
  **Partially mitigated in dev only** (2026-07-15): `FixtureBibleProvider`
  (`src/bible/fixture.ts`) bundles the four chapters `seedMemoryApi` seeds, and
  `FallbackBibleProvider` serves them when the network is unreachable. It is
  gated on `import.meta.env.DEV` and tree-shakes out of production, so it does
  nothing for real users — it exists so contributors and agents in sandboxes
  without egress see real verses instead of a thrown fetch. Four chapters is a
  fixture, not a Bible; this item stands.

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

- **Modifier to restore verse-text copy under the marquee.** The desktop marquee
  suppresses native text selection over verse text (drag = box-select). Add a
  modifier (or an explicit select mode) so users can still drag-copy verse text.

- **Cloudflare Pages deploy — project + domain live; one dashboard step left.**
  As of 2026-07-19 the owner confirmed the **Pages project exists with the custom
  domain attached**: `lanternword.com` is registered at Cloudflare, DNS is live
  (proven: Brevo's DKIM/SPF authenticated through it and auth email sends), and
  the `*.pages.dev` origin is **`lantern-5jf.pages.dev`**. `supabase/config.toml`
  is now wired to production: `site_url = https://lanternword.com` and
  `additional_redirect_urls` = production + the pages.dev preview + localhost.
  Gotcha logged during setup, kept for the record: Cloudflare's Git-import now
  defaults to the **Workers** flow (`npx wrangler deploy`, expects a Worker we
  don't have); the correct path is the **Pages** product (build output `dist`,
  honours `public/_redirects`).

  **Remaining (owner, dashboard):** confirm the HOSTED Supabase project's Auth →
  URL Configuration allowlist lists `https://lanternword.com` and
  `https://lantern-5jf.pages.dev` (config.toml drives only the local CLI, not the
  hosted project). Until then, production OAuth/magic-link returns may be rejected
  by the hosted allowlist even though the code points at the right origins.

  **Decided: Cloudflare Pages** (not Vercel — the SPA fallback `public/_redirects`
  is already Cloudflare/Netlify format and the docs assume Pages; Vercel would
  need a `vercel.json` rewrite and re-documentation for no gain). **Domain:
  `lanternword.com`, registered at Cloudflare Registrar** (turned out cheaper than
  Spaceship). Registration + DNS + the Pages custom domain + Brevo's email records
  + OAuth therefore all live in one Cloudflare dashboard with no nameserver
  delegation to arrange. (Name was reconsidered and kept: it's Psalm 119:105
  compressed — *lamp/lantern* + *word* are the two nouns of the founding verse, and
  the hero already quotes it. `lantern.study` was the only cleaner alternative but
  is unlikely to be sold at Cloudflare's at-cost pricing.) Setup: connect the
  `dnav0/lantern` GitHub repo to a new Pages
  project, build `npm run build`, output `dist`, env vars `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY`. Then add `https://lanternword.com` (and the
  `*.pages.dev` preview origin) to Supabase Auth → URL Configuration, and update
  `supabase/config.toml` `site_url` / `additional_redirect_urls` to match.

## Done

- **Terms + Privacy pages, login-card fine print, and prod deploy wiring
  (2026-07-19).** Three things that were gated on "the pages don't exist yet":
  - **Standalone legal pages.** `public/terms.html` and `public/privacy.html` —
    self-contained (own inline CSS, no build step, no app bundle) so they render
    identically regardless of the SPA and give stable, crawlable URLs for a
    future Google OAuth app verification. Styled to the landing's language: warm
    cream canvas, Georgia serif headings/wordmark (the app's documented fallback
    for the self-hosted Source Serif 4, which a standalone page can't load),
    indigo accent, Psalm 119:105 footer. Content is grounded in the ACTUAL
    architecture (Supabase auth by email/Google, notes stored with per-account
    RLS, Brevo for sign-in email, Cloudflare hosting, BSB via
    bible.helloao.org cached locally; no ads, no third-party tracking).
    The extensionless URLs (`/terms`, `/privacy`) come from Cloudflare Pages'
    native static-first + clean-URL handling — NOT from `_redirects`. A first
    attempt DID add explicit `/privacy`→`/privacy.html 200` rewrites, which caused
    an infinite 308 loop on the deployed pages: Pages auto-redirects
    `/privacy.html`→`/privacy` while the rewrite sent `/privacy`→`/privacy.html`.
    Removed; `public/_redirects` now holds only the SPA catch-all, with a comment
    warning against re-adding those rewrites. Verified live BOTH on the dev server
    (light mode, desktop + mobile: correct palette, 9/10 sections, cross-links, no
    mojibake, no horizontal overflow) AND on production after deploy
    (`lanternword.com/privacy` and `/terms` serve real content, 200, no loop; the
    app root and SPA fallback still work). **Owner still to review the substance** before public
    launch: contact address (`hello@lanternword.com` — ensure it routes), the
    governing-law line, and the effective date; flagged in each file's header
    comment.
  - **Login-card fine print restored.** `SignIn.tsx`'s email step now shows "By
    continuing you agree to the Terms and Privacy Policy" (new `.ll-legal` style
    in `landing.css`), linking to `/terms` and `/privacy` in a new tab. Held back
    originally because the links went nowhere; now they don't. Verified rendering
    in the live dialog.
  - **Prod deploy wiring.** `supabase/config.toml` `site_url` /
    `additional_redirect_urls` moved off localhost to
    `https://lanternword.com` + `https://lantern-5jf.pages.dev` + localhost. The
    hosted-dashboard allowlist confirmation remains an owner step (see the
    Cloudflare Pages item under Deferred).
  Build (`tsc --noEmit` + vite) clean; `dist` emits both html pages + the updated
  `_redirects`.

- **PWA PNG icons regenerated from the new mark, plus a browser favicon.** The
  three manifest icons (`public/icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`) still carried the retired Berean book mark; they're now
  rasterised from `public/icon.svg` (serif "L" on brand navy). The maskable
  variant is full-bleed navy with the L scaled to 80% so it survives an aggressive
  platform mask; the other two keep the rounded-rect tile. Rendered with `sharp`
  in an isolated scratchpad (no project dep added — the earlier "agent can't
  rasterise" note was wrong: sharp does SVG→PNG natively, no Chromium), verified
  visually at size. Also added the browser-tab favicon that was simply missing:
  `index.html` now links `/icon.svg` (SVG favicon) and `/icon-192.png`
  (apple-touch-icon for iOS home screen). The regen script is
  `scratchpad/render-icons.mjs` if these ever need redoing.

- **Landing pass 2 — spacing, the button model, and the anti-SaaS turn.** Owner
  review of pass 1: slightly cramped (especially on wide displays), the buttons
  were confusing, and "Get started free" implied a SaaS pricing model.
  - **The buttons were one action wearing two labels.** "Get started" and "Sign
    in" both opened the same dialog, because first sign-in *is* sign-up
    (`shouldCreateUser: true`) — there is no separate signup path to send anyone
    down. That pair is a SaaS funnel convention (free tier vs returning
    customer) borrowed into a product with no funnel. **Decided: the only real
    choice is *how* to sign in, so that is the only one offered.** Nav is a
    single "Sign in"; the hero is "Continue with Google" + "Continue with email"
    (which is what the approved mockup always specced); the CTA is one button.
    `SignIn` takes `emailFirst` so the hero's email choice isn't re-asked inside
    the dialog.
  - **Anti-SaaS.** "Get started free" → "Start your first study", CTA heading →
    "Ready when you are.", and the hero's "Free to use" → "Nothing to buy" (the
    word *free* only needs saying where a paid tier is implied). Added a **"The
    name" section**: Psalm 119:105, why a lantern (carried, lights one step), and
    a short first-person note on why the tool exists. This also restores the
    mockup's "The name" nav link, which pass 1 dropped as a dead link.
  - **Spacing.** `--wrap` opens 1140 → 1320px at ≥1440 (one step, not endless
    scaling — prose still wants a readable measure); hero padding 76 → 104/128px,
    feature padding 40 → 72/88px, gaps 44 → 64/96px, clip frames 290 → 330px on
    wide.
  - **Google's mark needed the spec's white chip.** Dropped onto the accent-fill
    hero button it read as broken (Google requires the official multicolour G, so
    it cannot be recoloured to the palette). `lantern-mockup.html` had already
    solved this with a white `g-chip`; pass 1 missed it.
  - Verified live at 1728/1440/360px, light + dark: no horizontal overflow, the
    name section stacks, the dialog shows Google over the email divider.

- **Public landing page.** `Root.tsx`'s `signedOut` phase rendered a bare
  `SignIn` screen: an unauthenticated visitor got an email field and no
  explanation of what the app was. It now renders a real landing page
  (`src/components/landing/`, `src/assets/landing.css`), with sign-in moved
  behind its CTAs as a dialog over the page. Ported faithfully from the approved
  specs (`design/lantern-mockup.html` layout/copy, `design/lantern-hero.html`
  hero, `design/lantern-features.html` clips); structure is nav → hero
  flythrough → the three feature clips → CTA → footer.
  - **The specs disagreed with each other, and the newest won.**
    `lantern-mockup.html` predates two later decisions, so porting it literally
    would have undone them: it draws the **retired book+beacon pictorial mark**
    in the nav, footer, and login card (identity is wordmark-only — now
    `<Wordmark />`), and its hero is a **static card superseded by**
    `lantern-hero.html`'s flythrough. Its static "Four lenses" and "Read. Note.
    Return." sections were replaced by the three clips (owner's call — one of the
    clips *is* Four lenses, so keeping both duplicated a section). The hero clip's
    topbar lamp icon (same retired mark) became the wordmark, matching the real
    app's top bar. The login card dropped its separate mark: with a wordmark it
    would render "Lantern" twice, stacked, above "Welcome to Lantern".
  - **Two real bugs the live check caught, both invisible to a build:**
    1. **The landing could not be scrolled at all.** `main.css` locks the app
       shell (`html, body, #root { height:100%; overflow:hidden }`) — right for
       the app, fatal for a 2300px page: everything below the fold was
       unreachable. `.landing` is now its own scroll container, which keeps the
       fix local (nothing to unwind on sign-in, no unlocked body leaking into the
       app). Note for whoever adds the next full-page surface: scripted
       `scrollIntoView` still "works" on an `overflow:hidden` container, so it
       masks this — a wheel is the only honest test.
    2. **The hero's loop visibly jumped on phones.** The spec collapses the
       verse-1 note after a hardcoded 210px of scroll, which clears it on a
       600px-wide card but leaves it in plain sight at 360px (measured: note
       bottom at 285px), so the compensation fired on visible content. That
       distance is now **measured** (`noteBottom + CONFIG.noteClearance`), which
       reproduces the spec's 210px at desktop and adapts elsewhere. The mobile
       clip also steps down its type/rail (the 190px rail crushed scripture to
       ~125px and 7-line verses).
  - **The loop machinery is ported, not rewritten** (`useClipLoop.ts`) — the
    specs' imperative `while(true)` scripts run as-is, since the sequences are
    the approved artifact and the hero measures real layout (see
    `design/README.md`: the clone + translateY compensation are load-bearing).
    Added around them: cancellation (a loop can't outlive its component or stack
    up) and IntersectionObserver gating (four always-running loops is the
    difference between a calm page and a hot laptop). The landing is
    `React.lazy`-loaded, so signed-in users never download it (26 kB JS + 15 kB
    CSS, a separate chunk).
  - Verified live at 1440px and 360px, light + dark, on a real (visible) browser:
    the flythrough types both notes and glides the chapter; **the seamless splice
    was measured, not eyeballed** — sampling a verse's screen position every
    frame across a full scroll showed a steady ~1.05px/frame and **zero
    discontinuities** at either width, matching the spec's "0px shift" claim.
    Clips 1–3 all run; the login dialog opens from every CTA. No horizontal
    overflow at 360px. Build (`tsc --noEmit` + vite) clean.
  - **Not verified live:** the `prefers-reduced-motion` resting states. The
    available browser tooling can't emulate that media query, and the flag is read
    at mount, so it can't be toggled in-page. The paths render statically by
    construction (each clip has a resting state; every loop is skipped) but no one
    has actually looked at them — worth a manual pass with the OS setting on.

- **GitHub repo renamed `dnav0/berean` → `dnav0/lantern`.** Finishes the
  user-visible rebrand outside the code. The local remote was repointed; GitHub
  redirects the old URL, so existing clones keep working. The local folder stays
  `D:\Projects\berean` deliberately (the path is fine, renaming it buys nothing).

- **Lantern rebrand (user-visible) + wordmark identity.** The app is now
  **Lantern**, not Berean. Driver: "Berean" collides in-category with the
  **Berean Standard Bible** — the very translation the app displays — so app-store
  and search results are a wall of "Berean Study Bible" apps, and every good
  domain is taken by Bible ministries. "Lantern" ties to Psalm 119:105 ("your
  word is a lamp to my feet"), and its only real collisions are out-of-category
  (a censorship VPN), so it's far more ownable inside Bible study. Domain
  decided: **`lanternword.com`** (brand-word first, so people read "Lantern" as
  the name; "Word" = Scripture, which resonates with the audience; and it dodges
  the `lanternstudy`/`lanternstudy.com` reversal confusion). Verified available;
  note the GoDaddy connector reports premium/aftermarket domains as "available"
  even at $10k+, so `inthemargin.com`/`illumined.com` were mirages.
  - **The identity is wordmark-only** (`src/components/Wordmark.tsx` +
    `.wordmark` in `main.css`), set in the app's own scripture serif so the
    brand speaks in the voice the app reads Scripture in. This followed a long
    exploration in which **every pictorial mark failed a concrete test**, and
    those findings are worth keeping so nobody re-treads them: a **lantern
    object** is too complex to reduce (stripped down it reads as a bag/bell/jar);
    an **open book** is depth-ambiguous at mark size (four renderings — outlined,
    solid, edge-on, page-stack — all failed; you can't tell a closed back cover
    from an open book); a **lamp** contradicts the name (a lantern is *carried*,
    a pendant is *fixed*); and a **flame on a book** risks reading as a *burning
    Bible*, which is disqualifying for this product. A wordmark is unambiguous,
    timeless, and makes the mark and the name one thing by definition.
  - **Changed:** `Wordmark` replaces the retired `AppLogo` (book+beacon, deleted)
    in `NavBar`, `SignIn`, `Onboarding`; `index.html` title; PWA manifest
    `name`/`short_name` in `vite.config.ts`; `package.json` name; the default
    theme's visible label ("Berean" → "Lantern"); and `public/icon.svg` is now a
    serif "L" on the brand navy, drawn as **outlined shapes rather than `<text>`**
    because a favicon renders in isolation where the self-hosted font isn't
    guaranteed. Verified live on the memory stub: title reads "Lantern", the
    wordmark resolves to Source Serif 4 600, and no "Berean" text remains in the
    UI. `tsc --noEmit` clean. See Deferred for the leftover PNG icons, the
    outlined-wordmark step, and why internal `Berean*` identifiers stayed.

- **Journal entry delete.** `JournalPage.tsx` rows had no delete affordance;
  added one per row without threading through `App.tsx` (the page already holds
  `useApi()` + its own entries state). Each entry is now wrapped in a
  `.journal-entry-row` so a `.se-icon-btn.se-icon-danger` delete button sits as
  a *sibling* of the row `<button>` (never nested — invalid HTML), overlaid at
  the right edge, hover/focus-revealed (`opacity 0→1`) on pointer devices and
  always visible under `@media (hover: none)` for touch; the card reserves
  `padding-right: 40px` so neither the date nor the preview runs under the icon.
  Confirmation uses the existing modal `ConfirmDialog` (matching how larger
  deletes are confirmed) — "Delete this study?" with the reference label and a
  correctly-pluralized note count, `Cancel` (ghost, autofocused) / `Delete`
  (danger). Delete calls `BereanApi.deletePassageAll(passageId)` (cascade
  removes sessions/notes in both impls) and drops the row from local state on
  success rather than refetching; a failed delete leaves the dialog and row in
  place. Verified live on the memory stub (`.env` moved aside): the seeded
  "John 1:1-5" study's delete button renders with the right classes/aria, the
  dialog shows the correct copy + singular "1 note", confirming removes the row
  and reveals the empty state, and the button inherits the correct
  `--text-faint` icon color in dark mode. `tsc --noEmit` clean. UI-only — no
  schema/`BereanApi` change.

- **Design sweep closeout: note→study bridge in ChapterView, self-hosted
  scripture fonts, mobile nav priority decision.**
  - **Note→study "Open study" bridge in `BookDetailPage`'s ChapterView.**
    Note cards there previously only had Edit/Delete; `ReadingMode` already had
    a third "Open study" button (`onOpenStudy` → `App.tsx`'s
    `handleOpenStudy(passageId)`). `ChapterView` now has the same button,
    resolved per-note via a new `resolveNotePassageId` helper that reuses the
    existing `findOverlappingPassage` (already used by "Start study on {ref}"/
    "Study chapter") against `bookPassages` — no new matching logic. Threaded
    `onOpenStudy: (passageId: string) => void` through `ChapterViewProps` →
    `BookDetailPageProps` → `App.tsx` (`onOpenStudy={handleOpenStudy}`, same
    handler `ReadingMode` already uses). If a note's range doesn't overlap any
    known passage, the button is hidden rather than left as a dead click
    target. Verified live (memory stub, `.env` moved aside): clicking "Open
    study" on the seeded John 1:1 note correctly opens `StudyMode` on the
    existing "John 1:1-5" passage with its note loaded, both at desktop
    (1280px) and mobile (375px) widths. Build (`tsc --noEmit` + vite) clean.
  - **Self-hosted scripture fonts.** `index.html`'s Google Fonts `<link>` +
    preconnects for Source Serif 4 (400/500/600) and Newsreader (400/500) are
    gone, replaced with `@fontsource/source-serif-4` and `@fontsource/newsreader`
    (static per-weight CSS, only the weights `tokens.css` actually references),
    imported in `main.tsx`. Both packages register the same family names
    already used by `--scripture-font`, so `tokens.css` needed no changes — a
    variable-font (`@fontsource-variable/*`) alternative was tried first but
    registers under a different family name (`"Source Serif 4 Variable"`) and
    was dropped in favor of the static packages to avoid touching tokens.css.
    `vite.config.ts`'s PWA precache glob already included `woff2`, so no config
    change was needed — confirmed via `npm run build`, which emits the font
    files under `dist/assets/` and precaches them (36 entries). Georgia stays
    as the fallback for genuine load failures. Verified live: font requests
    resolve to `localhost` (not `fonts.googleapis.com`), and `.verse-text`'s
    computed `font-family` resolves to `"Source Serif 4"` in both light and
    dark mode.
  - **Mobile nav priority — closed as uniform-at-rest, deliberately.** Three
    distinct mechanisms were tried and reverted across earlier passes: accent
    color on the Study icon (read as "permanently selected"), a filled badge on
    Study (still read as "off"), and opacity de-emphasis on Journal/Profile via
    a `nav-tab-low` class (removed entirely). Rather than attempt a fourth
    treatment, the decision is that uniform-at-rest is fine: priority already
    shows up through real usage (Bible as the landing destination, Study
    reachable from several entry points — chapter button, verse selection,
    nav) without needing an icon-level cue that has three times now read as
    visual noise instead of signal. No further code change; this closes the
    item.

- **F4 — motion layer.** Entrance/press/spring micro-interactions built on
  `tokens.css`'s `--ease-*`/`--dur-*`/`--elev-*` scale, in a new
  `src/assets/motion.css` (imported last in `main.tsx`) so its additive
  `transform`/`animation` rules layer on existing hover-state rules without
  restating them. Pure CSS throughout — no animation library. Landed across
  several rounds of live-feedback iteration (the blow-by-blow is git history,
  not repeated here); what shipped:
  - **Where motion lives.** A shared tactile hover-lift/press-settle on every
    repeat-use clickable surface (book rows, search results, verse action
    buttons, nav tabs, the avatar, note cards, dialog/settings buttons). The
    quick-edit card (`QuickEditCard.tsx` — see below) and the verse-selection
    action bar spring in on open. The desktop search box
    (`.global-search--bar`) travels from its resting top-bar slot to a
    centered, page-dimmed command-palette position on focus, closes on a
    second "/" (which also clears the query), and supports arrow-key
    navigation + Enter through its results. Scripture (`ScriptureSkeleton.tsx`)
    and Journal show a shimmering placeholder instead of bare "Loading…"
    text, and scripture reveals top-down verse-by-verse once loaded
    (`--stagger-i`-keyed, capped so a 176-verse chapter doesn't cascade for
    seconds). The mobile study scripture panel's expand/collapse actually
    animates now and supports a manual drag-resize handle
    (`.study-resize-handle`) to any height, not just the two presets. Desktop
    nav has a measured sliding indicator between Bible/Journal
    (`.topnav-tab-indicator`, `NavBar.tsx`); Study is deliberately excluded
    from the slide (its own accent-filled active look doesn't compose with a
    shared highlight) and fades in/out at wherever the indicator last was
    instead. The app shell fades in once, calmly, at true boot only
    (`.topnav`/`.bottomnav`, plus Bible Library specifically since it's the
    default landing destination — gated by a module-level `hasBooted` flag
    in `BibleLibrary.tsx`, not timing-sensitive React state, so it can't be
    cut short by an unrelated re-render).
  - **Where motion deliberately does NOT live, and why.** Per-item stagger
    and entrance fades on Library/Journal content, and a fade on every
    tab-switch, were all tried and then removed. These are frequently
    revisited screens/actions (every tab switch, every drill-down back out
    of a book) — motion well-tuned for a first look still becomes friction
    once you're sitting through it dozens of times a session. The motion
    budget is spent on rare/one-time moments (app boot) and on motion that
    communicates an actual state change (quick-edit opening, verse
    selection, search), not on decorating a list simply appearing. Journal
    specifically also delays showing its loading skeleton at all for 150ms
    (`SKELETON_DELAY_MS` in `JournalPage.tsx`) — a fetch that resolves faster
    than that never shows a skeleton, avoiding the classic "flash of loading
    state" on the common fast path; only a genuinely slower load shows it.
  - **Reduced motion.** Every rule above lives inside
    `@media (prefers-reduced-motion: no-preference)`; a global kill-switch in
    `motion.css` (near-zero `animation`/`transition-duration`, not `none`, so
    `animationend`/`transitionend` still fire) is the backstop for anything
    not explicitly wrapped, including pre-existing animations that had no
    reduced-motion handling at all before this pass (confirm dialogs,
    Settings, What's New, the offline toast). `.upd-spinner` is exempt —
    it signals real async work, not decorative motion.
  - **Gotchas worth knowing before touching this file again:**
    - An element with an `animation` targeting `opacity`/`transform`
      establishes a CSS stacking context **permanently**, for as long as the
      rule matches — regardless of whether the animation has finished
      playing. `.topnav` learned this the hard way: its boot-fade trapped
      the search backdrop/popover and the profile/workspace dropdown menus
      (all `position: fixed`/`absolute` descendants nested inside it) into
      an undefined stacking position, silently painting them *below*
      `.main-area`'s later content regardless of their own `z-index`.
      Fixed by giving `.topnav` an explicit `position: relative; z-index:
      140`. If you add an animation to a new ancestor element, check what's
      nested inside it.
    - Giving an ancestor of a `position: fixed` element ANY `transform`
      value — even a no-op `translateY(0)`, even only for an animation's
      duration — establishes a new containing block for that descendant,
      repositioning it relative to the ancestor instead of the viewport.
      This is why `.topnav`'s boot animation is fade-only (no transform):
      `GlobalSearch`'s fixed-position box lives inside it.
    - A CSS animation's keyframe `transform` (e.g. `springIn`'s
      translateY/scale) permanently overrides any separately-cascaded static
      `transform` on the same property — so `left: 50%; transform:
      translateX(-50%)` centering tricks silently break on any element that
      also has an entrance animation touching `transform`. Center via
      `left: calc(50vw - half-width)` instead when both are needed.
    - Measuring an element's position/size for later use (`GlobalSearch`'s
      `--rest-*`, the desktop nav indicator) must happen in
      `useLayoutEffect`, not `useEffect` — the latter runs after the
      browser's first paint, so a CSS fallback value gets painted for one
      real frame and then visibly animates to the correct position once the
      effect catches up.
    - A custom property can't be reassigned in terms of itself on the same
      selector (`--scripture-size: calc(var(--scripture-size) * …)` is a
      self-reference cycle, invalid per spec) — `--text-scale` multiplies
      `--scripture-size` at the point of use (`.verse-text`) instead.
  - Also landed alongside the motion pass: a from-scratch quick-edit note UI
    (`QuickEditCard.tsx`, replacing a bare textarea + text-link buttons with
    a bordered card, category accent, and real labeled icon buttons, used
    for both creating and editing a note) with a matching inline delete
    confirmation (`InlineDeleteConfirm.tsx`, replacing a modal `ConfirmDialog`
    for this one case); a more prominent mobile search entry point in the
    Bible Library header for the "find a reference fast, mid-service" case;
    and a user-adjustable Settings "Scripture text size" picker
    (`useTextSize.ts`, mirroring `useTheme.ts`'s pattern) plus a ~10% mobile
    size reduction, since the desktop "hero" scripture size ate most of a
    375px line width.
  Verified live throughout (puppeteer-driven pointer sequences and
  computed-style/CSSOM inspection) at desktop and mobile widths, light +
  dark, across all 4 visual themes where relevant. Build
  (`tsc --noEmit` + vite) clean.

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
