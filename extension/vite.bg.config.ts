import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'

// Builds the background service worker as an ES module.
// Runs after the content script build — does NOT clear dist/.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
      'process.env.VITE_BACKEND_URL': JSON.stringify(env.VITE_BACKEND_URL || 'http://localhost:3000'),
      'process.env.VITE_API_SECRET': JSON.stringify(env.VITE_API_SECRET || ''),
    },
    build: {
      outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/background/index.ts'),
      output: {
        format: 'es',
        entryFileNames: 'src/background/index.js',
        inlineDynamicImports: true,
      },
      },
    },
  };
});
