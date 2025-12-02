#!/bin/bash
# Script to check and restart backend server

echo "🔍 Checking backend server status..."

# Check if backend is responding
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy and responding!"
    exit 0
fi

echo "❌ Backend is not responding. Checking PM2..."

# Check PM2 status
if command -v pm2 &> /dev/null; then
    echo "📊 PM2 Status:"
    pm2 status
    
    echo ""
    echo "📋 PM2 Logs (last 20 lines):"
    pm2 logs --lines 20 --nostream
    
    echo ""
    echo "🔄 Attempting to restart backend..."
    cd /var/www/interview-prep/server || cd server
    pm2 restart all || pm2 start index.js --name "interview-prep-backend"
    
    echo ""
    echo "⏳ Waiting 5 seconds for server to start..."
    sleep 5
    
    # Check again
    if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
        echo "✅ Backend restarted successfully!"
    else
        echo "❌ Backend still not responding. Check logs:"
        echo "   pm2 logs"
        echo "   pm2 logs interview-prep-backend"
    fi
else
    echo "⚠️  PM2 not found. Checking if Node process is running..."
    
    # Check if node process is running on port 5000
    if lsof -i :5000 > /dev/null 2>&1; then
        echo "⚠️  Port 5000 is in use but health check failed. Process might be stuck."
        echo "   Kill the process and restart manually:"
        echo "   kill \$(lsof -t -i:5000)"
        echo "   cd /var/www/interview-prep/server"
        echo "   node index.js"
    else
        echo "❌ No process listening on port 5000."
        echo "   Start the backend manually:"
        echo "   cd /var/www/interview-prep/server"
        echo "   node index.js"
        echo "   OR with PM2:"
        echo "   pm2 start index.js --name interview-prep-backend"
    fi
fi

echo ""
echo "🔍 Checking Nginx status..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running"
else
    echo "❌ Nginx is not running. Starting..."
    sudo systemctl start nginx
fi

echo ""
echo "📋 Nginx error logs (last 10 lines):"
sudo tail -n 10 /var/log/nginx/error.log

