import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
})
