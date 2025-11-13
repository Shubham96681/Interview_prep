# How to Check if Videos are Stored in S3 Bucket

## Method 1: AWS Console (Web Interface) - Easiest

1. **Go to AWS S3 Console:**
   - Visit: https://console.aws.amazon.com/s3/
   - Make sure you're in the correct AWS region: **us-east-1**

2. **Open Your Bucket:**
   - Click on bucket: `interview-prep-recordings-2024`
   - Navigate to the `recordings/` folder

3. **Check for Files:**
   - You should see files like: `recording-{sessionId}-{timestamp}-{random}.webm`
   - Files are organized in the `recordings/` folder

## Method 2: AWS CLI (On EC2 Server)

### Step 1: SSH into your EC2 instance
```bash
ssh -i your-key.pem ec2-user@54.91.53.228
```

### Step 2: Run these commands one by one

**Check if AWS CLI is installed:**
```bash
aws --version
```

**If not installed, install it:**
```bash
sudo yum install aws-cli -y
```

**List all recordings in S3:**
```bash
aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --human-readable
```

**Get detailed list with file sizes:**
```bash
aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --recursive --human-readable
```

**Count total files:**
```bash
aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --recursive | wc -l
```

**Get total size:**
```bash
aws s3 ls s3://interview-prep-recordings-2024/recordings/ --region us-east-1 --recursive --summarize
```

**Download a specific file (for testing):**
```bash
aws s3 cp s3://interview-prep-recordings-2024/recordings/recording-xxx.webm ./test-recording.webm --region us-east-1
```

## Method 3: Check Backend Logs

**On EC2, check PM2 logs:**
```bash
pm2 logs interview-prep-backend --lines 100 | grep -i "s3\|recording\|upload"
```

**Look for these log messages:**
- `✅ Recording uploaded to S3 for session {id}: {key}`
- `S3 upload failed, falling back to local storage` (if S3 fails)

## Method 4: Check Database for Recording URLs

**On EC2, check the database:**
```bash
cd /var/www/interview-prep/server
npx prisma studio
```

Or query directly (note: table name is `sessions` lowercase):
```bash
sqlite3 prisma/dev.db "SELECT id, meetingId, recordingUrl, createdAt FROM sessions WHERE recordingUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 10;"
```

**Check all sessions (including those without recordings):**
```bash
sqlite3 prisma/dev.db "SELECT id, meetingId, recordingUrl, status, createdAt FROM sessions ORDER BY createdAt DESC LIMIT 10;"
```

**Count sessions with S3 recordings:**
```bash
sqlite3 prisma/dev.db "SELECT COUNT(*) as s3_recordings FROM sessions WHERE recordingUrl LIKE '%s3%' OR recordingUrl LIKE '%amazonaws%';"
```

**Recording URLs in S3 will look like:**
- `https://interview-prep-recordings-2024.s3.us-east-1.amazonaws.com/recordings/recording-xxx.webm?X-Amz-Algorithm=...` (signed URL)

**Local storage URLs will look like:**
- `https://54.91.53.228/uploads/recordings/recording-xxx.webm`

## Method 5: Check via API

**Get sessions with recordings:**
```bash
curl https://54.91.53.228/api/sessions?limit=10 | jq '.sessions[] | {id, meetingId, recordingUrl}'
```

Or in browser console:
```javascript
fetch('/api/sessions?limit=10')
  .then(r => r.json())
  .then(data => {
    const withRecordings = data.sessions.filter(s => s.recordingUrl);
    console.log('Sessions with recordings:', withRecordings);
    withRecordings.forEach(s => {
      console.log(`Session ${s.id}: ${s.recordingUrl}`);
    });
  });
```

## Quick Check Script (Run on EC2)

Save this as `check-s3.sh` on EC2:

```bash
#!/bin/bash
BUCKET="interview-prep-recordings-2024"
REGION="us-east-1"

echo "🔍 Checking S3 bucket: $BUCKET"
echo "================================"
echo ""

# List files
echo "📁 Recordings in S3:"
aws s3 ls s3://$BUCKET/recordings/ --region $REGION --human-readable

echo ""
echo "📊 Summary:"
FILE_COUNT=$(aws s3 ls s3://$BUCKET/recordings/ --region $REGION --recursive 2>/dev/null | wc -l)
echo "Total files: $FILE_COUNT"

# Check database
echo ""
echo "📋 Sessions with recording URLs in database:"
cd /var/www/interview-prep/server
sqlite3 prisma/dev.db "SELECT COUNT(*) as count FROM Session WHERE recordingUrl LIKE '%s3%' OR recordingUrl LIKE '%amazonaws%';" 2>/dev/null || echo "Database check failed"
```

Run it:
```bash
chmod +x check-s3.sh
./check-s3.sh
```

## Troubleshooting

**If no files in S3:**
1. Check if S3 is configured: `cat /var/www/interview-prep/server/.env | grep AWS_S3_BUCKET_NAME`
2. Check backend logs: `pm2 logs interview-prep-backend | grep -i s3`
3. Verify IAM role has S3 permissions
4. Check if recordings are being saved locally instead

**If files exist but can't access:**
1. Check IAM role permissions
2. Verify bucket policy allows access
3. Check if signed URLs are working

