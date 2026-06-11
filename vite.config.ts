import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev
export default defineConfig({
  plugins: [
    tsconfigPaths(), // This fixes the "@/components" path errors
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true
    }),
    react()
  ],
  optimizeDeps: {
    include: ['react-window'],
  },
})
