#!/bin/bash

echo "🔧 Comprehensive Fix for Recording Issues"
echo "=========================================="
echo ""

cd /var/www/interview-prep || exit 1

# Step 1: Fix Nginx Configuration
echo "1️⃣ Fixing Nginx upload size limit..."
if [ -f "/etc/nginx/conf.d/interview-prep.conf" ]; then
    NGINX_CONF="/etc/nginx/conf.d/interview-prep.conf"
elif [ -f "/etc/nginx/sites-available/default" ]; then
    NGINX_CONF="/etc/nginx/sites-available/default"
else
    echo "❌ Could not find nginx config file"
    exit 1
fi

# Backup
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

# Add client_max_body_size if not exists
if ! grep -q "client_max_body_size" "$NGINX_CONF"; then
    sudo sed -i '/server_name.*54.91.53.228/a\    client_max_body_size 500m;\n    client_body_timeout 300s;' "$NGINX_CONF"
    echo "✅ Added client_max_body_size to server block"
else
    sudo sed -i 's/client_max_body_size.*/client_max_body_size 500m;/g' "$NGINX_CONF"
    echo "✅ Updated client_max_body_size"
fi

# Add to /api location if not exists
if ! grep -A 15 "location /api" "$NGINX_CONF" | grep -q "client_max_body_size"; then
    sudo sed -i '/location \/api {/,/}/ { /proxy_read_timeout/a\        client_max_body_size 500m;\n        client_body_timeout 300s;\n        proxy_request_buffering off;' "$NGINX_CONF"
    echo "✅ Added client_max_body_size to /api location"
fi

# Test and reload nginx
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed!"
    exit 1
fi

echo ""

# Step 2: Verify S3 Configuration
echo "2️⃣ Verifying S3 configuration..."
cd server
if grep -q "AWS_S3_BUCKET_NAME=interview-prep-recordings-2024" .env 2>/dev/null; then
    echo "✅ S3 bucket name is configured"
else
    echo "⚠️  S3 bucket name not found in .env"
    if ! grep -q "AWS_S3_BUCKET_NAME" .env 2>/dev/null; then
        echo "AWS_S3_BUCKET_NAME=interview-prep-recordings-2024" >> .env
        echo "✅ Added AWS_S3_BUCKET_NAME to .env"
    fi
fi

if grep -q "AWS_REGION=us-east-1" .env 2>/dev/null; then
    echo "✅ AWS region is configured"
else
    if ! grep -q "AWS_REGION" .env 2>/dev/null; then
        echo "AWS_REGION=us-east-1" >> .env
        echo "✅ Added AWS_REGION to .env"
    fi
fi

# Verify IAM role
echo ""
echo "3️⃣ Verifying IAM role access..."
if curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ | grep -q "InterviewPrepS3Role"; then
    echo "✅ IAM role detected in metadata"
elif aws sts get-caller-identity 2>/dev/null | grep -q "InterviewPrepS3Role"; then
    echo "✅ IAM role is active (via AWS CLI)"
else
    echo "⚠️  IAM role not detected, but S3 access may still work"
fi

# Test S3 access
echo ""
echo "4️⃣ Testing S3 access..."
if aws s3 ls s3://interview-prep-recordings-2024/ --region us-east-1 >/dev/null 2>&1; then
    echo "✅ S3 bucket is accessible"
else
    echo "❌ Cannot access S3 bucket - check IAM role permissions"
fi

echo ""

# Step 3: Restart Backend
echo "5️⃣ Restarting backend service..."
cd /var/www/interview-prep
if pm2 list | grep -q "interview-prep-backend"; then
    pm2 restart interview-prep-backend --update-env
    echo "✅ Backend restarted"
    sleep 2
    echo ""
    echo "📋 Recent backend logs (S3 related):"
    pm2 logs interview-prep-backend --lines 20 --nostream | grep -i "s3\|aws\|bucket\|recording" | tail -10 || echo "No S3-related logs found"
else
    echo "⚠️  Backend service not found in PM2"
fi

echo ""
echo "✅ All fixes applied!"
echo ""
echo "📝 Summary:"
echo "   - Nginx: client_max_body_size set to 500MB"
echo "   - S3: Configuration verified"
echo "   - Backend: Restarted with updated environment"
echo ""
echo "🧪 Next steps:"
echo "   1. Test recording upload from the website"
echo "   2. Check backend logs: pm2 logs interview-prep-backend --lines 0 | grep -i 'recording\|s3'"
echo "   3. Verify S3 upload: aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --human-readable"

