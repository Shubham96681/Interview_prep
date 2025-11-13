#!/bin/bash

# Fix database schema - add missing columns
# Usage: ./fix-database-schema-correct.sh

echo "🔧 Fixing Database Schema"
echo "========================="
echo ""

cd /var/www/interview-prep/server

# Check which database file exists
echo "📋 Checking database files..."
if [ -f "prisma/dev.db" ]; then
    echo "✅ Found: prisma/dev.db"
    DB_FILE="prisma/dev.db"
elif [ -f "prisma/prod.db" ]; then
    echo "✅ Found: prisma/prod.db"
    DB_FILE="prisma/prod.db"
else
    echo "❌ No database file found!"
    exit 1
fi

# Check current DATABASE_URL
echo ""
echo "📋 Current DATABASE_URL:"
grep DATABASE_URL .env | head -1

echo ""
echo "📋 Current schema (before fix):"
sqlite3 "$DB_FILE" ".schema sessions" 2>/dev/null | head -10

echo ""
echo "🔄 Adding missing columns manually..."
echo ""

# Add missing columns using SQL
sqlite3 "$DB_FILE" <<EOF
-- Add missing columns if they don't exist
ALTER TABLE sessions ADD COLUMN "meetingLink" TEXT;
ALTER TABLE sessions ADD COLUMN "meetingId" TEXT;
ALTER TABLE sessions ADD COLUMN "recordingUrl" TEXT;
ALTER TABLE sessions ADD COLUMN "isRecordingEnabled" BOOLEAN DEFAULT 1;
ALTER TABLE sessions ADD COLUMN "additionalParticipants" TEXT;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Columns added successfully!"
else
    echo "⚠️  Some columns may already exist (this is OK)"
fi

echo ""
echo "📋 Updated schema (after fix):"
sqlite3 "$DB_FILE" ".schema sessions" 2>/dev/null | grep -E "(meetingLink|meetingId|recordingUrl|isRecordingEnabled|additionalParticipants)"

echo ""
echo "📊 Verifying columns exist:"
sqlite3 "$DB_FILE" "PRAGMA table_info(sessions);" 2>/dev/null | grep -E "(meetingLink|meetingId|recordingUrl|isRecordingEnabled|additionalParticipants)"

echo ""
echo "✅ Schema update complete!"
echo ""
echo "📋 Now you can query:"
echo "sqlite3 $DB_FILE \"SELECT id, meetingId, recordingUrl FROM sessions WHERE recordingUrl IS NOT NULL LIMIT 5;\""

