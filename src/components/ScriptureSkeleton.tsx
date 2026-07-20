import React from 'react'

interface ScriptureSkeletonProps {
  lines?: number
  // PassagePane's column is narrower than the full chapter readers'.
  narrow?: boolean
}

// Placeholder shown while scripture text is being fetched — a shimmering
// column of verse-shaped bars (varied width, alternating a short "verse
// number" nub) rather than a bare "Loading…" string, so populating scripture
// reads as "already arriving" instead of a stalled blank page. Widths are
// fixed (not randomized) so the skeleton doesn't jitter across re-renders.
export default function ScriptureSkeleton({
  lines = 9,
  narrow
}: ScriptureSkeletonProps): React.ReactElement {
  return (
    <div
      className={`scripture-skeleton${narrow ? ' scripture-skeleton--narrow' : ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          className="skeleton-verse-row"
          key={i}
          style={{ '--stagger-i': i } as React.CSSProperties}
        >
          <span className="skeleton-line skeleton-line--num" />
          <span className="skeleton-line skeleton-line--text" />
        </div>
      ))}
    </div>
  )
}
