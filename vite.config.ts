import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // App-shell precache; scripture/notes caching is handled by our own
      // IndexedDB layers (src/bible/cache.ts, src/offline/mirror.ts), not the
      // service worker's runtime cache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Keep the self-hosted BSB fallback bundle (~1.2 MB gzip) OUT of the
        // service-worker precache. The glob above is extension-scoped and
        // already wouldn't match a `.gz`, but this is explicit belt-and-braces:
        // if that bundle ever landed in the precache manifest, every user would
        // download the entire Bible on first load, which defeats the whole point
        // of fetching it lazily (only when helloao is down). See
        // src/bible/self-hosted.ts.
        globIgnores: ['**/bible/bsb.json.gz'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Never cache Supabase API traffic — reads/writes must always hit
            // the network or fail explicitly so the offline mirror/toast logic
            // (src/offline/) can do its job instead of the SW masking staleness.
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkOnly'
          }
        ]
      },
      manifest: {
        name: 'Lantern',
        short_name: 'Lantern',
        description:
          'A quiet place to study Scripture: read a passage, capture what you see in it, and read your notes back later anchored to the verses.',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#F5F4F1',
        background_color: '#F5F4F1',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
