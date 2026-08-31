import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
  server: {
    port: 5177,
    proxy: {
      // Everything the backend owns. `/events` needs the streaming settings
      // below or the proxy buffers the SSE frames and the page looks dead.
      '/api': 'http://localhost:5178',
      '/ticket': 'http://localhost:5178',
      '/events': {
        target: 'http://localhost:5178',
        changeOrigin: true,
        // Vite's proxy handles SSE once the response is not buffered; keeping
        // this block explicit because "it works in dev, dies behind nginx" is
        // the classic way this feature breaks in production.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache'
          })
        },
      },
    },
  },
})
