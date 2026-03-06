import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // ── Direct to ESP32 (local mode — laptop on SafetyHub WiFi) ──
        '/api/data': {
          target: 'http://192.168.4.1',
          changeOrigin: true,
        },
        // ── Local backend proxy for dev testing ─────────────────────
        '/cloud': {
          target: env.CLOUD_DEV_PROXY || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cloud/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
