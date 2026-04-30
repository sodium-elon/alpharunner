import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 3000)

export default defineConfig({
  server: {
    host,
    port,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src',
    }),
    viteReact(),
    nitro(),
  ],
  build: {
    rollupOptions: {
      external: ['postgres'],
    },
  },
})
