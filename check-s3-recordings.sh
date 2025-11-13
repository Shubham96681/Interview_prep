#!/bin/bash

# Script to check S3 bucket for recording files
# Usage: ./check-s3-recordings.sh

BUCKET_NAME="interview-prep-recordings-2024"
REGION="us-east-1"

echo "🔍 Checking S3 bucket: $BUCKET_NAME"
echo "=================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    echo "Install it with: sudo yum install aws-cli -y"
    exit 1
fi

# List all objects in the recordings folder
echo "📁 Listing all recordings in S3:"
echo ""
aws s3 ls s3://$BUCKET_NAME/recordings/ --region $REGION --human-readable --summarize

echo ""
echo "=================================="
echo "📊 Summary:"
echo ""

# Count files
FILE_COUNT=$(aws s3 ls s3://$BUCKET_NAME/recordings/ --region $REGION --recursive | wc -l)
echo "Total files: $FILE_COUNT"

# Get total size
TOTAL_SIZE=$(aws s3 ls s3://$BUCKET_NAME/recordings/ --region $REGION --recursive --summarize | grep "Total Size" | awk '{print $3, $4}')
echo "Total size: $TOTAL_SIZE"

echo ""
echo "✅ Check complete!"

