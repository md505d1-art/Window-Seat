/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// ORBIT_BASE lets the GitHub Pages build serve Orbit from /<repo>/.
export default defineConfig({
  base: process.env.ORBIT_BASE ?? '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      // Link previews need an absolute image URL; the deploy workflow sets SITE_URL.
      name: 'orbit-site-url',
      transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', process.env.SITE_URL ?? ''),
    },
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('leaflet')) return 'maps'
          if (id.includes('@xyflow')) return 'canvas'
          if (id.includes('@supabase')) return 'supabase'
          return 'vendor'
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
