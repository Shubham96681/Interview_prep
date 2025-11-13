#!/bin/bash

# Fix database schema - add missing columns
# Usage: ./fix-database-schema.sh

echo "🔧 Fixing Database Schema"
echo "========================="
echo ""

cd /var/www/interview-prep/server

# Check if database exists
if [ ! -f "prisma/dev.db" ]; then
    echo "❌ Database file not found"
    exit 1
fi

echo "📋 Current schema (before fix):"
sqlite3 prisma/dev.db ".schema sessions" | head -5

echo ""
echo "🔄 Running Prisma migration..."
echo ""

# Generate Prisma client
echo "Step 1: Generating Prisma client..."
npx prisma generate

# Push schema to database
echo ""
echo "Step 2: Pushing schema changes to database..."
npx prisma db push --skip-generate --accept-data-loss

echo ""
echo "📋 Updated schema (after fix):"
sqlite3 prisma/dev.db ".schema sessions" | grep -E "(meetingLink|meetingId|recordingUrl|isRecordingEnabled|additionalParticipants)"

echo ""
echo "✅ Schema update complete!"
echo ""
echo "📊 Verifying columns exist:"
sqlite3 prisma/dev.db "PRAGMA table_info(sessions);" | grep -E "(meetingLink|meetingId|recordingUrl|isRecordingEnabled|additionalParticipants)"

