import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vite Config for the Standalone Report Viewer
 */
export default defineConfig({
    plugins: [react()],
    base: '/viewer/',
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    build: {
        outDir: 'dist/viewer',
        emptyOutDir: false, // Don't wipe dist/ because content script is there too
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        },
    },
})
