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
    },
  },
})
