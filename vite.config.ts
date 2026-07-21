import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  define: {
    // Hardcoded so vercel build cannot blank them out. These are publishable keys.
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://ebgkomrujmrkpetcdbgp.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('sb_publishable_8mtJTT2Ki9tGHhwx85jLhg_ZAQfeJRF'),
  },
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // Self-destroying service worker. The app previously precached its shell, which caused
    // the site to serve OLD builds after a deploy ("opens old versions"). selfDestroying ships
    // a worker whose only job is to unregister itself and delete all caches — so every visitor
    // (including anyone currently stuck on a stale build) gets cleaned up, and the site then
    // behaves like a normal always-fresh website served straight from Vercel's CDN.
    // Re-enable the PWA later by restoring the manifest/workbox config and removing selfDestroying.
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'one3seven — Employment Intake Organization',
        short_name: 'one3seven',
        theme_color: '#42574E',
        background_color: '#F5F7F4',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
    // Avoid duplicate React copies (can surface as hook-order errors in production).
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // Temporary: readable stack traces when diagnosing production-only React errors locally.
    sourcemap: true,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
