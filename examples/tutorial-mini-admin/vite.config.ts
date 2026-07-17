import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'

// Exactly the tutorial's step 1.2 config (qdadm >= 2.11)
export default defineConfig({
  plugins: [vue(), qdadmVitePlugin()],
})
