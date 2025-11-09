#!/bin/bash

# Script to check React versions and ensure they match

set -e

echo "🔍 Checking React versions..."
echo "=============================="

cd /var/www/interview-prep

echo "📦 Checking package.json..."
if [ -f "package.json" ]; then
    echo "React version in package.json:"
    grep -A 1 '"react":' package.json || echo "Not found"
    echo ""
    echo "React-DOM version in package.json:"
    grep -A 1 '"react-dom":' package.json || echo "Not found"
fi

echo ""
echo "📦 Checking node_modules..."
if [ -d "node_modules/react" ]; then
    echo "Installed React version:"
    cat node_modules/react/package.json | grep '"version"' || echo "Not found"
fi

if [ -d "node_modules/react-dom" ]; then
    echo "Installed React-DOM version:"
    cat node_modules/react-dom/package.json | grep '"version"' || echo "Not found"
fi

echo ""
echo "🔍 Checking for multiple React instances..."
echo "This can cause React error #310:"
find node_modules -name "react" -type d 2>/dev/null | head -10

echo ""
echo "✅ Version check complete"

