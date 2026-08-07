import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 只拆稳定的基础框架库，antd/rc-* 交给路由懒加载自然分包，
        // 避免入口 chunk 随业务增长持续膨胀。
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (
            id.includes('/react-dom/') ||
            id.includes('/react/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react'
          }
          if (id.includes('/react-router')) return 'vendor-router'
          if (id.includes('i18next')) return 'vendor-i18n'
          if (
            id.includes('@reduxjs/') ||
            id.includes('/react-redux/') ||
            id.includes('/redux/') ||
            id.includes('/immer/') ||
            id.includes('/reselect/')
          ) {
            return 'vendor-redux'
          }
          if (id.includes('@tanstack/')) return 'vendor-query'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
