#!/bin/bash

# Check database schema
# Usage: ./check-db-schema.sh

DB_PATH="/var/www/interview-prep/server/prisma/dev.db"

echo "🔍 Checking Database Schema"
echo "==========================="
echo ""

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database file not found at: $DB_PATH"
    exit 1
fi

echo "📋 Sessions table structure:"
echo "----------------------------"
sqlite3 "$DB_PATH" ".schema sessions" 2>/dev/null || echo "Table 'sessions' not found"

echo ""
echo "📊 All tables in database:"
echo "--------------------------"
sqlite3 "$DB_PATH" ".tables" 2>/dev/null

echo ""
echo "📋 Sample data from sessions (if exists):"
echo "-----------------------------------------"
sqlite3 "$DB_PATH" "SELECT * FROM sessions LIMIT 1;" 2>/dev/null || echo "No sessions found or table doesn't exist"

