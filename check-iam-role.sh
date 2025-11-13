#!/bin/bash

echo "🔍 Checking IAM Role Configuration"
echo "===================================="
echo ""

# Check if running on EC2
echo "📋 Checking if running on EC2..."
if [ -f /sys/hypervisor/uuid ] || [ -f /sys/devices/virtual/dmi/id/product_uuid ]; then
    echo "✅ Running on EC2 instance"
else
    echo "⚠️  Not running on EC2 (or cannot detect)"
fi

echo ""
echo "📋 Checking IAM Role..."
echo ""

# Check if instance metadata service is available
if curl -s --max-time 2 http://169.254.169.254/latest/meta-data/ > /dev/null 2>&1; then
    echo "✅ Instance Metadata Service (IMDS) is accessible"
    
    # Get instance ID
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
    if [ -n "$INSTANCE_ID" ]; then
        echo "   Instance ID: $INSTANCE_ID"
    fi
    
    # Get IAM role name
    IAM_ROLE=$(curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null)
    if [ -n "$IAM_ROLE" ]; then
        echo "✅ IAM Role attached: $IAM_ROLE"
        
        # Get role details
        echo ""
        echo "📋 IAM Role Details:"
        ROLE_INFO=$(curl -s http://169.254.169.254/latest/meta-data/iam/security-credentials/$IAM_ROLE 2>/dev/null)
        if [ -n "$ROLE_INFO" ]; then
            echo "$ROLE_INFO" | python3 -m json.tool 2>/dev/null || echo "$ROLE_INFO"
        fi
    else
        echo "❌ No IAM Role attached to this EC2 instance"
        echo ""
        echo "💡 To attach an IAM role:"
        echo "   1. Go to EC2 Console → Instances"
        echo "   2. Select your instance"
        echo "   3. Actions → Security → Modify IAM role"
        echo "   4. Select 'InterviewPrepS3Role'"
    fi
else
    echo "❌ Cannot access Instance Metadata Service"
    echo "   This might mean:"
    echo "   - Not running on EC2"
    echo "   - IMDS is disabled"
    echo "   - Network issue"
fi

echo ""
echo "📋 Checking AWS CLI configuration..."
if command -v aws &> /dev/null; then
    echo "✅ AWS CLI is installed"
    
    # Check if credentials are configured
    AWS_IDENTITY=$(aws sts get-caller-identity 2>&1)
    if echo "$AWS_IDENTITY" | grep -q "arn:aws:iam"; then
        echo "✅ AWS credentials are configured"
        echo "$AWS_IDENTITY" | python3 -m json.tool 2>/dev/null || echo "$AWS_IDENTITY"
    else
        echo "⚠️  AWS credentials not configured (this is OK if using IAM role)"
        echo "$AWS_IDENTITY"
    fi
else
    echo "⚠️  AWS CLI is not installed"
fi

echo ""
echo "📋 Checking S3 access..."
if command -v aws &> /dev/null; then
    BUCKET_NAME="interview-prep-recordings-2024"
    echo "Testing access to bucket: $BUCKET_NAME"
    
    if aws s3 ls "s3://$BUCKET_NAME/" --region us-east-1 2>&1 | grep -q "PRE"; then
        echo "✅ Can access S3 bucket: $BUCKET_NAME"
        echo ""
        echo "📁 Bucket contents:"
        aws s3 ls "s3://$BUCKET_NAME/" --region us-east-1 --human-readable
    else
        ERROR=$(aws s3 ls "s3://$BUCKET_NAME/" --region us-east-1 2>&1)
        echo "❌ Cannot access S3 bucket"
        echo "Error: $ERROR"
    fi
else
    echo "⚠️  Cannot test S3 access (AWS CLI not installed)"
fi

echo ""
echo "✅ Check complete!"

