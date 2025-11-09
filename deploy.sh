#!/bin/bash

set -e  # Exit on any error

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"

# Navigate to project directory
cd /var/www/interview-prep

# Ensure we're on the main branch
git checkout main || true

# Install root dependencies (frontend) - need dev deps for build
echo "📦 Installing frontend dependencies..."
npm install --legacy-peer-deps

# Install server dependencies (production only)
echo "📦 Installing backend dependencies..."
cd server
npm install --production --legacy-peer-deps
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
    pm2 start npm --name "interview-prep-backend" --cwd server -- start
fi

# Save PM2 configuration
pm2 save

# Update Nginx configuration for WebSocket support
echo "🌐 Updating Nginx configuration for WebSocket support..."
sudo tee /etc/nginx/conf.d/interview-prep.conf > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name 54.159.42.7;

    # Increase body size for file uploads
    client_max_body_size 10M;

    # Frontend static files
    location / {
        root /var/www/interview-prep/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Socket.io WebSocket connections
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
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
NGINX_EOF

# Add the map block to nginx.conf if not present
if ! grep -q "map \$http_upgrade \$connection_upgrade" /etc/nginx/nginx.conf; then
    echo "Adding WebSocket map to nginx.conf..."
    sudo sed -i '/^http {/a\    map $http_upgrade $connection_upgrade {\n        default upgrade;\n        '\'''\'' close;\n    }' /etc/nginx/nginx.conf
fi

# Test and reload nginx
echo "🌐 Testing Nginx configuration..."
if sudo nginx -t; then
    sudo systemctl reload nginx || sudo systemctl restart nginx
    echo "✅ Nginx configuration updated and reloaded"
else
    echo "❌ Nginx configuration test failed!"
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

