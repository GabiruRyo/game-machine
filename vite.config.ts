import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// `data/` is the entire user-editable surface: config.yaml + content packs.
// Serving it as publicDir means editing a file there changes the game on reload,
// with no rebuild and no code change, in both `vite dev` and `vite build`.
export default defineConfig({
  plugins: [react()],
  publicDir: 'data',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, open: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
