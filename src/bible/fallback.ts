import type { BibleProvider, BibleVerseLine } from './provider'
import { CodedError } from '../errors'

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
        // Generic wording: the same class now backs two different fallbacks —
        // the dev-only fixture (four seeded chapters) and the self-hosted
        // complete-BSB bundle — so the message can't claim to be either one.
        //
        // A CodedError's message is only its machine code (see src/errors.ts),
        // so the useful half is pulled out explicitly here. This is a console
        // call — local to the device, never transmitted — which is exactly the
        // place the detail is meant to surface.
        console.warn(
          `[lantern] scripture fetch failed for ${bookNumber}/${chapter} — serving ` +
            'offline fallback text (real BSB).',
          primaryError,
          primaryError instanceof CodedError ? primaryError.detailForConsole() : ''
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
