import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from './relativeTime'

// Fixed reference instants so every assertion is independent of the wall
// clock and the machine's timezone. `now` is always passed explicitly.
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = Date.parse('2024-06-15T12:00:00.000Z')

function isoBefore(now: number, ms: number): string {
  return new Date(now - ms).toISOString()
}

describe('formatRelativeTime — invalid input', () => {
  it('returns empty string for null', () => {
    expect(formatRelativeTime(null, NOW)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('')
  })

  it('returns empty string for an unparseable string', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('')
  })
})

describe('formatRelativeTime — future and sub-minute', () => {
  it('returns "just now" for a timestamp in the future', () => {
    expect(formatRelativeTime(isoBefore(NOW, -1000), NOW)).toBe('just now')
  })

  it('returns "just now" for a timestamp seconds ago', () => {
    expect(formatRelativeTime(isoBefore(NOW, 30 * 1000), NOW)).toBe('just now')
  })

  it('returns "just now" just under the 1-minute boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, MINUTE - 1), NOW)).toBe('just now')
  })
})

describe('formatRelativeTime — minutes', () => {
  it('reports "1m ago" at exactly the 1-minute boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, MINUTE), NOW)).toBe('1m ago')
  })

  it('reports minutes for a mid-range value', () => {
    expect(formatRelativeTime(isoBefore(NOW, 5 * MINUTE), NOW)).toBe('5m ago')
  })

  it('reports "59m ago" just under the 1-hour boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, HOUR - MINUTE), NOW)).toBe('59m ago')
  })
})

describe('formatRelativeTime — hours', () => {
  it('reports "1h ago" at exactly the 1-hour boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, HOUR), NOW)).toBe('1h ago')
  })

  it('reports hours for a mid-range value', () => {
    expect(formatRelativeTime(isoBefore(NOW, 2 * HOUR), NOW)).toBe('2h ago')
  })

  it('reports "23h ago" just under the 1-day boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, DAY - HOUR), NOW)).toBe('23h ago')
  })
})

describe('formatRelativeTime — days (1-6)', () => {
  it('reports "1d ago" at exactly the 1-day boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, DAY), NOW)).toBe('1d ago')
  })

  it('reports days for a mid-range value', () => {
    expect(formatRelativeTime(isoBefore(NOW, 3 * DAY), NOW)).toBe('3d ago')
  })

  it('reports "6d ago" just under the 7-day boundary', () => {
    expect(formatRelativeTime(isoBefore(NOW, 7 * DAY - DAY), NOW)).toBe('6d ago')
  })
})

describe('formatRelativeTime — compact date (>= 7 days)', () => {
  it('switches to a compact date at exactly the 7-day boundary', () => {
    const then = new Date(NOW - 7 * DAY)
    const expected = then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    expect(formatRelativeTime(then.toISOString(), NOW)).toBe(expected)
  })

  it('omits the year when the note was written in the same year as now', () => {
    const then = new Date(NOW - 30 * DAY)
    expect(then.getFullYear()).toBe(new Date(NOW).getFullYear())
    const expected = then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    expect(formatRelativeTime(then.toISOString(), NOW)).toBe(expected)
  })

  it('includes the year when the note was written in a different year than now', () => {
    const now = Date.parse('2024-01-03T12:00:00.000Z')
    const then = new Date(now - 10 * DAY)
    expect(then.getFullYear()).not.toBe(new Date(now).getFullYear())
    const expected = then.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    expect(formatRelativeTime(then.toISOString(), now)).toBe(expected)
  })
})
