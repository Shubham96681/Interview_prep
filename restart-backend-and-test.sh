#!/bin/bash

echo "🔄 Restarting Backend and Testing Recording Upload"
echo "==================================================="
echo ""

echo "1️⃣ Checking backend service status..."
cd /var/www/interview-prep/server

if pm2 list | grep -q "interview-prep-backend"; then
    echo "✅ Backend service found"
    pm2 list | grep interview-prep-backend
else
    echo "⚠️  Backend service not found in PM2"
fi

echo ""
echo "2️⃣ Checking S3 configuration in .env..."
if grep -q "AWS_S3_BUCKET_NAME=interview-prep-recordings-2024" .env 2>/dev/null; then
    echo "✅ S3 bucket name configured"
else
    echo "❌ S3 bucket name not configured"
    echo "   Adding to .env..."
    if ! grep -q "AWS_S3_BUCKET_NAME" .env 2>/dev/null; then
        echo "AWS_S3_BUCKET_NAME=interview-prep-recordings-2024" >> .env
        echo "✅ Added AWS_S3_BUCKET_NAME to .env"
    fi
fi

if grep -q "AWS_REGION=us-east-1" .env 2>/dev/null; then
    echo "✅ AWS region configured"
else
    echo "❌ AWS region not configured"
    echo "   Adding to .env..."
    if ! grep -q "AWS_REGION" .env 2>/dev/null; then
        echo "AWS_REGION=us-east-1" >> .env
        echo "✅ Added AWS_REGION to .env"
    fi
fi

echo ""
echo "3️⃣ Restarting backend service..."
pm2 restart interview-prep-backend --update-env

echo ""
echo "4️⃣ Waiting for backend to start..."
sleep 3

echo ""
echo "5️⃣ Checking backend logs for S3 initialization..."
pm2 logs interview-prep-backend --lines 20 --nostream | grep -i "s3\|aws\|bucket" || echo "No S3-related logs found (this is OK)"

echo ""
echo "6️⃣ Testing backend health..."
if curl -s http://localhost:5000/api/health | grep -q "OK"; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend health check failed"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Test recording upload from the website"
echo "   2. Monitor backend logs: pm2 logs interview-prep-backend --lines 0 | grep -i 'recording\|s3'"
echo "   3. Check S3 bucket: aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --human-readable"

