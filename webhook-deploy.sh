#!/bin/bash
# Webhook-based deployment script
# This runs on your EC2 instance and can be triggered via HTTP endpoint

set -e

echo "=== Webhook Deployment Started ==="
echo "Timestamp: $(date)"

# Navigate to project directory
cd /var/www/interview-prep || exit 1

# Pull latest changes
echo "🔄 Pulling latest changes..."
git fetch origin main
git reset --hard origin/main
git clean -fd

# Run deployment script
echo "📦 Running deployment script..."
./deploy.sh

echo "✅ Webhook deployment completed successfully"
echo "Timestamp: $(date)"

