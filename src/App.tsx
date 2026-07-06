import React, { useState, useEffect, useCallback, useRef } from 'react'
import NavBar, { Destination } from './components/NavBar'
import CaptureMode, { CaptureModeHandle } from './components/CaptureMode'
import ReadingMode from './components/ReadingMode'
import BibleLibrary from './components/BibleLibrary'
import BookDetailPage from './components/BookDetailPage'
import JournalPage from './components/JournalPage'
import SessionEditor from './components/SessionEditor'
import ProfilePage from './components/ProfilePage'
import ConfirmDialog from './components/ConfirmDialog'
import SettingsModal from './components/SettingsModal'
import OfflineIndicator from './components/OfflineIndicator'
import { Passage } from './types'
import { BIBLE_BOOKS } from './utils/bibleBooks'
import { useApi } from './api/context'
import { useDarkMode } from './utils/useDarkMode'

interface AppProps {
  // Signed-in display name for the "Welcome back" touch. null on the memory stub.
  displayName: string | null
  // Sign-out handler, or null when there is no auth (memory stub / dev).
  onSignOut: (() => Promise<void>) | null
}

interface AppState {
  destination: Destination
  passages: Passage[]
  // Bible destination drill-down: a book (chapter reading) or a saved passage.
  selectedBookName: string | null
  selectedPassageId: string | null
  // Journal destination drill-down: the study (passage) open in SessionEditor.
  journalPassageId: string | null
  // Study destination prefill (set when jumping in from the Bible view).
  captureReference: string
  capturePassageId: string | null
}

export default function App({ displayName, onSignOut }: AppProps): React.ReactElement {
  const api = useApi()
  const [isDark, toggleDark] = useDarkMode()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [state, setState] = useState<AppState>({
    destination: 'bible',
    passages: [],
    selectedBookName: null,
    selectedPassageId: null,
    journalPassageId: null,
    captureReference: '',
    capturePassageId: null
  })
  // Navigation guard: destination we're trying to reach while the study
  // surface has unsaved notes.
  const [pendingNav, setPendingNav] = useState<Destination | null>(null)
  const captureModeRef = useRef<CaptureModeHandle>(null)

  const refresh = useCallback(async () => {
    const passages = await api.getPassages()
    setState(prev => ({ ...prev, passages }))
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const doNavigate = (dest: Destination): void => {
    setState(prev => ({
      ...prev,
      destination: dest,
      // Tapping "Bible" always lands on the library, not a stale drill-down.
      ...(dest === 'bible' ? { selectedBookName: null, selectedPassageId: null } : {}),
      // Tapping "Journal" always lands on the index, not a stale open study.
      ...(dest === 'journal' ? { journalPassageId: null } : {}),
      // "+ Study" from the nav starts a blank study.
      ...(dest === 'study' ? { captureReference: '', capturePassageId: null } : {})
    }))
  }

  const handleNavigate = (dest: Destination): void => {
    if (dest === state.destination && dest !== 'bible' && dest !== 'journal') return
    if (state.destination === 'study' && dest !== 'study' && captureModeRef.current?.isDirty()) {
      setPendingNav(dest)
      return
    }
    doNavigate(dest)
  }

  const handleSelectBook = (bookName: string): void => {
    setState(prev => ({
      ...prev,
      destination: 'bible',
      selectedBookName: bookName,
      selectedPassageId: null
    }))
  }

  const handleSaveRead = async (passageId: string): Promise<void> => {
    await refresh()
    setState(prev => ({
      ...prev,
      destination: 'bible',
      selectedPassageId: passageId,
      selectedBookName: null,
      capturePassageId: null
    }))
  }

  const handleSaveNext = async (nextRef?: string): Promise<void> => {
    await refresh()
    setState(prev => ({
      ...prev,
      destination: 'study',
      selectedBookName: null,
      selectedPassageId: null,
      capturePassageId: null,
      captureReference: nextRef || ''
    }))
  }

  // The bridge: jump from a note in the Bible reading view (or a Journal row)
  // into the full study — the SessionEditor under the Journal destination.
  const handleOpenStudy = (passageId: string): void => {
    setState(prev => ({
      ...prev,
      destination: 'journal',
      journalPassageId: passageId
    }))
  }

  const handleCaptureFromReading = (reference: string, passageId?: string): void => {
    setState(prev => ({
      ...prev,
      destination: 'study',
      captureReference: reference,
      capturePassageId: passageId ?? null
    }))
  }

  const {
    destination,
    passages,
    selectedBookName,
    selectedPassageId,
    journalPassageId,
    captureReference,
    capturePassageId
  } = state

  const selectedPassage = passages.find(p => p.id === selectedPassageId) || null
  const selectedBibleBook = selectedBookName
    ? BIBLE_BOOKS.find(b => b.name === selectedBookName) || null
    : null

  function renderMain(): React.ReactElement {
    if (destination === 'study') {
      return (
        <CaptureMode
          ref={captureModeRef}
          key={capturePassageId ?? captureReference}
          initialReference={captureReference}
          initialPassageId={capturePassageId}
          onSaveRead={handleSaveRead}
          onSaveNext={handleSaveNext}
        />
      )
    }

    if (destination === 'journal') {
      const journalPassage = journalPassageId
        ? passages.find(p => p.id === journalPassageId) || null
        : null
      if (journalPassage) {
        return (
          <SessionEditor
            key={journalPassage.id}
            passage={journalPassage}
            onBack={() => setState(prev => ({ ...prev, journalPassageId: null }))}
            onRefresh={refresh}
            onPassageDeleted={async () => {
              await refresh()
              setState(prev => ({ ...prev, journalPassageId: null }))
            }}
          />
        )
      }
      return <JournalPage onOpenStudy={handleOpenStudy} />
    }

    if (destination === 'profile') {
      return (
        <ProfilePage
          displayName={displayName}
          onOpenSettings={() => setSettingsOpen(true)}
          onSignOut={onSignOut}
        />
      )
    }

    // Bible destination: library → book (chapters + inline notes) → passage.
    if (selectedBibleBook) {
      return (
        <BookDetailPage
          key={selectedBibleBook.id}
          bibleBook={selectedBibleBook}
          onBack={() => setState(prev => ({ ...prev, selectedBookName: null }))}
          onCapture={ref => {
            handleCaptureFromReading(ref)
            refresh()
          }}
          onRefresh={refresh}
        />
      )
    }

    if (selectedPassage) {
      return (
        <ReadingMode
          key={selectedPassage.id}
          passage={selectedPassage}
          onCapture={passageId => {
            const p = passages.find(p => p.id === passageId)
            handleCaptureFromReading(p?.reference_label || '', passageId)
          }}
          onRefresh={refresh}
          onOpenStudy={() => handleOpenStudy(selectedPassage!.id)}
          onPassageDeleted={async () => {
            await refresh()
            setState(prev => ({ ...prev, selectedPassageId: null }))
          }}
        />
      )
    }

    return (
      <BibleLibrary passages={passages} onSelectBook={handleSelectBook} displayName={displayName} />
    )
  }

  return (
    <div className="app-shell">
      <NavBar
        destination={destination}
        onNavigate={handleNavigate}
        displayName={displayName}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      <div className="main-area">{renderMain()}</div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isDark={isDark}
        onToggleDark={toggleDark}
        onSignOut={onSignOut}
      />

      {/* Navigation guard: unsaved notes on the study surface */}
      <ConfirmDialog
        isOpen={pendingNav !== null}
        title="Unsaved notes"
        message="You have unsaved notes. Save them before leaving?"
        onClose={() => setPendingNav(null)}
        actions={[
          {
            label: 'Save & continue',
            variant: 'primary',
            autoFocus: false,
            onClick: () => {
              const dest = pendingNav
              void (async () => {
                const passageId = await captureModeRef.current?.save()
                setPendingNav(null)
                await refresh()
                if (dest === 'bible' && passageId) {
                  setState(prev => ({
                    ...prev,
                    destination: 'bible',
                    selectedPassageId: passageId,
                    selectedBookName: null,
                    captureReference: '',
                    capturePassageId: null
                  }))
                } else if (dest) {
                  doNavigate(dest)
                }
              })()
            }
          },
          {
            label: 'Discard',
            variant: 'danger',
            autoFocus: false,
            onClick: () => {
              const dest = pendingNav
              setPendingNav(null)
              setState(prev => ({ ...prev, captureReference: '', capturePassageId: null }))
              if (dest) doNavigate(dest)
            }
          },
          {
            label: 'Cancel',
            variant: 'ghost',
            autoFocus: true,
            onClick: () => setPendingNav(null)
          }
        ]}
      />
      <OfflineIndicator />
    </div>
  )
}
