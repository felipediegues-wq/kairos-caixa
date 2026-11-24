import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No GitHub Pages o site fica em https://<usuario>.github.io/<repositorio>/
// O workflow define VITE_BASE automaticamente; localmente usa "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: { chunkSizeWarningLimit: 1500 },
})
