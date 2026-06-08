import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Builds the content script as a self-contained IIFE bundle.
// React + Panel component are bundled inline — no external deps needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': '"production"',
      global: 'globalThis',
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
      'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || 'http://localhost:3000'),
      'process.env.VITE_API_SECRET': JSON.stringify(env.VITE_API_SECRET || ''),
    },
    build: {
      outDir: 'dist',
    emptyOutDir: true,
    copyPublicDir: true, // copies manifest.json + icons from public/
    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.ts'),
      output: {
        format: 'iife',
        name: 'IaioTest',
        entryFileNames: 'src/content/index.js',
        inlineDynamicImports: true,
      },
      },
    },
  };
});
