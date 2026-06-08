import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vite Config for the Standalone Report Viewer
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    return {
        plugins: [react()],
        base: '/viewer/',
        define: {
            'process.env.NODE_ENV': '"production"',
            'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
            'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
            'process.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(env.VITE_GOOGLE_CLIENT_ID),
        },
        build: {
            outDir: 'dist/viewer',
        emptyOutDir: false, // Don't wipe dist/ because content script is there too
        copyPublicDir: false, // Prevents duplicating manifest.json into the viewer subfolder
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
    };
});
