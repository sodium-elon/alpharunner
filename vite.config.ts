import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { nitro } from 'nitro/vite'

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 3000)
const __dirname = dirname(fileURLToPath(import.meta.url))
const nitroOutputDir = process.env.NITRO_OUTPUT_DIR
  ? resolve(__dirname, process.env.NITRO_OUTPUT_DIR)
  : undefined

function vendorChunk(id: string) {
  if (!id.includes('/node_modules/')) return undefined

  if (id.includes('/recharts/')) return 'vendor-recharts'
  if (id.includes('/d3-') || id.includes('/victory-vendor/')) return 'vendor-chart-math'
  if (id.includes('/@reduxjs/') || id.includes('/redux/') || id.includes('/reselect/')) return 'vendor-chart-state'
  if (id.includes('/react-dom/')) return 'vendor-react-dom'

  return undefined
}

export default defineConfig({
  server: {
    host,
    port,
    allowedHosts: ['.anthood.net', '.localhost'],
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(nitroOutputDir ? { output: { dir: nitroOutputDir } } : {}),
  ],
  build: {
    rollupOptions: {
      external: ['postgres'],
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
})
