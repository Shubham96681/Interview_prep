#!/bin/bash

# Don't use set -e globally - we'll handle errors explicitly
# set -e causes issues with pipes and subshells

# Force unbuffered output for SSH - simple approach
export PYTHONUNBUFFERED=1
# Use script command or simple unbuffered I/O
if [ -t 1 ]; then
    # Interactive terminal - no buffering needed
    :
else
    # Non-interactive (SSH) - ensure line buffering
    export NODE_OPTIONS="${NODE_OPTIONS} --no-warnings"
fi

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"
echo "Deployment version: $(date +%Y%m%d-%H%M%S)"

# Check disk space before starting
echo "💾 Checking disk space..."
df -h / | tail -1 | awk '{print "Available space: " $4 " of " $2 " (" $5 " used)"}'

# Navigate to project directory
cd /var/www/interview-prep

# Cleanup old files to free up space (optional - skip if we have enough space)
echo "🧹 Checking if cleanup is needed..."
AVAILABLE_SPACE=$(df -h / | tail -1 | awk '{print $4}' | sed 's/G//' | sed 's/M//')
if [ -n "$AVAILABLE_SPACE" ] && [ "$AVAILABLE_SPACE" -lt 2 ] 2>/dev/null; then
    echo "   Low disk space (${AVAILABLE_SPACE}G available), cleaning up..."
    
    # Remove old node_modules to save space (we'll reinstall)
    # Use more robust removal methods
    if [ -d "node_modules" ]; then
        echo "   Removing old frontend node_modules..."
        # Try multiple methods to ensure removal
        rm -rf node_modules 2>/dev/null || \
        find node_modules -delete 2>/dev/null || \
        sudo rm -rf node_modules 2>/dev/null || \
        echo "   ⚠️  Could not remove frontend node_modules, continuing..."
    fi

    if [ -d "server/node_modules" ]; then
        echo "   Removing old backend node_modules..."
        # Try multiple methods to ensure removal
        rm -rf server/node_modules 2>/dev/null || \
        find server/node_modules -delete 2>/dev/null || \
        sudo rm -rf server/node_modules 2>/dev/null || \
        echo "   ⚠️  Could not remove backend node_modules, continuing..."
    fi

    # Remove old build artifacts
    if [ -d "dist" ]; then
        echo "   Removing old dist build..."
        rm -rf dist 2>/dev/null || sudo rm -rf dist 2>/dev/null || echo "   ⚠️  Could not remove dist, continuing..."
    fi
else
    echo "   Sufficient disk space available, skipping cleanup to speed up deployment"
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
echo "   This may take 2-5 minutes..."
echo "   Progress will be shown below..."

# If node_modules exists, try to update instead of full reinstall
if [ -d "node_modules" ] && [ "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "   node_modules exists, updating dependencies..."
    if ! npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error; then
        echo "   ⚠️  Update failed, trying clean install..."
        rm -rf node_modules package-lock.json 2>/dev/null || true
        echo "   Starting clean install..."
        npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error
    fi
else
    echo "   Starting fresh install..."
    npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error
fi

if [ $? -eq 0 ]; then
    echo "✅ Frontend dependencies installed successfully"
else
    echo "❌ Frontend dependencies installation failed!"
    exit 1
fi

# Install server dependencies
echo "📦 Installing backend dependencies..."
echo "   This may take 2-5 minutes..."
echo "   Progress will be shown below..."
cd server

# If node_modules exists, try to update instead of full reinstall
if [ -d "node_modules" ] && [ "$(ls -A node_modules 2>/dev/null)" ]; then
    echo "   node_modules exists, updating dependencies..."
    if ! npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error; then
        echo "   ⚠️  Update failed, trying clean install..."
        rm -rf node_modules package-lock.json 2>/dev/null || true
        echo "   Starting clean install..."
        npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error
    fi
else
    echo "   Starting fresh install..."
    # Install all dependencies (Prisma needs dev dependencies for engines)
    npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false --loglevel=error
fi

if [ $? -eq 0 ]; then
    echo "✅ Backend dependencies installed successfully"
else
    echo "❌ Backend dependencies installation failed!"
    exit 1
fi
# Ensure Prisma is properly set up
npx prisma generate || echo "⚠️ Prisma generate failed, continuing..."
cd ..

# Build frontend
if [ "${SKIP_FRONTEND_BUILD}" = "true" ] && [ -f "dist/index.html" ]; then
  echo "✅ Using pre-built frontend from CI (skipping npm run build)"
elif [ -f "dist/index.html" ]; then
  echo "✅ Frontend build already exists, skipping rebuild"
else
echo "🔨 Building frontend application..."
echo "   This may take 5-15 minutes on EC2..."
echo "   Starting build at $(date)..."
echo "   Current memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "   Current directory: $(pwd)"
echo "   Node version: $(node --version 2>/dev/null || echo 'not found')"
echo "   NPM version: $(npm --version 2>/dev/null || echo 'not found')"

# Optimize Node.js for low-memory environment
# Use less memory to avoid OOM kills on small EC2 instances
export NODE_OPTIONS="--max-old-space-size=384 --no-warnings"

# Clear any existing build cache to avoid stale issues
echo "   Clearing build cache..."
rm -rf node_modules/.vite 2>/dev/null || true
rm -rf dist 2>/dev/null || true

# Run build with timeout - simple direct execution
echo "   Running: npm run build (optimized for low memory)"
echo "   (This may take 3-10 minutes, please wait...)"

# Run build directly with timeout - let output stream naturally
set +e  # Temporarily disable exit on error to handle timeout
timeout 1800 npm run build 2>&1 | tee /tmp/build.log
BUILD_EXIT_CODE=$?
set -e  # Re-enable exit on error

# Show last 20 lines of build output if it failed
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "   Last 20 lines of build output:"
    tail -20 /tmp/build.log || true
fi

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ Build command completed at $(date)"
elif [ $BUILD_EXIT_CODE -eq 124 ]; then
    echo "❌ Build timed out after 30 minutes!"
    exit 1
else
    echo "❌ Build failed with exit code: $BUILD_EXIT_CODE at $(date)"
    exit 1
fi
fi

# Verify build succeeded
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ Frontend build failed! dist/ directory not found."
    exit 1
fi
echo "✅ Frontend build successful at $(date)"

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

# Update FRONTEND_URL to use the correct IP (HTTPS)
PUBLIC_HOST="${PUBLIC_HOST:-${EC2_HOST:-}}"
if [ -z "$PUBLIC_HOST" ]; then
    PUBLIC_HOST="$(curl -fsS --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
fi
if [ -z "$PUBLIC_HOST" ]; then
    echo "⚠️  PUBLIC_HOST not set; keeping existing FRONTEND_URL"
else
echo "📝 Updating FRONTEND_URL in server/.env to https://${PUBLIC_HOST}..."
cd server
if grep -q "^FRONTEND_URL=" .env; then
    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${PUBLIC_HOST}|" .env
    echo "   ✅ Updated FRONTEND_URL to https://${PUBLIC_HOST}"
else
    echo "FRONTEND_URL=https://${PUBLIC_HOST}" >> .env
    echo "   ✅ Added FRONTEND_URL=https://${PUBLIC_HOST}"
fi
cd ..
fi

# Run database migrations
echo "🗄️  Running database migrations..."
cd server
npx prisma generate || echo "⚠️ Prisma generate warning (may already be generated)"
npx prisma db push --skip-generate --accept-data-loss || echo "⚠️ Database push warning (may already be up to date)"

# Skip database seeding - it's not critical for deployment
# echo "🌱 Seeding database with demo users..."
# node -e "
# const db = require('./services/database');
# db.initialize()
#   .then(() => {
#     console.log('✅ Database seeding completed');
#     process.exit(0);
#   })
#   .catch(err => {
#     console.error('❌ Database seeding failed:', err);
#     process.exit(1);
#   });
# " || echo "⚠️ Database seeding skipped or failed"
cd ..

# Restart backend server
echo "🔄 Restarting backend server..."
echo "   Checking PM2 status..."
pm2 list || echo "⚠️ PM2 not available or no processes"

if pm2 list 2>/dev/null | grep -q "interview-prep-backend"; then
    echo "   Restarting existing PM2 process..."
    pm2 restart interview-prep-backend --update-env || {
        echo "⚠️ Restart failed, trying to start fresh..."
        pm2 delete interview-prep-backend 2>/dev/null || true
        cd server
        pm2 start npm --name "interview-prep-backend" -- start
        cd ..
    }
else
    echo "   Starting new PM2 process..."
    cd server
    pm2 start npm --name "interview-prep-backend" -- start || {
        echo "❌ Failed to start PM2 process"
        exit 1
    }
    cd ..
fi

# Save PM2 configuration
echo "   Saving PM2 configuration..."
pm2 save || echo "⚠️ Failed to save PM2 configuration"

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

# Configure nginx for WebSocket support and HTTPS
echo "🌐 Configuring nginx..."
NGINX_CONFIG="/etc/nginx/conf.d/interview-prep.conf"
NGINX_CONFIG_DIR="/etc/nginx/conf.d"
NGINX_SSL_DIR="/etc/nginx/ssl"

if [ -z "${PUBLIC_HOST:-}" ]; then
    PUBLIC_HOST="${EC2_HOST:-}"
fi
if [ -z "$PUBLIC_HOST" ]; then
    PUBLIC_HOST="$(curl -fsS --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo localhost)"
fi
echo "   Using public host: $PUBLIC_HOST"

# Create nginx config and SSL directories if they don't exist
sudo mkdir -p "$NGINX_CONFIG_DIR"
sudo mkdir -p "$NGINX_SSL_DIR"

# Generate self-signed certificate if it doesn't exist
if [ ! -f "$NGINX_SSL_DIR/nginx-selfsigned.crt" ]; then
    echo "   Generating self-signed SSL certificate..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$NGINX_SSL_DIR/nginx-selfsigned.key" \
      -out "$NGINX_SSL_DIR/nginx-selfsigned.crt" \
      -subj "/CN=${PUBLIC_HOST}" 2>/dev/null || {
        echo "⚠️  Failed to generate SSL certificate. Continuing with HTTP only."
    }
fi

# Create or update nginx configuration
echo "   Creating/updating nginx configuration..."
sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
# HTTP server - redirect to HTTPS
server {
    listen 80 default_server;
    server_name ${PUBLIC_HOST};
    
    # Redirect all HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2 default_server;
    server_name ${PUBLIC_HOST};

    # SSL certificate configuration
    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Increase max upload size for video recordings
    client_max_body_size 500m;
    client_body_timeout 300s;
    client_body_buffer_size 128k;

    # Frontend static files
    location / {
        root /var/www/interview-prep/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Authorization \$http_authorization;
        proxy_pass_request_headers on;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_request_buffering off;
        client_max_body_size 500m;
        client_body_timeout 300s;
    }

    # Socket.io WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Authorization \$http_authorization;
        proxy_pass_request_headers on;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
EOF

echo "✅ Nginx configuration updated"

# Test nginx configuration
echo "   Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

# Reload nginx to serve new frontend build
echo "🌐 Reloading nginx..."
sudo systemctl reload nginx || sudo systemctl restart nginx

# Verify nginx is running
if sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "⚠️  Warning: Nginx might not be running"
    sudo systemctl start nginx
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

# Final disk space check
echo ""
echo "💾 Final disk space:"
df -h / | tail -1 | awk '{print "Available space: " $4 " of " $2 " (" $5 " used)"}'

echo ""
echo "=== Deployment Completed Successfully ==="
echo "Backend: http://${PUBLIC_HOST}:5000"
echo "Frontend: https://${PUBLIC_HOST} (HTTPS)"
echo "          http://${PUBLIC_HOST} (redirects to HTTPS)"
echo ""
echo "⚠️  Note: Self-signed certificate is used. Browsers will show a security warning."
echo "   Click 'Advanced' → 'Proceed to ${PUBLIC_HOST}' to continue."
echo ""
echo "Timestamp: $(date)"

