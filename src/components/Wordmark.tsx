import React from 'react'

interface WordmarkProps {
  /** Rendered size in px (font-size). */
  size?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * The Lantern wordmark — the brand IS the word.
 *
 * After a long exploration, every pictorial mark failed a real test: a lantern
 * object is too complex to reduce (reads as a bag/bell/jar), an open book is
 * depth-ambiguous at mark size, and a lamp contradicts the name (a lantern is
 * carried; a pendant is fixed). So the identity is wordmark-only.
 *
 * Set in the app's own scripture serif, so the brand speaks in the same voice
 * the app reads Scripture in. Note the app self-hosts the STATIC Source Serif 4
 * (see BACKLOG: the variable package registers as a different family name), so
 * there is no `opsz` axis to reach for here — the 600 cut plus tight tracking
 * carries it. Outlining this to SVG paths (font-independent) is backlogged.
 */
export default function Wordmark({
  size = 22,
  className,
  style
}: WordmarkProps): React.JSX.Element {
  return (
    <span
      className={`wordmark${className ? ` ${className}` : ''}`}
      style={{ fontSize: size, ...style }}
    >
      Lantern
    </span>
  )
}
