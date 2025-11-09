#!/bin/bash

set -e  # Exit on any error

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"

# Navigate to project directory
cd /var/www/interview-prep

# Ensure we're on the main branch
git checkout main || true

# Install root dependencies (frontend) - need dev deps for build
# Only install if node_modules doesn't exist or package.json changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install --legacy-peer-deps --prefer-offline --no-audit
else
    echo "✅ Frontend dependencies already installed, skipping..."
fi

# Install server dependencies (production only)
echo "📦 Installing backend dependencies..."
cd server
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    npm install --production --legacy-peer-deps --prefer-offline --no-audit
else
    echo "✅ Backend dependencies already installed, skipping..."
fi
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
echo "   Generating Prisma client..."
npx prisma generate --silent
echo "   Pushing database schema..."
npx prisma db push --skip-generate --accept-data-loss --skip-seed

# Seed database if needed (ensure demo users exist)
echo "🌱 Seeding database with demo users..."
timeout 30 node -e "
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
" || echo "⚠️  Database seeding timed out or failed, continuing..."
cd ..

# Restart backend server
echo "🔄 Restarting backend server..."
if pm2 list | grep -q "interview-prep-backend"; then
    echo "   Restarting existing PM2 process..."
    pm2 restart interview-prep-backend --update-env
else
    echo "   Starting new PM2 process..."
    pm2 start npm --name "interview-prep-backend" --cwd server -- start
fi

# Save PM2 configuration
pm2 save

# Update Nginx config for WebSocket support (quick check only)
echo "🌐 Checking Nginx configuration..."
NGINX_CONF="/etc/nginx/conf.d/interview-prep.conf"

# Quick check - only update if Socket.io location is missing
if [ -f "$NGINX_CONF" ] && ! grep -q "location /socket.io/" "$NGINX_CONF"; then
    echo "⚠️  Adding Socket.io support to Nginx config..."
    
    # Quick backup
    sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup" 2>/dev/null || true
    
    # Insert Socket.io block before the last closing brace (faster method)
    sudo sed -i '/^}$/i\
    # Socket.io WebSocket connections\
    location /socket.io/ {\
        proxy_pass http://localhost:5000;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_cache_bypass $http_upgrade;\
        proxy_read_timeout 86400;\
        proxy_send_timeout 86400;\
    }' "$NGINX_CONF"
    
    # Quick test and reload
    if sudo nginx -t 2>/dev/null; then
        sudo systemctl reload nginx 2>/dev/null || true
        echo "✅ Socket.io support added"
    else
        echo "⚠️  Nginx test failed, restoring backup..."
        sudo cp "${NGINX_CONF}.backup" "$NGINX_CONF" 2>/dev/null || true
    fi
elif [ -f "$NGINX_CONF" ]; then
    echo "✅ Nginx config already has Socket.io support"
else
    echo "⚠️  Nginx config not found - will be created on first deployment"
fi

# Reload nginx to serve new frontend build (always do this)
echo "🌐 Reloading nginx..."
sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx 2>/dev/null || true
echo "✅ Nginx reloaded"

# Wait a moment for services to stabilize
echo "⏳ Waiting for services to stabilize..."
sleep 5

# Verify backend is running (with timeout)
echo "🏥 Verifying backend health..."
for i in {1..6}; do
    if curl -f -s --max-time 5 http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    else
        if [ $i -eq 6 ]; then
            echo "⚠️  Backend health check failed after 30 seconds, but continuing..."
        else
            echo "   Waiting for backend... ($i/6)"
            sleep 5
        fi
    fi
done

echo ""
echo "=== Deployment Completed Successfully ==="
echo "Backend: http://54.159.42.7:5000"
echo "Frontend: http://54.159.42.7"
echo "Timestamp: $(date)"

