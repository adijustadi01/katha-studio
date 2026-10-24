import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// GitHub Pages serves the app from /katha-studio/; Electron loads it from disk (relative paths)
const target = process.env.KATHA_TARGET || 'web';
const base = target === 'desktop' ? './' : process.env.KATHA_BASE || '/katha-studio/';

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_TARGET': JSON.stringify(target),
  },
  plugins: [
    preact(),
    target === 'web' &&
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['fonts/*.woff2', 'fonts/fonts.css', 'icon.svg', 'help/**/*'],
        manifest: {
          name: 'Katha Studio',
          short_name: 'Katha',
          description: 'Screenwriting for Indian film & OTT — Tamil, Telugu and more',
          theme_color: '#1f1b2e',
          background_color: '#1f1b2e',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          file_handlers: [{ action: '.', accept: { 'application/x-katha-studio': ['.katha'] } }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,svg,png,json}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: 'index.html',
        },
      }),
  ].filter(Boolean),
  resolve: target === 'desktop' ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/pwa-stub.ts', import.meta.url)) } } : {},
  build: {
    outDir: target === 'desktop' ? 'dist-desktop' : 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
} as any);
