import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'icon.svg',
          'logo.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'فوكاشات - غرف الدردشة الصوتية',
          short_name: 'فوكاشات',
          description: 'فوكاشات - منصة الغرف الصوتية المباشرة والهدايا التفاعلية والمتجر الملكي.',
          theme_color: '#070a12',
          background_color: '#020b1c',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait',
          dir: 'rtl',
          lang: 'ar',
          start_url: '/',
          scope: '/',
          categories: ['social', 'entertainment', 'music'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/AgoraRTC*', '**/AdminDashboard*', '**/assets/aistudio/**'],
          navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      minify: true,
      cssMinify: true,
      cssCodeSplit: true,
      sourcemap: false,
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 650,
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) {
              return 'firebase-db';
            }
            if (id.includes('node_modules/@firebase/auth') || id.includes('node_modules/firebase/auth')) {
              return 'firebase-auth';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase-core';
            }
            if (id.includes('node_modules/lucide-react')) return 'icons';
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
