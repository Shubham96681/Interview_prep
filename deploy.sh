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

# Update Nginx config for WebSocket support (if needed)
echo "🌐 Checking and updating Nginx configuration..."
NGINX_CONF="/etc/nginx/conf.d/interview-prep.conf"

if [ -f "$NGINX_CONF" ]; then
    # Check if socket.io location exists
    if ! grep -q "location /socket.io/" "$NGINX_CONF"; then
        echo "⚠️  Nginx config missing Socket.io support. Adding it now..."
        
        # Create backup
        sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Add socket.io location block before the closing brace
        # Find the line with the closing brace of the server block
        SOCKET_IO_BLOCK="
    # Socket.io WebSocket connections - CRITICAL for video calls
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }"
        
        # Insert before the last closing brace
        sudo sed -i "\$i\\$SOCKET_IO_BLOCK" "$NGINX_CONF"
        
        echo "✅ Added Socket.io location block to Nginx config"
    else
        echo "✅ Nginx config already has Socket.io support"
    fi
else
    echo "⚠️  Nginx config file not found at $NGINX_CONF"
    echo "   Creating new configuration file..."
    
    # Create new config file with full configuration
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name 54.159.42.7;

    # Increase body size for file uploads
    client_max_body_size 10M;

    # Frontend static files
    location / {
        root /var/www/interview-prep/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # Socket.io WebSocket connections - CRITICAL for video calls
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Real-time updates (Server-Sent Events)
    location /api/realtime {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400;
    }
}
EOF
    echo "✅ Created new Nginx configuration file"
fi

# Test Nginx configuration before reloading
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    # Reload nginx to serve new frontend build
    echo "🌐 Reloading nginx..."
    sudo systemctl reload nginx || sudo systemctl restart nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed!"
    echo "   Please check the configuration manually"
    echo "   Backup saved at: ${NGINX_CONF}.backup.*"
    exit 1
fi

# Wait a moment for services to stabilize
sleep 3

# Verify backend is running
echo "🏥 Verifying backend health..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend health check failed, but continuing..."
fi

echo ""
echo "=== Deployment Completed Successfully ==="
echo "Backend: http://54.159.42.7:5000"
echo "Frontend: http://54.159.42.7"
echo "Timestamp: $(date)"

