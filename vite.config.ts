import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


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
