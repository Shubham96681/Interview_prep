#!/bin/bash

# Fix both dev.db and prod.db schemas
# Usage: ./fix-both-databases.sh

echo "🔧 Fixing Both Database Schemas"
echo "==============================="
echo ""

cd /var/www/interview-prep/server

# Function to add columns to a database
add_columns() {
    local db_file=$1
    echo "📋 Fixing: $db_file"
    
    if [ ! -f "$db_file" ]; then
        echo "⚠️  File not found: $db_file"
        return
    fi
    
    sqlite3 "$db_file" <<EOF
-- Add missing columns if they don't exist (ignore errors if already exist)
ALTER TABLE sessions ADD COLUMN "meetingLink" TEXT;
ALTER TABLE sessions ADD COLUMN "meetingId" TEXT;
ALTER TABLE sessions ADD COLUMN "recordingUrl" TEXT;
ALTER TABLE sessions ADD COLUMN "isRecordingEnabled" BOOLEAN DEFAULT 1;
ALTER TABLE sessions ADD COLUMN "additionalParticipants" TEXT;
EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Columns added to $db_file"
    else
        echo "⚠️  Some columns may already exist in $db_file (this is OK)"
    fi
    
    # Verify
    echo "📊 Columns in $db_file:"
    sqlite3 "$db_file" "PRAGMA table_info(sessions);" 2>/dev/null | grep -E "(meetingLink|meetingId|recordingUrl|isRecordingEnabled|additionalParticipants)" || echo "No matching columns found"
    echo ""
}

# Fix dev.db
if [ -f "prisma/dev.db" ]; then
    add_columns "prisma/dev.db"
fi

# Fix prod.db
if [ -f "prisma/prod.db" ]; then
    add_columns "prisma/prod.db"
fi

# Also check if DATABASE_URL points to a different location
DB_URL=$(grep DATABASE_URL .env | cut -d'=' -f2 | tr -d '"')
echo "📋 DATABASE_URL points to: $DB_URL"

# Check which database has sessions
echo ""
echo "📊 Session counts:"
if [ -f "prisma/dev.db" ]; then
    DEV_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
    echo "  dev.db: $DEV_COUNT sessions"
fi

if [ -f "prisma/prod.db" ]; then
    PROD_COUNT=$(sqlite3 prisma/prod.db "SELECT COUNT(*) FROM sessions;" 2>/dev/null)
    echo "  prod.db: $PROD_COUNT sessions"
fi

echo ""
echo "✅ Done! Now check recordings:"
echo "sqlite3 prisma/prod.db \"SELECT id, meetingId, recordingUrl FROM sessions WHERE recordingUrl IS NOT NULL LIMIT 5;\""

