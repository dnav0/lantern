import React, { Suspense, lazy, useEffect, useState } from 'react'
import App from './App'
import Onboarding from './components/Onboarding'
import { ApiProvider } from './api/context'
import { createMemoryApi, seedMemoryApi } from './api/memory'
import { supabase, isSupabaseConfigured } from './api/supabase'
import { SupabaseBereanApi } from './api/berean-api'
import { getProfile, getSession, onAuthStateChange, signOut, type Profile } from './api/auth'
import type { BereanApi } from './api/types'

// Root decides which backend the app runs against:
//   - Supabase configured -> auth-gated app (sign-in -> onboarding -> App).
//   - otherwise            -> in-memory stub (dev fallback), with a console warning.

type Phase = 'loading' | 'signedOut' | 'onboarding' | 'ready'

// The landing page is the signed-out surface: marketing copy, four looping
// animation clips, and its own stylesheet. Lazy so a signed-in user — who never
// sees it — does not download any of that to reach their notes.
const Landing = lazy(() => import('./components/landing/Landing'))

// ─── Memory (dev) path ───────────────────────────────────────────────────────
function MemoryRoot(): React.ReactElement {
  const [api] = useState<BereanApi>(() => {
    const a = createMemoryApi()
    seedMemoryApi()
    return a
  })
  return (
    <ApiProvider api={api}>
      <App displayName={null} onSignOut={null} />
    </ApiProvider>
  )
}

// ─── Supabase (auth-gated) path ──────────────────────────────────────────────
function SupabaseRoot(): React.ReactElement {
  const [phase, setPhase] = useState<Phase>('loading')
  const [api, setApi] = useState<BereanApi | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  // Resolve api + profile for a signed-in user and pick the phase.
  const enter = React.useCallback(async (): Promise<void> => {
    try {
      const nextApi = await SupabaseBereanApi.create(supabase!)
      const prof = await getProfile()
      setApi(nextApi)
      setProfile(prof)
      const done = prof?.onboarding_done || localStorage.getItem('berean.onboarded') === '1'
      setPhase(done ? 'ready' : 'onboarding')
    } catch {
      setPhase('signedOut')
    }
  }, [])

  useEffect(() => {
    let active = true
    getSession().then(session => {
      if (!active) return
      if (session) void enter()
      else setPhase('signedOut')
    })
    const unsub = onAuthStateChange(user => {
      if (!active) return
      if (user) void enter()
      else {
        setApi(null)
        setProfile(null)
        setPhase('signedOut')
      }
    })
    return () => {
      active = false
      unsub()
    }
  }, [enter])

  const handleSignOut = async (): Promise<void> => {
    await signOut()
  }

  if (phase === 'loading') {
    return <div className="app-boot" />
  }

  if (phase === 'signedOut') {
    return (
      <Suspense fallback={<div className="app-boot" />}>
        <Landing />
      </Suspense>
    )
  }

  if (phase === 'onboarding') {
    return (
      <Onboarding
        onDone={() => {
          void getProfile().then(setProfile)
          setPhase('ready')
        }}
      />
    )
  }

  // ready
  return (
    <ApiProvider api={api!}>
      <App displayName={profile?.display_name || null} onSignOut={handleSignOut} />
    </ApiProvider>
  )
}

export default function Root(): React.ReactElement {
  if (isSupabaseConfigured) return <SupabaseRoot />
  console.warn(
    '[berean] Supabase env vars absent — running on the in-memory stub. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the real backend.'
  )
  return <MemoryRoot />
}
