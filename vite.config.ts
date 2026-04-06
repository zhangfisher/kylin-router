import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'example',
  publicDir: 'public',
  build: {
    outDir: '../dist'
  },
  server: {
    port: 5173,
    open: false,
    fs: {
      // 允许访问项目根目录的文件
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '/src': resolve(__dirname, './src')
    }
  }
})
