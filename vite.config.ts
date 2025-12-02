import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ['**/*.svg'],
  build: {
    sourcemap: false, // Disable source maps in production to speed up build and reduce memory
    minify: 'esbuild', // Use esbuild (default, faster and already included)
    // Reduce memory usage during build
    target: 'es2015', // Target older browsers for faster compilation
    cssCodeSplit: false, // Single CSS file to reduce memory
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
      // Reduce memory usage
      maxParallelFileOps: 2, // Limit parallel file operations
    },
    // Optimize for lower memory usage
    chunkSizeWarningLimit: 1000,
    // Reduce build time
    reportCompressedSize: false, // Skip compressed size calculation
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
})

























