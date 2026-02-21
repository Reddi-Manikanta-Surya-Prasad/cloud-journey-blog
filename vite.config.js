import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // This ensures paths are relative (./assets/... instead of /assets/...)
  build: {
    sourcemap: false,
    cssCodeSplit: true,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('aws-amplify')) return 'amplify'
          if (id.includes('react')) return 'react-vendor'
          if (id.includes('mermaid')) return 'mermaid-vendor'
          if (id.includes('highlight.js')) return 'highlight-vendor'
          return 'vendor'
        },
      },
    },
  },
})
