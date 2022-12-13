import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: './src/pinia-persist.ts',
      name: 'PiniaPersist',
      fileName: 'pinia-persist'
    }
  }
})
