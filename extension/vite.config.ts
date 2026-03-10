import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Builds the content script as a self-contained IIFE bundle.
// React + Panel component are bundled inline — no external deps needed.
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
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
})
