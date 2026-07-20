import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react(),
    // Precaches the built app shell (JS/CSS/HTML/icons) so the app can boot
    // with zero network - closes the gap where the offline-first data
    // layer (attendance/diary/deliveries queue) assumed the app was
    // already loaded. `manifest: false` keeps public/manifest.json (already
    // complete - real icons, not the placeholder CLAUDE.md used to warn
    // about) as the single source of truth instead of generating a second
    // one. Deliberately no `runtimeCaching` entries for the Supabase origin
    // - Workbox only precaches same-origin build output by default, so
    // Supabase API/auth calls are never touched by the service worker
    // unless a runtime-caching rule is added for them. That has to stay
    // out, or the app could serve stale cached data as if it were live -
    // exactly what the IndexedDB queue was designed to avoid.
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
