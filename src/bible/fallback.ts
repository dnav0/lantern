import type { BibleProvider, BibleVerseLine } from './provider'

// Serves `primary`, dropping to `fallback` only when primary throws.
//
// Composition order matters: this must wrap the CACHE, never sit inside it —
// FallbackBibleProvider(CachedBibleProvider(network), fixture), not
// CachedBibleProvider(FallbackBibleProvider(network, fixture)). The cache is
// cache-forever, so a fixture answer written into it would persist as if it
// were real scripture: one offline read would poison that chapter permanently.
// Keeping the fallback outside means only genuine network responses are stored.
export class FallbackBibleProvider implements BibleProvider {
  constructor(
    private readonly primary: BibleProvider,
    private readonly fallback: BibleProvider
  ) {}

  async getChapter(bookNumber: number, chapter: number): Promise<BibleVerseLine[]> {
    try {
      return await this.primary.getChapter(bookNumber, chapter)
    } catch (primaryError) {
      try {
        const verses = await this.fallback.getChapter(bookNumber, chapter)
        console.warn(
          `[lantern] scripture fetch failed for ${bookNumber}/${chapter} — serving the ` +
            'offline dev fixture. Verse text is real BSB but only seeded chapters exist.',
          primaryError
        )
        return verses
      } catch {
        // The fallback missing a chapter is noise; the network failure is the
        // actual cause, so surface that rather than "no fixture for 40/2".
        throw primaryError
      }
    }
  }
}
