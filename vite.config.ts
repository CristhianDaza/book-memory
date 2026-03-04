import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/bookmemory-192.svg', 'icons/bookmemory-512.svg'],
      injectRegister: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              ['script', 'style', 'worker'].includes(request.destination) && url.pathname.startsWith('/assets/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'assets-runtime',
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-runtime',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              (url.origin.includes('openlibrary.org') || url.origin.includes('googleapis.com')),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'book-search-api',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Book Memory',
        short_name: 'BookMemory',
        description: 'Track reading sessions, pages, and streaks.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/bookmemory-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/bookmemory-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/bookmemory-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-i18n': ['vue-i18n'],
        },
      },
    },
  },
})
