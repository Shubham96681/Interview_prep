#!/bin/bash

echo "🔍 Troubleshooting IAM Role Detection"
echo "======================================"
echo ""

echo "1️⃣ Checking Instance Metadata Service (IMDS)..."
if curl -s --max-time 2 http://169.254.169.254/latest/meta-data/ > /dev/null 2>&1; then
    echo "✅ IMDS is accessible"
else
    echo "❌ IMDS is not accessible"
    exit 1
fi

echo ""
echo "2️⃣ Checking IAM security credentials endpoint..."
IAM_ENDPOINT="http://169.254.169.254/latest/meta-data/iam/security-credentials/"
IAM_RESPONSE=$(curl -s --max-time 5 "$IAM_ENDPOINT" 2>&1)

if [ -n "$IAM_RESPONSE" ] && [ "$IAM_RESPONSE" != "404 - Not Found" ]; then
    echo "✅ IAM endpoint responded:"
    echo "$IAM_RESPONSE"
    IAM_ROLE=$(echo "$IAM_RESPONSE" | head -1)
    echo ""
    echo "3️⃣ Getting IAM role details..."
    ROLE_DETAILS=$(curl -s --max-time 5 "http://169.254.169.254/latest/meta-data/iam/security-credentials/$IAM_ROLE" 2>&1)
    if echo "$ROLE_DETAILS" | grep -q "AccessKeyId"; then
        echo "✅ IAM role credentials available:"
        echo "$ROLE_DETAILS" | python3 -m json.tool 2>/dev/null | head -10
    else
        echo "⚠️  Role details response:"
        echo "$ROLE_DETAILS"
    fi
else
    echo "❌ No IAM role found in metadata"
    echo "Response: $IAM_RESPONSE"
    echo ""
    echo "4️⃣ Checking instance ID..."
    INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
    if [ -n "$INSTANCE_ID" ]; then
        echo "   Instance ID: $INSTANCE_ID"
    fi
    
    echo ""
    echo "💡 Possible solutions:"
    echo "   1. Wait 1-2 minutes for IAM role to propagate"
    echo "   2. Restart the EC2 instance:"
    echo "      sudo reboot"
    echo "   3. Verify role is attached in AWS Console:"
    echo "      EC2 → Instances → Select instance → Security tab"
    echo "   4. Check if instance profile is attached:"
    echo "      aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].IamInstanceProfile'"
fi

echo ""
echo "5️⃣ Testing AWS CLI with current credentials..."
if command -v aws &> /dev/null; then
    IDENTITY=$(aws sts get-caller-identity 2>&1)
    if echo "$IDENTITY" | grep -q "arn:aws:iam"; then
        echo "✅ AWS CLI can get identity:"
        echo "$IDENTITY" | python3 -m json.tool 2>/dev/null
    else
        echo "⚠️  AWS CLI identity check:"
        echo "$IDENTITY"
    fi
else
    echo "⚠️  AWS CLI not installed"
fi

echo ""
echo "6️⃣ Testing S3 access directly..."
BUCKET_NAME="interview-prep-recordings-2024"
if aws s3 ls "s3://$BUCKET_NAME/" --region us-east-1 2>&1 | head -5; then
    echo "✅ Can access S3 bucket (even without IAM role in metadata)"
else
    ERROR=$(aws s3 ls "s3://$BUCKET_NAME/" --region us-east-1 2>&1)
    echo "❌ Cannot access S3 bucket:"
    echo "$ERROR"
fi

echo ""
echo "✅ Troubleshooting complete!"

