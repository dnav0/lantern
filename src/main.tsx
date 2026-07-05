import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import Root from './Root'
import './assets/main.css'
import './assets/dark.css'

// Service worker: precache the app shell, auto-update in the background with
// no user prompt (registerType: 'autoUpdate' in vite.config.ts). Supabase API
// traffic is excluded from the SW cache (NetworkOnly) so this never masks
// staleness for reads/writes — only the shell (JS/CSS/HTML/icons) is cached.
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

// Tag the body with the current platform so CSS can target it precisely.
// navigator.platform is 'MacIntel' / 'MacM1' on macOS, 'Win32' on Windows, etc.
if (navigator.platform.toLowerCase().includes('mac')) {
  document.body.classList.add('platform-mac')
}

// Root chooses the backend: Supabase (auth-gated) when configured, otherwise the
// in-memory stub for local dev.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
