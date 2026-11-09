import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing libraries into their own files so browsers keep them
        // cached across deploys of the app code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          network: ['axios', 'socket.io-client'],
        },
      },
    },
  },
})
