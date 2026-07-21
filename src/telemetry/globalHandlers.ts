// Global error capture.
//
// The React error boundaries catch render-time throws in their subtree, which
// is most of what breaks a UI — but not all of it. An event handler, a promise
// rejection in a data-fetch, an error thrown from a timer: none of those pass
// through a boundary. Those are exactly the failures nobody anticipated, which
// is the whole reason to have error telemetry rather than a list of known
// problems.
//
// This is only safe to hook up because of the guarantee in src/errors.ts. A
// naive global handler would ship `event.message` straight to a server, and
// `event.message` is arbitrary text from code that never heard of this rule.
// Going through toTelemetrySafe() means the message is never read at all —
// only the class, the stripped frames, and a code.

import { toTelemetrySafe } from '../errors'
import { reportError } from './client'

let installed = false

/**
 * Idempotent. Safe to call from a module that may be evaluated twice under HMR.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', event => {
    // `event.error` is the thrown value when there is one. When there isn't
    // (a cross-origin script error, where the browser gives us a bare
    // "Script error." and nothing else), there is genuinely nothing useful and
    // nothing safe to report, so we skip rather than send a placeholder that
    // would fingerprint as one big meaningless bucket in HQ's inbox.
    if (!event.error) return
    reportError(toTelemetrySafe(event.error), 'window-error')
  })

  window.addEventListener('unhandledrejection', event => {
    if (!event.reason) return
    reportError(toTelemetrySafe(event.reason), 'unhandled-rejection')
  })
}
