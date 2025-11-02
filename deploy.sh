#!/bin/bash

echo "=== Starting Deployment for InterviewAce ==="

# Navigate to project directory
cd /var/www/interview-prep

# Pull latest changes
echo "Pulling latest changes from GitHub..."
git pull origin main || echo "Already up to date"

# Install root dependencies (frontend) - need dev deps for build
echo "Installing frontend dependencies..."
npm install

# Install server dependencies (production only)
echo "Installing backend dependencies..."
cd server
npm install --production
cd ..

# Build frontend
echo "Building frontend application..."
npm run build

# Setup environment variables for server (if .env doesn't exist)
if [ ! -f server/.env ]; then
    echo "Creating server/.env from template..."
    cp server/env.example server/.env
    echo "⚠️  Please edit server/.env with your production values!"
fi

# Run database migrations
echo "Running database migrations..."
cd server
npx prisma generate
npx prisma migrate deploy || npx prisma db push --skip-generate
cd ..

# Restart backend server
echo "Restarting backend server..."
pm2 restart interview-prep-backend || pm2 start npm --name "interview-prep-backend" --cwd server -- start

# Frontend is served by nginx (static files from dist/)
# No need to run frontend server if using nginx

# Save PM2 configuration
pm2 save

echo "=== Deployment Completed ==="
echo "Backend: http://54.159.42.7:5000"
echo "Frontend: http://54.159.42.7"

