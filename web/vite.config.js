// web/vite.config.js
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

function loadLocalHttpsConfig() {
  if (process.env.HTTPS !== '1') return undefined

  const keyPath = new URL('../.certs/localhost-key.pem', import.meta.url)
  const certPath = new URL('../.certs/localhost-cert.pem', import.meta.url)
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    throw new Error('未找到本地 HTTPS 证书：请先运行 bun run cert:dev')
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath)
  }
}

const devProxyHeaders = process.env.HTTPS === '1'
  ? { 'x-forwarded-proto': 'https' }
  : {}

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
    host: process.env.HOST || 'localhost',
    https: loadLocalHttpsConfig(),
    // 自动打开浏览器
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        secure: false,
        headers: devProxyHeaders
      },
      '/caldav': {
        target: 'http://localhost:3000',
        secure: false,
        headers: devProxyHeaders
      },
      '/.well-known/caldav': {
        target: 'http://localhost:3000',
        secure: false,
        headers: devProxyHeaders
      }
    }
  }
})
