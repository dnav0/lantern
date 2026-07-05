import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import CaptureMode, { CaptureModeHandle } from './components/CaptureMode'
import ReadingMode from './components/ReadingMode'
import BibleLibrary from './components/BibleLibrary'
import BookDetailPage from './components/BookDetailPage'
import SessionEditor from './components/SessionEditor'
import ConfirmDialog from './components/ConfirmDialog'
import SettingsModal from './components/SettingsModal'
import { Passage } from './types'
import { BIBLE_BOOKS } from './utils/bibleBooks'
import { useApi } from './api/context'
import { useDarkMode } from './utils/useDarkMode'

type ViewMode = 'capture' | 'reading'

interface AppProps {
  // Signed-in display name for the "Welcome back" touch. null on the memory stub.
  displayName: string | null
  // Sign-out handler, or null when there is no auth (memory stub / dev).
  onSignOut: (() => Promise<void>) | null
}

interface AppState {
  passages: Passage[]
  selectedPassageId: string | null
  selectedBookName: string | null
  sessionEditorPassageId: string | null
  captureReference: string
  capturePassageId: string | null
  viewMode: ViewMode
}

export default function App({ displayName, onSignOut }: AppProps): React.ReactElement {
  const api = useApi()
  const [isDark, toggleDark] = useDarkMode()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [state, setState] = useState<AppState>({
    passages: [],
    selectedPassageId: null,
    selectedBookName: null,
    sessionEditorPassageId: null,
    captureReference: '',
    capturePassageId: null,
    viewMode: 'capture'
  })
  const [pendingModeChange, setPendingModeChange] = useState(false)
  const captureModeRef = useRef<CaptureModeHandle>(null)

  const refresh = useCallback(async () => {
    const passages = await api.getPassages()
    setState(prev => ({ ...prev, passages }))
  }, [api])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleNewPassage = (bookName?: string): void => {
    setState(prev => ({
      ...prev,
      selectedPassageId: null,
      selectedBookName: null,
      sessionEditorPassageId: null,
      captureReference: bookName ? `${bookName} ` : '',
      viewMode: 'capture'
    }))
  }

  const handleSelectPassage = (passageId: string): void => {
    setState(prev => ({
      ...prev,
      selectedPassageId: passageId,
      selectedBookName: null,
      sessionEditorPassageId: null,
      viewMode: 'reading'
    }))
  }

  const handleSelectBook = (bookName: string): void => {
    setState(prev => ({
      ...prev,
      selectedBookName: bookName,
      selectedPassageId: null,
      sessionEditorPassageId: null,
      viewMode: 'reading'
    }))
  }

  const handleEditPassage = (passageId: string): void => {
    setState(prev => ({
      ...prev,
      sessionEditorPassageId: passageId,
      selectedPassageId: null,
      selectedBookName: null,
      viewMode: 'reading'
    }))
  }

  const handleSaveRead = async (passageId: string): Promise<void> => {
    await refresh()
    setState(prev => ({ ...prev, selectedPassageId: passageId, selectedBookName: null, sessionEditorPassageId: null, capturePassageId: null, viewMode: 'reading' }))
  }

  const handleSaveNext = async (nextRef?: string): Promise<void> => {
    await refresh()
    setState(prev => ({
      ...prev,
      selectedPassageId: null,
      selectedBookName: null,
      sessionEditorPassageId: null,
      capturePassageId: null,
      captureReference: nextRef || '',
      viewMode: 'capture'
    }))
  }

  const doModeChange = (mode: ViewMode): void => {
    setState(prev => ({
      ...prev,
      viewMode: mode,
      ...(mode === 'reading' ? { selectedPassageId: null, selectedBookName: null, sessionEditorPassageId: null } : {})
    }))
  }

  const handleModeChange = (mode: ViewMode): void => {
    if (mode === 'reading' && state.viewMode === 'capture' && captureModeRef.current?.isDirty()) {
      setPendingModeChange(true)
      return
    }
    doModeChange(mode)
  }

  const handleCaptureFromReading = (reference: string, passageId?: string): void => {
    setState(prev => ({ ...prev, viewMode: 'capture', captureReference: reference, capturePassageId: passageId ?? null, selectedBookName: null, sessionEditorPassageId: null }))
  }

  const { passages, selectedPassageId, selectedBookName, sessionEditorPassageId, captureReference, capturePassageId, viewMode } = state

  const selectedPassage = passages.find(p => p.id === selectedPassageId) || null
  const selectedBibleBook = selectedBookName
    ? BIBLE_BOOKS.find(b => b.name === selectedBookName) || null
    : null
  const sessionEditorPassage = sessionEditorPassageId
    ? passages.find(p => p.id === sessionEditorPassageId) || null
    : null

  function renderMain(): React.ReactElement {
    if (sessionEditorPassage) {
      return (
        <SessionEditor
          key={sessionEditorPassage.id}
          passage={sessionEditorPassage}
          onBack={() => setState(prev => ({ ...prev, sessionEditorPassageId: null }))}
          onRefresh={refresh}
          onPassageDeleted={async () => {
            await refresh()
            setState(prev => ({ ...prev, sessionEditorPassageId: null }))
          }}
        />
      )
    }

    if (viewMode === 'reading' && selectedBibleBook) {
      return (
        <BookDetailPage
          key={selectedBibleBook.id}
          bibleBook={selectedBibleBook}
          onBack={() => setState(prev => ({ ...prev, selectedBookName: null }))}
          onCapture={ref => { handleCaptureFromReading(ref); refresh() }}
          onRefresh={refresh}
        />
      )
    }

    if (viewMode === 'reading' && selectedPassage) {
      return (
        <ReadingMode
          key={selectedPassage.id}
          passage={selectedPassage}
          onCapture={passageId => {
            const p = passages.find(p => p.id === passageId)
            handleCaptureFromReading(p?.reference_label || '', passageId)
          }}
          onRefresh={refresh}
          onPassageDeleted={async () => {
            await refresh()
            setState(prev => ({ ...prev, selectedPassageId: null }))
          }}
        />
      )
    }

    if (viewMode === 'reading') {
      return (
        <BibleLibrary
          passages={passages}
          onSelectBook={handleSelectBook}
          displayName={displayName}
        />
      )
    }

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

  return (
    <div className="app-layout">
      <Sidebar
        mode={viewMode}
        onModeChange={handleModeChange}
        passages={passages}
        selectedPassageId={selectedPassageId}
        onSelectPassage={handleSelectPassage}
        onNewPassage={() => handleNewPassage()}
        onEditPassage={handleEditPassage}
        isDark={isDark}
        onToggleDark={toggleDark}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="main-area">
        {renderMain()}
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isDark={isDark}
        onToggleDark={toggleDark}
        onSignOut={onSignOut}
      />

      {/* Navigation guard: unsaved notes in capture mode */}
      <ConfirmDialog
        isOpen={pendingModeChange}
        title="Unsaved notes"
        message="You have unsaved notes. Save them before switching tabs?"
        onClose={() => setPendingModeChange(false)}
        actions={[
          {
            label: 'Save & Read',
            variant: 'primary',
            autoFocus: false,
            onClick: () => {
              void (async () => {
                const passageId = await captureModeRef.current?.save()
                setPendingModeChange(false)
                await refresh()
                if (passageId) {
                  setState(prev => ({ ...prev, selectedPassageId: passageId, selectedBookName: null, sessionEditorPassageId: null, viewMode: 'reading' }))
                } else {
                  doModeChange('reading')
                }
              })()
            }
          },
          {
            label: 'Discard',
            variant: 'danger',
            autoFocus: false,
            onClick: () => {
              setPendingModeChange(false)
              setState(prev => ({
                ...prev,
                captureReference: '',
                viewMode: 'reading',
                selectedPassageId: null,
                selectedBookName: null,
                sessionEditorPassageId: null
              }))
            }
          },
          {
            label: 'Cancel',
            variant: 'ghost',
            autoFocus: true,
            onClick: () => setPendingModeChange(false)
          }
        ]}
      />
    </div>
  )
}
