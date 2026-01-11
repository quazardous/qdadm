import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/qdadm/' : '/',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      { find: 'qdadm/styles', replacement: resolve(__dirname, '../qdadm/src/styles/index.scss') },
      { find: 'qdadm/modules/debug', replacement: resolve(__dirname, '../qdadm/src/modules/debug/index.js') },
      { find: 'qdadm', replacement: resolve(__dirname, '../qdadm/src') }
    ],
    dedupe: ['vue', 'vue-router', 'primevue', 'pinia', 'vanilla-jsoneditor']
  },
  optimizeDeps: {
    include: ['primevue/usetoast', 'primevue/useconfirm']
  },
  server: {
    port: 5174
  }
})
