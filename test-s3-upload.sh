#!/bin/bash

echo "🧪 Testing S3 Upload Functionality"
echo "==================================="
echo ""

BUCKET_NAME="interview-prep-recordings-2024"
REGION="us-east-1"

echo "1️⃣ Checking IAM role..."
IAM_ROLE=$(curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null)
if [ -n "$IAM_ROLE" ]; then
    echo "✅ IAM Role: $IAM_ROLE"
else
    echo "❌ No IAM role detected (may need to wait a few seconds)"
    exit 1
fi

echo ""
echo "2️⃣ Testing S3 bucket access..."
if aws s3 ls "s3://$BUCKET_NAME/" --region $REGION > /dev/null 2>&1; then
    echo "✅ Can access S3 bucket"
else
    echo "❌ Cannot access S3 bucket"
    exit 1
fi

echo ""
echo "3️⃣ Testing S3 write access..."
TEST_FILE="/tmp/s3-upload-test-$(date +%s).txt"
echo "Test upload at $(date)" > "$TEST_FILE"
TEST_KEY="test/upload-test-$(date +%s).txt"

if aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/$TEST_KEY" --region $REGION > /dev/null 2>&1; then
    echo "✅ Can write to S3 bucket"
    
    # Verify file exists
    if aws s3 ls "s3://$BUCKET_NAME/$TEST_KEY" --region $REGION > /dev/null 2>&1; then
        echo "✅ File uploaded successfully"
    fi
    
    # Clean up
    aws s3 rm "s3://$BUCKET_NAME/$TEST_KEY" --region $REGION > /dev/null 2>&1
    rm -f "$TEST_FILE"
    echo "✅ Test file cleaned up"
else
    echo "❌ Cannot write to S3 bucket"
    rm -f "$TEST_FILE"
    exit 1
fi

echo ""
echo "4️⃣ Checking backend S3 configuration..."
cd /var/www/interview-prep/server
if grep -q "AWS_S3_BUCKET_NAME=interview-prep-recordings-2024" .env 2>/dev/null; then
    echo "✅ S3 bucket name configured in .env"
else
    echo "⚠️  S3 bucket name not found in .env"
fi

if grep -q "AWS_REGION=us-east-1" .env 2>/dev/null; then
    echo "✅ AWS region configured in .env"
else
    echo "⚠️  AWS region not found in .env"
fi

echo ""
echo "5️⃣ Checking backend service status..."
if pm2 list | grep -q "interview-prep-backend.*online"; then
    echo "✅ Backend service is running"
    echo ""
    echo "💡 To ensure backend picks up IAM role, restart it:"
    echo "   pm2 restart interview-prep-backend --update-env"
else
    echo "⚠️  Backend service not running"
fi

echo ""
echo "✅ All checks complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Restart backend: pm2 restart interview-prep-backend --update-env"
echo "   2. Test recording upload from the website"
echo "   3. Check S3 bucket: aws s3 ls s3://$BUCKET_NAME/recordings/ --region $REGION"

