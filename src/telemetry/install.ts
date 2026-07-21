// The install id.
//
// Random, client-generated, and deliberately UNRELATED to auth. It exists so HQ
// can say "3 distinct installs hit this error" without identifying anyone, which
// is the difference between "this is a real bug" and "one person had a bad
// afternoon". Never derive it from a user id, an email, or anything else that
// could be joined back to a person — that single change would turn an
// anonymous counter into a tracking identifier.
//
// It is resettable by clearing site data, which is what makes it honest to
// describe that way on the privacy page.
//
// Format is 32 lowercase hex characters, matching the CHECK constraint on
// telemetry_events.install_id. The fixed width also stops the field being used
// as a smuggling channel for arbitrary text.

const STORAGE_KEY = 'berean.install-id'

function randomHex32(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

let cached: string | null = null

/**
 * The install id for this browser profile, minting one on first use.
 *
 * Returns null if localStorage is unavailable (private mode in some browsers,
 * storage disabled, an embedded webview). Telemetry is skipped entirely in that
 * case rather than falling back to a per-session id: a fresh id on every page
 * load would make one confused install look like hundreds, which is precisely
 * the signal `install_id` exists to provide.
 */
export function getInstallId(): string | null {
  if (cached) return cached
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing && /^[0-9a-f]{32}$/.test(existing)) {
      cached = existing
      return cached
    }
    const minted = randomHex32()
    localStorage.setItem(STORAGE_KEY, minted)
    cached = minted
    return cached
  } catch {
    return null
  }
}
