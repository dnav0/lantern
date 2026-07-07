// Extremely subtle relative-time formatting for note metadata. Pure web — no
// external deps. Given an ISO timestamp, returns a short human label such as
// 'just now', '5m ago', '2h ago', '3d ago', or a compact date for older notes.
// Used to render unobtrusive "when did I write this" context next to notes.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''

  const diff = now - then
  if (diff < 0) return 'just now'
  if (diff < MINUTE) return 'just now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`

  // Older than a week: a compact date. Same year drops the year for brevity.
  const d = new Date(then)
  const sameYear = new Date(now).getFullYear() === d.getFullYear()
  return d.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
