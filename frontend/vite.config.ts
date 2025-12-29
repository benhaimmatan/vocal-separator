import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { UserConfig as VitestUserConfigInterface } from 'vitest/config';

// https://vite.dev/config/

// Combine Vite and Vitest configurations
const vitestConfig: VitestUserConfigInterface['test'] = {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/setupTests.ts', // You might need to create this file
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: vitestConfig,
})
