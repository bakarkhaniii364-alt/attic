import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'assets/icon-192.png', 'assets/icon-512.png'],
      manifest: false, // We supply our own manifest.webmanifest in /public
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            // Cache Supabase Storage assets (images, audio)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-storage-cache', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 } }
          }
        ]
      },
      devOptions: { enabled: true }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          tiptap: ['@tiptap/react', '@tiptap/starter-kit'],
          webrtc: ['yjs', 'y-webrtc', 'peerjs']
        }
      }
    }
  }
});

