import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api/volc': {
        target: 'https://visual.volcengineapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/volc/, ''),
      },
    },
  },
})
