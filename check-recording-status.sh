#!/bin/bash

# Comprehensive recording status check
# Usage: ./check-recording-status.sh

echo "🔍 Recording Status Check"
echo "========================"
echo ""

cd /var/www/interview-prep/server

# Check S3 bucket
echo "📦 S3 Bucket Status:"
echo "-------------------"
BUCKET="interview-prep-recordings-2024"
REGION="us-east-1"

if command -v aws &> /dev/null; then
    FILE_COUNT=$(aws s3 ls s3://$BUCKET/recordings/ --region $REGION --recursive 2>/dev/null | wc -l)
    if [ "$FILE_COUNT" -gt 0 ]; then
        echo "✅ S3 bucket has $FILE_COUNT recording file(s)"
        echo ""
        echo "Recent files:"
        aws s3 ls s3://$BUCKET/recordings/ --region $REGION --human-readable | tail -5
    else
        echo "⚠️  S3 bucket is empty (0 files)"
    fi
else
    echo "⚠️  AWS CLI not installed"
fi

echo ""
echo "📊 Database Status (prod.db):"
echo "-----------------------------"

DB_FILE="prisma/prod.db"

# Total sessions
TOTAL=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
echo "Total sessions: $TOTAL"

# Sessions with recordings
WITH_RECORDINGS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sessions WHERE recordingUrl IS NOT NULL AND recordingUrl != '';" 2>/dev/null)
echo "Sessions with recording URLs: $WITH_RECORDINGS"

# Sessions with S3 recordings
S3_RECORDINGS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sessions WHERE recordingUrl LIKE '%s3%' OR recordingUrl LIKE '%amazonaws%';" 2>/dev/null)
echo "Sessions with S3 recordings: $S3_RECORDINGS"

# Sessions with local recordings
LOCAL_RECORDINGS=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sessions WHERE recordingUrl LIKE '%uploads%' OR recordingUrl LIKE '%/recordings/%';" 2>/dev/null)
echo "Sessions with local recordings: $LOCAL_RECORDINGS"

echo ""
echo "📋 Recent sessions:"
sqlite3 "$DB_FILE" "SELECT id, substr(meetingId, 1, 20) as meetingId, status, CASE WHEN recordingUrl IS NULL OR recordingUrl = '' THEN 'No recording' ELSE substr(recordingUrl, 1, 50) END as recording FROM sessions ORDER BY createdAt DESC LIMIT 5;" 2>/dev/null | column -t -s '|'

echo ""
echo "📝 Backend Logs (recording/S3 related):"
echo "---------------------------------------"
pm2 logs interview-prep-backend --lines 500 --nostream 2>/dev/null | grep -i "recording\|s3\|upload" | tail -20 || echo "No relevant logs found"

echo ""
echo "✅ Check complete!"
echo ""
echo "💡 To test recording:"
echo "   1. Join a meeting"
echo "   2. Wait for auto-recording to start"
echo "   3. End the meeting (recording will upload automatically)"
echo "   4. Run this script again to check if recording was uploaded to S3"

