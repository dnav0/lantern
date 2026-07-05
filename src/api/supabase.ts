import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Supabase client, initialised from Vite env vars. When either var is absent the
// export is null and the app falls back to the in-memory stub (see main.tsx). This
// keeps `npm run dev` working with no backend configured.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Accept the magic-link redirect as a sign-in fallback: Supabase's default
        // email template (uneditable without custom SMTP) contains only a link, no
        // OTP code. The code-entry UI works once custom SMTP adds {{ .Token }} to
        // the template — see docs/BACKLOG.md.
        detectSessionInUrl: true
      }
    })
  : null
