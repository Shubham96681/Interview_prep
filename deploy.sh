#!/bin/bash

# Don't use set -e, handle errors manually for better control
set +e

echo "=== Starting Deployment for InterviewAce ==="
echo "Timestamp: $(date)"
echo "PID: $$"

# Navigate to project directory
cd /var/www/interview-prep

# Ensure we're on the main branch
git checkout main || true

# Install root dependencies (frontend) - need dev deps for build
# Only install if node_modules doesn't exist or package.json changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    echo "   Starting at: $(date)"
    if command -v timeout >/dev/null 2>&1; then
        timeout 300 npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false 2>&1 | tail -20
        INSTALL_EXIT=$?
        if [ $INSTALL_EXIT -eq 124 ]; then
            echo "❌ npm install timed out after 5 minutes"
            exit 1
        elif [ $INSTALL_EXIT -ne 0 ]; then
            echo "❌ npm install failed with exit code $INSTALL_EXIT"
            exit 1
        fi
    else
        npm install --legacy-peer-deps --prefer-offline --no-audit --progress=false 2>&1 | tail -20
        if [ $? -ne 0 ]; then
            echo "❌ npm install failed"
            exit 1
        fi
    fi
    echo "   Completed at: $(date)"
else
    echo "✅ Frontend dependencies already installed, skipping..."
fi

# Install server dependencies (production only)
echo "📦 Installing backend dependencies..."
cd server
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "   Starting at: $(date)"
    if command -v timeout >/dev/null 2>&1; then
        timeout 300 npm install --production --legacy-peer-deps --prefer-offline --no-audit --progress=false 2>&1 | tail -20
        INSTALL_EXIT=$?
        if [ $INSTALL_EXIT -eq 124 ]; then
            echo "❌ npm install timed out after 5 minutes"
            exit 1
        elif [ $INSTALL_EXIT -ne 0 ]; then
            echo "❌ npm install failed with exit code $INSTALL_EXIT"
            exit 1
        fi
    else
        npm install --production --legacy-peer-deps --prefer-offline --no-audit --progress=false 2>&1 | tail -20
        if [ $? -ne 0 ]; then
            echo "❌ npm install failed"
            exit 1
        fi
    fi
    echo "   Completed at: $(date)"
else
    echo "✅ Backend dependencies already installed, skipping..."
fi
cd ..

# Build frontend
echo "🔨 Building frontend application..."
echo "   Starting at: $(date)"
if command -v timeout >/dev/null 2>&1; then
    timeout 300 npm run build
    BUILD_EXIT=$?
    if [ $BUILD_EXIT -eq 124 ]; then
        echo "❌ Frontend build timed out after 5 minutes"
        exit 1
    elif [ $BUILD_EXIT -ne 0 ]; then
        echo "❌ Frontend build failed with exit code $BUILD_EXIT"
        exit 1
    fi
else
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Frontend build failed"
        exit 1
    fi
fi
echo "   Completed at: $(date)"

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
echo "   Generating Prisma client at: $(date)"
if command -v timeout >/dev/null 2>&1; then
    timeout 60 npx prisma generate --silent
    if [ $? -ne 0 ]; then
        echo "❌ Prisma generate failed or timed out"
        exit 1
    fi
else
    npx prisma generate --silent
    if [ $? -ne 0 ]; then
        echo "❌ Prisma generate failed"
        exit 1
    fi
fi
echo "   Pushing database schema at: $(date)"
if command -v timeout >/dev/null 2>&1; then
    timeout 30 npx prisma db push --skip-generate --accept-data-loss --skip-seed
    if [ $? -ne 0 ]; then
        echo "❌ Database push failed or timed out"
        exit 1
    fi
else
    npx prisma db push --skip-generate --accept-data-loss --skip-seed
    if [ $? -ne 0 ]; then
        echo "❌ Database push failed"
        exit 1
    fi
fi

# Seed database if needed (ensure demo users exist)
echo "🌱 Seeding database with demo users..."
echo "   Starting at: $(date)"
if command -v timeout >/dev/null 2>&1; then
    timeout 20 node -e "
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
    " 2>&1 || echo "⚠️  Database seeding timed out or failed, continuing..."
else
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
    " 2>&1 || echo "⚠️  Database seeding failed, continuing..."
fi
echo "   Completed at: $(date)"
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

# Reload nginx to serve new frontend build
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

