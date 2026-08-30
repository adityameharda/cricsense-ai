import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Forces the server to use the IPv4 address (fixes DNS resolution issues)
    host: '127.0.0.1', 
    port: 5173,
    proxy: {
      // Intercepts any request starting with /api and sends it to the backend
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        // Optional: rewrite: (path) => path.replace(/^\/api/, '') 
        // Only use 'rewrite' if your backend routes DON'T start with /api
      },
    },
  },
})