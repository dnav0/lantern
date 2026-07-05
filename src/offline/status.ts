// offline/status.ts — a tiny event emitter for offline/online state, decoupled
// from React so SupabaseBereanApi (plain TS, no component tree access) can
// report state changes and any component can subscribe via useSyncExternalStore.
//
// Detection is via fetch failure (network errors / TypeError from a failed
// fetch), NOT navigator.onLine — navigator.onLine only reflects whether the
// OS thinks an interface is up, which is unreliable (e.g. connected to a wifi
// AP with no internet still reports online). We flip to "offline" the moment
// a request throws a network error, and flip back on the browser's 'online'
// event or the next successful request.

export class OfflineError extends Error {
  constructor(message = "You're offline — changes can't be saved yet.") {
    super(message)
    this.name = 'OfflineError'
  }
}

type Listener = (offline: boolean) => void

let offline = false
const listeners = new Set<Listener>()

export function isOffline(): boolean {
  return offline
}

export function subscribeOffline(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setOffline(next: boolean): void {
  if (offline === next) return
  offline = next
  listeners.forEach(l => l(offline))
}

/** Call after a network operation fails with what looks like a connectivity error. */
export function markOffline(): void {
  setOffline(true)
}

/** Call after any successful network operation. */
export function markOnline(): void {
  setOffline(false)
}

// A 'fetch failed'/TypeError from the network stack, not an HTTP error status
// or an application error. Supabase's client throws plain Errors/TypeErrors
// for connectivity failures (no `status` field), which is what we key off of.
export function isNetworkError(err: unknown): boolean {
  if (err instanceof OfflineError) return true
  if (err instanceof TypeError) return true
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = String((err as { message: unknown }).message).toLowerCase()
    return (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      msg.includes('network request failed')
    )
  }
  return false
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => markOnline())
}

// ─── Toast (non-blocking "you're offline" message) ──────────────────────────

type ToastListener = (message: string) => void
const toastListeners = new Set<ToastListener>()

export function subscribeOfflineToast(listener: ToastListener): () => void {
  toastListeners.add(listener)
  return () => toastListeners.delete(listener)
}

export function emitOfflineToast(message = "You're offline — changes can't be saved yet."): void {
  toastListeners.forEach(l => l(message))
}
