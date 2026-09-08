// web/vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // 强制以当前web文件夹为Vite工作根目录（解决所有路径问题）
  root: __dirname,
  
  build: {
    // 构建输出到项目根目录的dist文件夹
    outDir: '../dist',
    emptyOutDir: true,
    // 生产环境移除console（可选，如需调试可注释）
    minify: 'esbuild',
    target: 'es2020'
  },

  server: {
    port: 5174,
    // 自动打开浏览器
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/caldav': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/.well-known/caldav': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
