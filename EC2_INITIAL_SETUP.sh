#!/bin/bash

# Initial EC2 Setup Script
# Run this ONCE on your EC2 instance before using GitHub Actions

echo "=== Initial EC2 Setup for InterviewAce ==="

# Update system
echo "Updating system..."
sudo yum update -y

# Install Node.js 18
echo "Installing Node.js 18..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
echo "Installing Git..."
sudo yum install -y git

# Install PM2 globally
echo "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "Installing Nginx..."
sudo yum install -y nginx

# Verify installations
echo "Verifying installations..."
node --version
npm --version
git --version
nginx -v
pm2 --version

# Create project directory with proper permissions
echo "Creating project directory..."
sudo mkdir -p /var/www
sudo chown ec2-user:ec2-user /var/www
cd /var/www

# Clone repository
echo "Cloning repository..."
if [ -d interview-prep ]; then
    echo "Directory exists, removing..."
    rm -rf interview-prep
fi
git clone https://github.com/Shubham96681/Interview_prep.git interview-prep
cd interview-prep

# Setup environment variables
echo "Setting up environment variables..."
cd server
if [ ! -f .env ]; then
    cp env.example .env
    echo "⚠️  IMPORTANT: Edit server/.env with your production values!"
    echo "   Run: nano server/.env"
fi
cd ..

# Install dependencies
echo "Installing dependencies..."
npm install --production
cd server
npm install --production
cd ..

# Build frontend
echo "Building frontend..."
npm run build

# Setup database
echo "Setting up database..."
cd server
npx prisma generate
npx prisma db push --skip-generate
cd ..

# Make deploy script executable
chmod +x deploy.sh

echo "=== Initial Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Edit server/.env with production values: nano server/.env"
echo "2. Configure Nginx (see DEPLOYMENT_GUIDE.md)"
echo "3. Start services:"
echo "   - PM2: pm2 start npm --name 'interview-prep-backend' --cwd server -- start"
echo "   - Nginx: sudo systemctl start nginx && sudo systemctl enable nginx"
echo "4. Setup PM2 startup: pm2 startup && pm2 save"

