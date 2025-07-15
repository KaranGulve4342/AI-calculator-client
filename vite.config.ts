import path from "path"
import react from "@vitejs/plugin-react"
import eslint  from '@rollup/plugin-eslint';
import { defineConfig } from "vite"
 
export default defineConfig({
  plugins: [
    react(),
    eslint({ include: 'src/**/*.+(js|jsx|ts|tsx)' })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/calculate': {
        target: 'https://api-ai-calculator.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})