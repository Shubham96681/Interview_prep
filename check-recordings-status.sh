#!/bin/bash

# Comprehensive script to check recording status
# Usage: ./check-recordings-status.sh

echo "🔍 Checking Recording Status"
echo "============================"
echo ""

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
    echo "⚠️  AWS CLI not installed - cannot check S3"
fi

echo ""
echo "📊 Database Status:"
echo "-------------------"

# Check database
DB_PATH="/var/www/interview-prep/server/prisma/dev.db"

if [ -f "$DB_PATH" ]; then
    # Total sessions
    TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
    echo "Total sessions in database: $TOTAL"
    
    # Sessions with recordings
    WITH_RECORDINGS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions WHERE recordingUrl IS NOT NULL;" 2>/dev/null)
    echo "Sessions with recording URLs: $WITH_RECORDINGS"
    
    # Sessions with S3 recordings
    S3_RECORDINGS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions WHERE recordingUrl LIKE '%s3%' OR recordingUrl LIKE '%amazonaws%';" 2>/dev/null)
    echo "Sessions with S3 recordings: $S3_RECORDINGS"
    
    # Sessions with local recordings
    LOCAL_RECORDINGS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions WHERE recordingUrl LIKE '%uploads%' OR recordingUrl LIKE '%/recordings/%';" 2>/dev/null)
    echo "Sessions with local recordings: $LOCAL_RECORDINGS"
    
    echo ""
    echo "Recent sessions with recordings:"
    sqlite3 "$DB_PATH" "SELECT id, meetingId, substr(recordingUrl, 1, 80) as recordingUrl, createdAt FROM sessions WHERE recordingUrl IS NOT NULL ORDER BY createdAt DESC LIMIT 5;" 2>/dev/null | column -t -s '|'
else
    echo "❌ Database file not found at: $DB_PATH"
fi

echo ""
echo "📝 Backend Logs (last 50 lines with 'recording' or 's3'):"
echo "--------------------------------------------------------"
pm2 logs interview-prep-backend --lines 200 --nostream 2>/dev/null | grep -i "recording\|s3" | tail -20 || echo "⚠️  Could not check PM2 logs"

echo ""
echo "✅ Check complete!"

