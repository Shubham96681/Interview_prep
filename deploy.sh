#!/bin/bash

set -e  # Exit on any error

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"

# Check disk space before starting
echo "💾 Checking disk space..."
df -h / | tail -1 | awk '{print "Available space: " $4 " of " $2 " (" $5 " used)"}'

# Navigate to project directory
cd /var/www/interview-prep

# Cleanup old files to free up space
echo "🧹 Cleaning up old files to free disk space..."

# Remove old node_modules to save space (we'll reinstall)
if [ -d "node_modules" ]; then
    echo "   Removing old frontend node_modules..."
    rm -rf node_modules
fi

if [ -d "server/node_modules" ]; then
    echo "   Removing old backend node_modules..."
    rm -rf server/node_modules
fi

# Remove old build artifacts
if [ -d "dist" ]; then
    echo "   Removing old dist build..."
    rm -rf dist
fi

# Clean npm cache
echo "   Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true

# Clean PM2 logs (keep last 100 lines)
echo "   Cleaning PM2 logs..."
pm2 flush 2>/dev/null || true

# Clean old git objects
echo "   Cleaning git objects..."
git gc --prune=now --aggressive 2>/dev/null || true

# Check disk space after cleanup
echo "💾 Disk space after cleanup:"
df -h / | tail -1 | awk '{print "Available space: " $4 " of " $2 " (" $5 " used)"}'

# Ensure we're on the main branch
git checkout main || true

# Install root dependencies (frontend) - need dev deps for build
echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps --prefer-offline --no-audit

# Install server dependencies (production only)
echo "📦 Installing backend dependencies..."
cd server
npm install --production --legacy-peer-deps --prefer-offline --no-audit
cd ..

# Build frontend
echo "🔨 Building frontend application..."
npm run build

# Verify build succeeded
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Frontend build failed! dist/ directory not found."
    exit 1
fi
echo "✅ Frontend build successful"

# Setup environment variables for server (if .env doesn't exist)
if [ ! -f server/.env ]; then
    echo "⚠️  Creating server/.env from template..."
    if [ -f server/env.example ]; then
        cp server/env.example server/.env
        echo "⚠️  Please edit server/.env with your production values!"
    else
        echo "❌ server/env.example not found! Cannot create .env file."
        exit 1
    fi
fi

# Run database migrations
echo "🗄️  Running database migrations..."
cd server
npx prisma generate
npx prisma db push --skip-generate --accept-data-loss

# Seed database if needed (ensure demo users exist)
echo "🌱 Seeding database with demo users..."
node -e "
const db = require('./services/database');
db.initialize()
  .then(() => {
    console.log('✅ Database seeding completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database seeding failed:', err);
    process.exit(1);
  });
"
cd ..

# Restart backend server
echo "🔄 Restarting backend server..."
if pm2 list | grep -q "interview-prep-backend"; then
    echo "   Restarting existing PM2 process..."
    pm2 restart interview-prep-backend --update-env
else
    echo "   Starting new PM2 process..."
    cd server
    pm2 start npm --name "interview-prep-backend" -- start
    cd ..
fi

# Save PM2 configuration
pm2 save

# Wait a moment for server to start
sleep 3

# Verify backend is running
echo "🔍 Verifying backend is running..."
if pm2 list | grep -q "interview-prep-backend.*online"; then
    echo "✅ Backend is running!"
    pm2 logs interview-prep-backend --lines 10 --nostream
else
    echo "⚠️  Backend might not be running. Check logs:"
    pm2 logs interview-prep-backend --lines 20 --nostream
fi

# Ensure nginx is configured for WebSocket support
echo "🌐 Checking nginx configuration..."
if [ -f /etc/nginx/conf.d/interview-prep.conf ]; then
    # Check if socket.io location exists
    if ! grep -q "location /socket.io/" /etc/nginx/conf.d/interview-prep.conf; then
        echo "⚠️  Warning: nginx config missing /socket.io/ location block"
        echo "   WebSocket connections may not work. See FIX_WEBSOCKET_NGINX.md"
    fi
fi

# Reload nginx to serve new frontend build
echo "🌐 Reloading nginx..."
sudo systemctl reload nginx || sudo systemctl restart nginx

# Wait a moment for services to stabilize
sleep 3

# Verify backend is running
echo "🏥 Verifying backend health..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend health check failed, but continuing..."
fi

# Final disk space check
echo ""
echo "💾 Final disk space:"
df -h / | tail -1 | awk '{print "Available space: " $4 " of " $2 " (" $5 " used)"}'

echo ""
echo "=== Deployment Completed Successfully ==="
echo "Backend: http://54.91.53.228:5000"
echo "Frontend: http://54.91.53.228"
echo "Timestamp: $(date)"

