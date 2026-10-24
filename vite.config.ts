/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser (~1.2 MB) is its own chunk, loaded only on the underwriting
    // reveal (see components/ApprovalStamp.tsx), so its size is expected.
    chunkSizeWarningLimit: 1_300,
  },
  test: {
    // Engine tests are pure TypeScript, so the default Node environment is enough.
    include: ['src/**/*.test.ts'],
  },
})
