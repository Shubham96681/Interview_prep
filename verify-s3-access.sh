#!/bin/bash

echo "🔍 Verifying S3 Access"
echo "======================"
echo ""

BUCKET_NAME="interview-prep-recordings-2024"
REGION="us-east-1"

echo "📋 Testing S3 bucket access..."
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Test 1: List bucket
echo "1️⃣ Testing bucket list access..."
if aws s3 ls "s3://$BUCKET_NAME/" --region $REGION 2>&1; then
    echo "✅ Can list bucket contents"
else
    echo "❌ Cannot list bucket contents"
fi

echo ""
echo "2️⃣ Testing bucket write access..."
# Create a test file
TEST_FILE="/tmp/s3-test-$(date +%s).txt"
echo "Test file created at $(date)" > "$TEST_FILE"
TEST_KEY="test/access-test-$(date +%s).txt"

if aws s3 cp "$TEST_FILE" "s3://$BUCKET_NAME/$TEST_KEY" --region $REGION 2>&1; then
    echo "✅ Can write to bucket"
    
    # Clean up test file
    echo "🧹 Cleaning up test file..."
    aws s3 rm "s3://$BUCKET_NAME/$TEST_KEY" --region $REGION 2>&1
    rm -f "$TEST_FILE"
else
    echo "❌ Cannot write to bucket"
    rm -f "$TEST_FILE"
fi

echo ""
echo "3️⃣ Checking current IAM identity..."
aws sts get-caller-identity

echo ""
echo "4️⃣ Checking bucket policy..."
aws s3api get-bucket-policy --bucket "$BUCKET_NAME" --region $REGION 2>&1 | head -20

echo ""
echo "✅ Verification complete!"

