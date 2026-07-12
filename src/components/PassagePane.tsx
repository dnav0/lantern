import React from 'react'
import { BiblePassage } from '../types'
import ScriptureSkeleton from './ScriptureSkeleton'

interface PassagePaneProps {
  passage: BiblePassage | null
  loading: boolean
  highlightedVerses: Set<number>  // verse numbers to highlight
  hasAnyHighlight: boolean
}

export default function PassagePane({
  passage,
  loading,
  highlightedVerses,
  hasAnyHighlight
}: PassagePaneProps): React.ReactElement {
  if (loading) {
    return (
      <div className="passage-pane">
        <ScriptureSkeleton lines={7} narrow />
      </div>
    )
  }

  if (!passage) {
    return (
      <div className="passage-pane-empty">
        {/* Was "...reference above" — wrong on desktop (the reference field is
            beside this pane, not above it) and actively backwards on mobile,
            where the scripture panel is pinned ABOVE the reference field. */}
        <div>Type a reference<br />and press Enter to load verse text.</div>
      </div>
    )
  }

  return (
    <div className="passage-pane">
      {/* Center the passage column as a block within the pane (verse text stays
          left-aligned via .verse-text). */}
      <div className="passage-pane-col">
        <div className="passage-pane-reference">{passage.reference}</div>
        {passage.verses.map((v, i) => {
          const isHighlighted = highlightedVerses.has(v.verse)
          const isDimmed = hasAnyHighlight && !isHighlighted
          return (
            <div
              key={v.verse}
              data-verse={v.verse}
              className={`passage-verse${isHighlighted ? ' highlighted' : ''}${isDimmed ? ' dimmed' : ''}`}
              style={{ '--stagger-i': i } as React.CSSProperties}
            >
              <span className="verse-number">{v.verse}</span>
              <span className="verse-text">{v.text}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
