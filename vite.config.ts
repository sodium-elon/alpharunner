import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 3000)

export default defineConfig({
  server: {
    host,
    port,
    allowedHosts: ['.anthood.net'],
  },
  define: {
    'process.env.PORT': JSON.stringify(String(port)),
    'process.env.HOST': JSON.stringify(host),
  },
  plugins: [
    tsconfigPaths(),
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
