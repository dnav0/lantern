import React, { useEffect, useState } from 'react'
import { isOffline, subscribeOffline, subscribeOfflineToast } from '../offline/status'

// Two pieces of offline UX, both driven by src/offline/status.ts (fetch-failure
// detection, not navigator.onLine):
//  - a subtle persistent "Offline — viewing only" pill in the app shell while
//    offline, clearing on the browser 'online' event or the next successful
//    request (see berean-api.ts markOnline() calls).
//  - a non-blocking toast fired once per failed mutation attempt.
export default function OfflineIndicator(): React.ReactElement {
  const [offline, setOffline] = useState(isOffline())
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const unsubOffline = subscribeOffline(setOffline)
    const unsubToast = subscribeOfflineToast(message => {
      setToast(message)
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    })
    return () => {
      unsubOffline()
      unsubToast()
    }
  }, [])

  return (
    <>
      {offline && (
        <div className="offline-pill" role="status">
          Offline — viewing only
        </div>
      )}
      {toast && (
        <div className="offline-toast" role="alert">
          {toast}
        </div>
      )}
    </>
  )
}
