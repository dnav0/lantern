import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root'
import './assets/main.css'
import './assets/dark.css'

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
