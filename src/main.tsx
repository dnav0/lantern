import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import Root from './Root'
import { installGlobalErrorHandlers } from './telemetry/globalHandlers'
// Scripture reading faces, self-hosted (see tokens.css --scripture-font per
// [data-theme]; Georgia is still the fallback if a woff2 fails to load).
// Only the weights actually referenced by tokens.css are pulled in.
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/500.css'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/500.css'
import './assets/tokens.css'
import './assets/main.css'
import './assets/dark.css'
import './assets/motion.css'

// Error capture for what the React boundaries can't see (event handlers, timers,
// unhandled rejections). Installed before render so a throw during the very
// first mount is still caught. Content-free by construction — see src/errors.ts.
// No-ops entirely when Supabase isn't configured.
installGlobalErrorHandlers()

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
