import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Stamps the service worker with a unique build id so a new deploy never keeps
// serving the previous version's caches.
function swCacheVersion() {
    let outDir = 'dist'
    return {
        name: 'sw-cache-version',
        apply: 'build',
        configResolved(config) { outDir = config.build.outDir },
        closeBundle() {
            const swPath = join(outDir, 'sw.js')
            if (!existsSync(swPath)) return
            const buildId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
            writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId))
        },
    }
}

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        swCacheVersion(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    build: {
        target: 'es2020',
        minify: 'esbuild',
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('node_modules/three/examples/jsm')) return 'three-examples';
                    if (id.includes('node_modules/three')) return 'three-core';
                    if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
                    if (id.includes('node_modules/@tailwindcss') || id.includes('node_modules/tailwindcss')) return 'tailwind-vendor';
                }
            }
        }
    },
    optimizeDeps: {
        include: ['three', 'react', 'react-dom']
    }
})
