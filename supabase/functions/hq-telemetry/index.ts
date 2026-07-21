// GET /functions/v1/hq-telemetry?since=<ISO8601>
//
// The Lantern side of the HQ telemetry contract (D:/Projects/hq/TELEMETRY.md).
// HQ PULLS from here with a narrow bearer token; it never holds a database
// credential, so if HQ is compromised nothing but pre-aggregated numbers and
// content-free error records is reachable through it.
//
// ─── THIS ENDPOINT IS INERT AND HARMLESS STANDING ALONE ──────────────────────
//
// HQ's ingest side is P2 and NOT BUILT. Nobody is calling this yet, and that is
// the expected state, not a problem to solve. Nothing in Lantern reads it,
// depends on it, or degrades if it is never called: the app writes events into
// a buffer that ages out on its own, and this function only ever reads. If this
// function were deleted tomorrow the app would not notice.
//
// ─── WHAT IT RETURNS ─────────────────────────────────────────────────────────
//
//   scalars  Always the CURRENT snapshot, never filtered by `since`. HQ keeps
//            the history and derives series from it, so the project side does
//            not need to store one.
//   events   Only those with occurred_at > since. HQ advances its cursor after
//            a successful store, so a failed fetch retries rather than leaving
//            a gap. The project retains ~7 days and then drops them: HQ is the
//            long-term store, this is a buffer.
//
// The project invents NO retry logic. A failed fetch, an auth failure or a 5xx
// is itself a health signal that folds into the checks HQ already runs.
//
// ─── FINGERPRINTS ARE HQ'S JOB ───────────────────────────────────────────────
//
// This sends raw-ish fields and deliberately computes no fingerprint.
// Client-computed fingerprints drift across builds and minification, so "the
// same bug" fragments into several after a deploy. HQ normalising (code +
// top frame + boundary) means the logic can improve without every project
// redeploying, and old events re-fingerprint consistently.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { createSymbolicator, SOURCEMAP_BUCKET } from './symbolicate.ts'

const PROJECT_ID = 'lantern'

// Events per pull. HQ's cursor means a truncated response is not data loss —
// the next pull picks up where this one stopped. The response reports when it
// truncated rather than silently implying it returned everything, because a
// silent cap reads as "covered everything" when it didn't.
const MAX_EVENTS = 500

const RETENTION_DAYS = 7

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const HQ_TOKEN = Deno.env.get('HQ_TELEMETRY_TOKEN') ?? ''

/**
 * Constant-time string comparison.
 *
 * A plain `a === b` on a secret leaks its prefix through timing: an attacker
 * who can measure response time discovers the token one character at a time.
 * That is a slow attack over the public internet and a fast one from a
 * co-located caller, and the fix costs nothing, so there is no reason to bet on
 * which one applies.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  // Length itself is not secret-dependent in any useful way here, but comparing
  // over a fixed span keeps the loop's duration independent of where the first
  // difference falls.
  const len = Math.max(ab.length, bb.length)
  let diff = ab.length ^ bb.length
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  }
  return diff === 0
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

Deno.serve(async req => {
  if (req.method !== 'GET') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  // If the token is not configured, refuse everything. Failing closed matters
  // more than being helpful: an unset secret must never mean "no auth
  // required", which is how an endpoint like this ends up world-readable.
  if (!HQ_TOKEN) {
    return json({ error: 'not_configured' }, 503)
  }

  const auth = req.headers.get('Authorization') ?? ''
  const presented = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!presented || !timingSafeEqual(presented, HQ_TOKEN)) {
    // No detail about why. A caller with the right token does not need it, and
    // a caller without one should not be told whether the header was missing,
    // malformed, or merely wrong.
    return json({ error: 'unauthorized' }, 401)
  }

  const url = new URL(req.url)
  const sinceRaw = url.searchParams.get('since')
  let since: string | null = null
  if (sinceRaw) {
    const parsed = new Date(sinceRaw)
    if (Number.isNaN(parsed.getTime())) {
      return json({ error: 'invalid_since' }, 400)
    }
    since = parsed.toISOString()
  }

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  })

  // ─── Scalars: always the current snapshot ─────────────────────────────────
  const { data: scalarData, error: scalarErr } = await db.rpc('hq_telemetry_scalars')
  if (scalarErr) {
    // A 5xx here is a health signal HQ already watches for. Returning a partial
    // payload with an empty scalars array would look like "the numbers are all
    // zero", which is a far worse failure than an honest error.
    return json({ error: 'scalars_failed' }, 500)
  }

  // ─── Events: filtered by the cursor ───────────────────────────────────────
  let query = db
    .from('telemetry_events')
    .select('occurred_at, kind, code, error_class, stack, boundary, commit_sha, env, install_id')
    .order('occurred_at', { ascending: true })
    .limit(MAX_EVENTS)
  if (since) query = query.gt('occurred_at', since)

  const { data: eventRows, error: eventErr } = await query
  if (eventErr) {
    return json({ error: 'events_failed' }, 500)
  }

  // ─── Symbolicate on the way out ───────────────────────────────────────────
  // Maps come from a PRIVATE bucket via service_role. They never become public
  // and never travel to HQ — only the mapped frames do.
  const symbolicator = createSymbolicator(async (commitSha, fileName) => {
    const { data, error } = await db.storage
      .from(SOURCEMAP_BUCKET)
      .download(`${commitSha}/${fileName}.map`)
    if (error || !data) return null
    return await data.text()
  })

  const events = []
  for (const row of eventRows ?? []) {
    events.push({
      occurred_at: row.occurred_at,
      kind: row.kind,
      code: row.code,
      error_class: row.error_class ?? undefined,
      stack: row.stack ? await symbolicator.symbolicate(row.stack, row.commit_sha) : undefined,
      boundary: row.boundary ?? undefined,
      commit_sha: row.commit_sha ?? undefined,
      env: row.env ?? undefined,
      install_id: row.install_id
    })
  }

  // ─── Retention sweep ──────────────────────────────────────────────────────
  // Done here rather than in pg_cron, an extension this project does not
  // otherwise need. Wrapped so a failed sweep can never fail a pull: the sweep
  // is housekeeping, the pull is the contract.
  //
  // Note this only runs when HQ actually calls. Until HQ's ingest exists,
  // nothing sweeps — which is fine, because nothing is writing at volume
  // either, and the guard trigger's daily ceiling bounds the table regardless.
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString()
    await db.from('telemetry_events').delete().lt('occurred_at', cutoff)
  } catch {
    // Intentionally ignored.
  }

  return json({
    project_id: PROJECT_ID,
    captured_at: new Date().toISOString(),
    scalars: scalarData ?? [],
    events,
    // Explicit, so a capped response is never mistaken for a complete one.
    truncated: events.length >= MAX_EVENTS
  })
})
