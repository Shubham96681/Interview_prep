#!/bin/bash
# Quick setup script for EC2 - Run this after SSH into your instance

echo "=== Setting up EC2 for InterviewAce ==="

# Update system
echo "Updating system..."
sudo yum update -y

# Install Node.js 18
echo "Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
echo "Installing Git..."
sudo yum install -y git

# Install PM2
echo "Installing PM2..."
sudo npm install -g pm2

# Install Nginx
echo "Installing Nginx..."
sudo yum install -y nginx

# Verify installations
echo "=== Verifying installations ==="
node --version
npm --version
git --version
nginx -v
pm2 --version

# Create project directory
echo "Creating project directory..."
sudo mkdir -p /var/www/interview-prep
sudo chown -R ec2-user:ec2-user /var/www/interview-prep

echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. cd /var/www/interview-prep"
echo "2. git clone https://github.com/Shubham96681/Interview_prep.git ."
echo "3. Follow the DEPLOYMENT_GUIDE.md for next steps"

