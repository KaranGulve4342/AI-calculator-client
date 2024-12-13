// import path from "path"
// import react from "@vitejs/plugin-react"
// import eslint from 'vite-plugin-eslint';
// import { defineConfig } from "vite"
 
// export default defineConfig({
//   plugins: [react(),eslint()],
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// })


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
      '/api': {
        target: 'https://ai-calculator-server-taupe.vercel.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})