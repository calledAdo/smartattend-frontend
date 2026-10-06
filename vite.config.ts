import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: loadEnv(mode, '.', 'VITE_').VITE_API_PROXY_TARGET || 'https://real-time-attendance-auth-service.onrender.com',
        changeOrigin: true,
        configure(proxy) {
          const events = proxy as unknown as { on: (event: 'proxyReq', listener: (request: { removeHeader(name: string): void }) => void) => void }
          events.on('proxyReq', request => request.removeHeader('origin'))
        },
      },
    },
  },
}))
