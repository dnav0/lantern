import type { BibleProvider, BibleVerseLine } from './provider'

// The self-hosted complete-BSB fallback. helloao.ts is the PRIMARY scripture
// source; this provider exists so that helloao being down never takes the read
// path down with it — it can serve any of the 1,189 chapters from a bundle we
// ship ourselves (public/bible/bsb.json.gz, built by scripts/build-bsb-bundle.mjs).
//
// LAZY BY DESIGN. The bundle is ~1.2 MB gzip. We never fetch it on a normal,
// successful read — the FallbackBibleProvider only calls this provider after the
// primary throws. The first such call downloads and decompresses the bundle
// once; the parsed result is memoized for the rest of the session, so a helloao
// outage costs a single download no matter how many chapters are then read.
//
// WHY THIS SITS OUTSIDE THE CACHE (deliberate, and different from fixture.ts):
// fixture.ts must live outside the cache-forever layer because a fixture answer
// written into that store would masquerade as real scripture forever. That
// hazard does NOT apply here — this bundle is the complete, real BSB text, the
// same translation helloao serves, so caching a self-hosted answer would be
// perfectly safe. We still keep it outside the cache anyway, for a simpler
// reason: it keeps one clean invariant — the IndexedDB cache mirrors *helloao*
// and nothing else — and this provider already memoizes the whole Bible in
// memory on first use, so routing its answers through the cache would buy no
// speed. Composition is therefore FallbackBibleProvider(cache(helloao), selfHosted).

type BsbBundle = Record<string, Record<string, [number, string][]>>

const BUNDLE_URL = '/bible/bsb.json.gz'

// Fetch + gunzip + parse the bundle. Split out (and injectable via the
// constructor) so the parsing/lookup logic can be unit-tested without a real
// network fetch or a DecompressionStream.
async function fetchBundle(url: string): Promise<BsbBundle> {
  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`self-hosted BSB fetch failed: ${res.status} ${res.statusText}`)
  }
  const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'))
  const json = await new Response(decompressed).text()
  return JSON.parse(json) as BsbBundle
}

export class SelfHostedBibleProvider implements BibleProvider {
  private bundle: Promise<BsbBundle> | null = null

  constructor(
    private readonly url: string = BUNDLE_URL,
    private readonly loader: (url: string) => Promise<BsbBundle> = fetchBundle
  ) {}

  private load(): Promise<BsbBundle> {
    // Memoize the promise (not just the value) so concurrent first reads share
    // one download instead of racing several.
    if (!this.bundle) this.bundle = this.loader(this.url)
    return this.bundle
  }

  async getChapter(bookNumber: number, chapter: number): Promise<BibleVerseLine[]> {
    const bundle = await this.load()
    const verses = bundle[String(bookNumber)]?.[String(chapter)]
    if (!verses) {
      throw new Error(`self-hosted BSB has no book ${bookNumber} chapter ${chapter}`)
    }
    return verses.map(([verse, text]) => ({ verse, text }))
  }
}
