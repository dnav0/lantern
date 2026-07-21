// Build-time source-map handling. Runs after `vite build`, as part of
// `npm run build` (see package.json).
//
// Two jobs, in this order, and the order is load-bearing:
//
//   1. Upload every dist/**/*.map to the PRIVATE `sourcemaps` bucket, keyed by
//      the deploy's commit sha, so the hq-telemetry edge function can map
//      minified frames on the way out to HQ.
//   2. DELETE every map from dist/, always.
//
// ─── STEP 2 RUNS EVEN WHEN STEP 1 IS SKIPPED OR FAILS ────────────────────────
//
// That is the safety property this script exists to guarantee. dist/ is what
// Cloudflare Pages serves, so a map left behind is a map published to the
// entire internet — the exact disclosure the whole server-side symbolication
// design exists to avoid. A missing credential, a storage outage, a network
// blip: none of them may result in a shipped map. The failure mode is
// "symbolication degrades to raw frames", never "the source is public".
//
// Deleting is also why `sourcemap: 'hidden'` is set in vite.config.ts rather
// than plain `true`: 'hidden' emits the .map files but writes no
// `//# sourceMappingURL=` comment into the JS, so nothing points at them even
// in the window before this script runs, and nothing 404s after it.
//
// ─── SKIPPING IS NORMAL ──────────────────────────────────────────────────────
//
// With no SUPABASE_SERVICE_ROLE_KEY in the environment — every local build —
// the upload is skipped and only the delete runs. A local `npm run build` is
// therefore unaffected by any of this, which is the point: nobody should need
// credentials to build the app.

import { readdir, readFile, unlink, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const DIST = 'dist'
const BUCKET = 'sourcemaps'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const COMMIT_SHA = (
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.COMMIT_SHA ??
  ''
).slice(0, 40)

async function findMaps(dir) {
  const found = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found // no dist/ — nothing to do
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      found.push(...(await findMaps(full)))
    } else if (entry.name.endsWith('.map')) {
      found.push(full)
    }
  }
  return found
}

async function upload(path) {
  // Key is <commit>/<file>.map — the file's BASENAME, matching what appears in
  // a stack frame's URL. The symbolicator looks maps up by exactly this.
  const key = `${COMMIT_SHA}/${path.split(/[\\/]/).pop()}`
  const body = await readFile(path)
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body
    }
  )
  if (!res.ok) {
    throw new Error(`upload failed for ${key}: ${res.status} ${await res.text()}`)
  }
}

async function main() {
  const maps = await findMaps(DIST)

  if (maps.length === 0) {
    console.log('[sourcemaps] none found in dist/ — nothing to do.')
    return
  }

  const canUpload = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY && COMMIT_SHA)

  if (canUpload) {
    let uploaded = 0
    for (const path of maps) {
      try {
        await upload(path)
        uploaded += 1
      } catch (err) {
        // Do not rethrow. A failed upload must not fail the build, and above
        // all must not skip the deletion below.
        console.warn(`[sourcemaps] ${relative(DIST, path)}: ${err.message}`)
      }
    }
    console.log(
      `[sourcemaps] uploaded ${uploaded}/${maps.length} to ${BUCKET}/${COMMIT_SHA} (private).`
    )
  } else {
    const missing = [
      !SUPABASE_URL && 'SUPABASE_URL',
      !SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
      !COMMIT_SHA && 'a commit sha'
    ].filter(Boolean)
    console.log(`[sourcemaps] upload skipped (no ${missing.join(', ')}). Stripping anyway.`)
  }

  // ALWAYS. See the header.
  let removed = 0
  for (const path of maps) {
    try {
      await unlink(path)
      removed += 1
    } catch (err) {
      console.error(`[sourcemaps] FAILED to remove ${path}: ${err.message}`)
    }
  }
  console.log(`[sourcemaps] removed ${removed}/${maps.length} from ${DIST}/.`)

  // A map surviving into dist/ is a publish-the-source bug, so fail the build
  // loudly rather than let a deploy carry it. This is the one condition in this
  // script worth stopping for.
  const survivors = await findMaps(DIST)
  if (survivors.length > 0) {
    console.error(`[sourcemaps] ${survivors.length} map(s) still in ${DIST}/. Refusing to ship.`)
    process.exit(1)
  }

  // Belt-and-braces: 'hidden' should mean no JS references a map, but if the
  // vite setting is ever changed to `true` the deployed bundles would 404 on
  // every load looking for maps this script just deleted. Catch that here.
  const dangling = []
  for (const path of await listFiles(DIST)) {
    if (!path.endsWith('.js')) continue
    const text = await readFile(path, 'utf8')
    if (/\/\/# sourceMappingURL=/.test(text)) dangling.push(relative(DIST, path))
  }
  if (dangling.length > 0) {
    console.error(
      `[sourcemaps] ${dangling.length} bundle(s) still reference a removed map ` +
        `(${dangling.slice(0, 3).join(', ')}). Set build.sourcemap to 'hidden' in vite.config.ts.`
    )
    process.exit(1)
  }
}

async function listFiles(dir) {
  const found = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...(await listFiles(full)))
    else if ((await stat(full)).isFile()) found.push(full)
  }
  return found
}

await main()
