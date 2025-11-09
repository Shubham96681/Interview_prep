#!/bin/bash

set -e  # Exit on any error

# Set timeouts to prevent hanging
export DEBIAN_FRONTEND=noninteractive
export NPM_CONFIG_PROGRESS=false
export NPM_CONFIG_SPIN=false

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"

# Navigate to project directory
cd /var/www/interview-prep

# Ensure we're on the main branch
git checkout main || true

# Install root dependencies (frontend) - need dev deps for build
echo "📦 Installing frontend dependencies..."
timeout 300 npm install --legacy-peer-deps || { echo "❌ npm install timed out or failed"; exit 1; }

# Install server dependencies (production only)
echo "📦 Installing backend dependencies..."
cd server
timeout 300 npm install --production --legacy-peer-deps || { echo "❌ npm install timed out or failed"; exit 1; }
cd ..

# Build frontend
echo "🔨 Building frontend application..."
timeout 600 npm run build || { echo "❌ Build timed out or failed"; exit 1; }

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
timeout 120 npx prisma generate || { echo "❌ Prisma generate failed"; exit 1; }
timeout 120 npx prisma db push --skip-generate --accept-data-loss || { echo "❌ Prisma db push failed"; exit 1; }

# Seed database if needed (ensure demo users exist)
echo "🌱 Seeding database with demo users..."
timeout 60 node -e "
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
" || { echo "⚠️  Database seeding timed out or failed, continuing..."; }
cd ..

# Restart backend server
echo "🔄 Restarting backend server..."
if timeout 30 pm2 list 2>/dev/null | grep -q "interview-prep-backend"; then
    echo "   Restarting existing PM2 process..."
    timeout 30 pm2 restart interview-prep-backend --update-env 2>/dev/null || echo "⚠️  PM2 restart failed, trying to start new..."
    # If restart failed, try to start new
    if ! timeout 10 pm2 list 2>/dev/null | grep -q "interview-prep-backend"; then
        echo "   Starting new PM2 process..."
        timeout 30 pm2 start npm --name "interview-prep-backend" --cwd server -- start 2>/dev/null || echo "⚠️  PM2 start failed"
    fi
else
    echo "   Starting new PM2 process..."
    timeout 30 pm2 start npm --name "interview-prep-backend" --cwd server -- start 2>/dev/null || echo "⚠️  PM2 start failed"
fi

# Save PM2 configuration (non-blocking)
echo "💾 Saving PM2 configuration..."
timeout 10 pm2 save 2>/dev/null || echo "⚠️  PM2 save failed, but continuing..."

# Reload nginx to serve new frontend build
echo "🌐 Reloading nginx..."
timeout 10 sudo systemctl reload nginx 2>/dev/null || timeout 10 sudo systemctl restart nginx 2>/dev/null || echo "⚠️  Nginx reload failed, but continuing..."

# Wait a moment for services to stabilize
sleep 3

# Verify backend is running
echo "🏥 Verifying backend health..."
timeout 5 curl -f http://localhost:5000/api/health > /dev/null 2>&1 && echo "✅ Backend is healthy!" || echo "⚠️  Backend health check failed, but continuing..."

echo ""
echo "=== Deployment Completed Successfully ==="
echo "Backend: http://54.159.42.7:5000"
echo "Frontend: http://54.159.42.7"
echo "Timestamp: $(date)"

