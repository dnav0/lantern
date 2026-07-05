import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Auth module: email OTP (6-digit code) sign-in, session persistence, profile
// read/write. All calls assume Supabase is configured — the app only mounts the
// auth-gated tree when supabase !== null (see main.tsx / App bootstrap).

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export interface Profile {
  id: string
  display_name: string
  onboarding_done: boolean
  created_at: string
}

// Send a 6-digit code to the email. shouldCreateUser: true so first-time sign-in
// doubles as sign-up (which fires the profile/workspace trigger).
export async function sendOtp(email: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  })
  if (error) throw error
}

// Verify the code the user typed. token type 'email' matches the OTP flow.
export async function verifyOtp(email: string, token: string): Promise<Session> {
  const { data, error } = await client().auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
  if (!data.session) throw new Error('Verification did not return a session')
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut()
  if (error) throw error
}

export async function getSession(): Promise<Session | null> {
  const { data } = await client().auth.getSession()
  return data.session
}

// Subscribe to auth changes. Returns an unsubscribe function.
export function onAuthStateChange(cb: (user: User | null) => void): () => void {
  const { data } = client().auth.onAuthStateChange((_event, session) => {
    cb(session?.user ?? null)
  })
  return () => data.subscription.unsubscribe()
}

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await client()
    .from('profiles')
    .select('id, display_name, onboarding_done, created_at')
    .single()
  if (error) {
    // No profile row yet (trigger lag on a brand-new user) is not fatal.
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Profile
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const { data: userData } = await client().auth.getUser()
  const id = userData.user?.id
  if (!id) throw new Error('Not signed in')
  const { error } = await client().from('profiles').update({ display_name: displayName }).eq('id', id)
  if (error) throw error
}

export async function markOnboardingDone(): Promise<void> {
  const { data: userData } = await client().auth.getUser()
  const id = userData.user?.id
  if (!id) throw new Error('Not signed in')
  const { error } = await client().from('profiles').update({ onboarding_done: true }).eq('id', id)
  if (error) throw error
}
