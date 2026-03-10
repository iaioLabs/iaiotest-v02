import { defineConfig } from 'vite'
import { resolve } from 'path'

// Builds the background service worker as an ES module.
// Runs after the content script build — does NOT clear dist/.
export default defineConfig({
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
})
