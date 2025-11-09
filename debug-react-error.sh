#!/bin/bash

# Script to debug React error #310 on EC2
# This will temporarily disable minification to see the full error

set -e

echo "🔍 Debugging React Error #310 on EC2"
echo "======================================"

cd /var/www/interview-prep

# Backup current build
if [ -d "dist" ]; then
    echo "📦 Backing up current build..."
    mv dist dist.backup.$(date +%s)
fi

# Update vite.config.ts to disable minification temporarily
echo "🔧 Updating Vite config to disable minification..."
cat > vite.config.ts << 'EOF'
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
  build: {
    sourcemap: true, // Enable source maps for debugging
    minify: false, // DISABLE MINIFICATION TO SEE FULL ERROR
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
})
EOF

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps --prefer-offline --no-audit

# Build without minification
echo "🔨 Building frontend (without minification)..."
npm run build

# Verify build
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build complete (without minification)"
echo ""
echo "📝 Next steps:"
echo "1. Reload the page in your browser"
echo "2. Check the browser console for the full error message"
echo "3. The error should now show the full stack trace instead of 'Minified React error #310'"
echo ""
echo "🔄 To restore minification later, run:"
echo "   git checkout vite.config.ts"
echo "   npm run build"

