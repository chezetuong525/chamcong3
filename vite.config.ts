import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Cấu hình tối giản để tránh lỗi MIME type trên GitHub Pages
export default defineConfig({
  base: '/chamcong3/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Đảm bảo không tạo file quá lạ khiến GitHub nhầm thành binary
    sourcemap: false,
  },
})