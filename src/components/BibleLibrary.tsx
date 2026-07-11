import React from 'react'
import { Passage } from '../types'
import { BIBLE_BOOKS, BibleBook } from '../utils/bibleBooks'

interface BibleLibraryProps {
  passages: Passage[]
  onSelectBook: (bookName: string) => void
  // Optional signed-in name for a quiet "Welcome back" line.
  displayName?: string | null
}

const OT = BIBLE_BOOKS.filter(b => b.testament === 'OT')
const NT = BIBLE_BOOKS.filter(b => b.testament === 'NT')

function TestamentSection({
  label,
  bibleBooks,
  countByBook,
  onSelectBook
}: {
  label: string
  bibleBooks: BibleBook[]
  countByBook: Map<number, number>
  onSelectBook: (name: string) => void
}): React.ReactElement {
  return (
    <div className="bible-testament-section">
      {/* Centered heading with flanking rules — a section break, not a
          left-flush label — so it centers correctly regardless of the grid's
          own (content-sized) width instead of needing to match it pixel for
          pixel. Also just reads nicely for a Bible app. */}
      <div className="bible-testament-label">
        <span className="bible-testament-rule" aria-hidden="true" />
        <span className="bible-testament-text">{label}</span>
        <span className="bible-testament-rule" aria-hidden="true" />
      </div>
      <div className="bible-books-grid">
        {bibleBooks.map(book => {
          const passageCount = countByBook.get(book.number) ?? 0
          const studied = passageCount > 0

          return (
            <div key={book.id} className="bible-book-item">
              <div
                className={`bible-book-row${studied ? ' studied' : ''}`}
                onClick={() => onSelectBook(book.name)}
              >
                <span className={`bible-book-dot${studied ? ' visible' : ''}`} />
                <span className="bible-book-name">{book.name}</span>
                {studied && <span className="bible-book-count">{passageCount}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BibleLibrary({ passages, onSelectBook, displayName }: BibleLibraryProps): React.ReactElement {
  const countByBook = new Map<number, number>()
  for (const p of passages) {
    countByBook.set(p.book_number, (countByBook.get(p.book_number) ?? 0) + 1)
  }

  const passageCount = passages.length
  const studiedBookCount = countByBook.size

  return (
    <div className="bible-library">
      <div className="bible-library-header">
        {displayName && <p className="bible-library-greeting">Welcome back, {displayName}.</p>}
        <h2 className="bible-library-title">Bible Library</h2>
        <p className="bible-library-sub">
          {passageCount > 0
            ? `${studiedBookCount} ${studiedBookCount === 1 ? 'book' : 'books'} · ${passageCount} ${passageCount === 1 ? 'passage' : 'passages'} studied`
            : 'Click any book to begin reading'}
        </p>
      </div>

      <TestamentSection label="Old Testament" bibleBooks={OT} countByBook={countByBook} onSelectBook={onSelectBook} />
      <TestamentSection label="New Testament" bibleBooks={NT} countByBook={countByBook} onSelectBook={onSelectBook} />
    </div>
  )
}
