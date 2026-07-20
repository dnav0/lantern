import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// Auth module: Google OAuth + email OTP (6-digit code) sign-in, session
// persistence, profile read/write. All calls assume Supabase is configured — the
// app only mounts the auth-gated tree when supabase !== null (see main.tsx / App
// bootstrap).
//
// The two methods reach the SAME account. Supabase automatically links identities
// that share a *verified* email into one auth.users row: the OTP flow verifies an
// address by definition, and Google returns verified emails, so signing in by
// email first and Google later (or the reverse) does not fork the account. This
// matters more than it looks — the signup trigger (supabase/migrations/0001_init
// .sql) creates a profile + personal workspace on every new auth.users row, so a
// second row would mean a second, empty workspace and split notes. Nothing here
// implements that linking; Supabase does it. Picking a *different* Google account
// is a genuinely different email and will correctly be a separate account.

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

// Google OAuth. Redirects the whole page to Supabase's /authorize, which bounces
// to Google and back to `redirectTo` with the session in the URL; the client
// picks that up (detectSessionInUrl) and surfaces it via onAuthStateChange, so
// there is nothing to await here.
//
// Two things this canNOT do anything about, both verified live:
//   - It does not validate the provider. supabase-js builds the URL and hands the
//     browser over without a round-trip, so if the provider is not enabled the
//     user lands on Supabase's endpoint showing raw JSON ("Unsupported provider:
//     provider is not enabled") with no way back. The caller's catch never runs.
//     The only fix is enabling Google in the dashboard — so do NOT put this
//     button in front of users until that is done (see docs/BACKLOG.md).
//   - redirectTo must be on the hosted project's Auth > URL Configuration
//     allowlist or Supabase refuses it. That list is localhost-only today, so
//     this works in dev and WILL fail in production until the deployed origin is
//     added.
export async function signInWithGoogle(): Promise<void> {
  const { error } = await client().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
  if (error) throw error
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
  const { error } = await client()
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', id)
  if (error) throw error
}

export async function markOnboardingDone(): Promise<void> {
  const { data: userData } = await client().auth.getUser()
  const id = userData.user?.id
  if (!id) throw new Error('Not signed in')
  const { error } = await client().from('profiles').update({ onboarding_done: true }).eq('id', id)
  if (error) throw error
}
