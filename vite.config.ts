import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://real-time-attendance-auth-service.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
