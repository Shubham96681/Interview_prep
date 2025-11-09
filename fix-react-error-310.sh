#!/bin/bash

# Comprehensive fix for React error #310
# This script will:
# 1. Check React versions
# 2. Reinstall dependencies
# 3. Clear all caches
# 4. Rebuild with proper configuration

set -e

echo "🔧 Fixing React Error #310"
echo "==========================="

cd /var/www/interview-prep

# Step 1: Check current React versions
echo "📦 Step 1: Checking React versions..."
if [ -f "package.json" ]; then
    REACT_VERSION=$(grep -o '"react": "[^"]*"' package.json | cut -d'"' -f4)
    REACT_DOM_VERSION=$(grep -o '"react-dom": "[^"]*"' package.json | cut -d'"' -f4)
    echo "React: $REACT_VERSION"
    echo "React-DOM: $REACT_DOM_VERSION"
    
    if [ "$REACT_VERSION" != "$REACT_DOM_VERSION" ]; then
        echo "⚠️  WARNING: React and React-DOM versions don't match!"
        echo "This can cause React error #310"
    fi
fi

# Step 2: Clean everything
echo ""
echo "🧹 Step 2: Cleaning old files..."
rm -rf node_modules
rm -rf dist
rm -rf .vite
rm -f package-lock.json
npm cache clean --force 2>/dev/null || true

# Step 3: Reinstall dependencies
echo ""
echo "📦 Step 3: Reinstalling dependencies..."
npm install --legacy-peer-deps --prefer-offline --no-audit

# Step 4: Verify React installation
echo ""
echo "🔍 Step 4: Verifying React installation..."
if [ -d "node_modules/react" ] && [ -d "node_modules/react-dom" ]; then
    REACT_INSTALLED=$(cat node_modules/react/package.json | grep '"version"' | cut -d'"' -f4)
    REACT_DOM_INSTALLED=$(cat node_modules/react-dom/package.json | grep '"version"' | cut -d'"' -f4)
    echo "✅ React installed: $REACT_INSTALLED"
    echo "✅ React-DOM installed: $REACT_DOM_INSTALLED"
    
    if [ "$REACT_INSTALLED" != "$REACT_DOM_INSTALLED" ]; then
        echo "⚠️  Versions still don't match, forcing same version..."
        npm install react@$REACT_INSTALLED react-dom@$REACT_INSTALLED --legacy-peer-deps --save-exact
    fi
else
    echo "❌ React not found in node_modules!"
    exit 1
fi

# Step 5: Check for duplicate React instances
echo ""
echo "🔍 Step 5: Checking for duplicate React instances..."
DUPLICATES=$(find node_modules -name "react" -type d 2>/dev/null | wc -l)
if [ "$DUPLICATES" -gt 1 ]; then
    echo "⚠️  Found $DUPLICATES React instances (should be 1)"
    echo "This can cause React error #310"
    echo "Locations:"
    find node_modules -name "react" -type d 2>/dev/null
else
    echo "✅ Only one React instance found"
fi

# Step 6: Build with source maps
echo ""
echo "🔨 Step 6: Building frontend..."
npm run build

# Step 7: Verify build
echo ""
echo "✅ Step 7: Verifying build..."
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
    echo "✅ Build successful!"
    echo ""
    echo "📊 Build size:"
    du -sh dist
    echo ""
    echo "📝 Next steps:"
    echo "1. Reload the page in your browser"
    echo "2. Check browser console for errors"
    echo "3. If error persists, check the full error message (should not be minified)"
else
    echo "❌ Build failed!"
    exit 1
fi

echo ""
echo "✅ Fix complete!"

