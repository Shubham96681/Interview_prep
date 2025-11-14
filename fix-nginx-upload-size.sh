#!/bin/bash

echo "🔧 Fixing Nginx Upload Size Limit"
echo "=================================="
echo ""

# Check if nginx config exists
NGINX_CONF="/etc/nginx/conf.d/interview-prep.conf"

if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ Nginx config not found at $NGINX_CONF"
    echo "   Looking for alternative locations..."
    
    # Try to find nginx config
    if [ -f "/etc/nginx/sites-available/default" ]; then
        NGINX_CONF="/etc/nginx/sites-available/default"
        echo "   Found config at: $NGINX_CONF"
    elif [ -f "/etc/nginx/nginx.conf" ]; then
        NGINX_CONF="/etc/nginx/nginx.conf"
        echo "   Found config at: $NGINX_CONF"
    else
        echo "❌ Could not find nginx configuration file"
        exit 1
    fi
fi

echo "📝 Current nginx config: $NGINX_CONF"
echo ""

# Backup current config
echo "💾 Backing up current config..."
sudo cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backup created"

# Check if client_max_body_size already exists
if grep -q "client_max_body_size" "$NGINX_CONF"; then
    echo "⚠️  client_max_body_size already exists, updating..."
    sudo sed -i 's/client_max_body_size.*/client_max_body_size 500m;/g' "$NGINX_CONF"
else
    echo "➕ Adding client_max_body_size to server block..."
    # Add after the server_name line
    sudo sed -i '/server_name.*54.91.53.228/a\    client_max_body_size 500m;\n    client_body_timeout 300s;' "$NGINX_CONF"
fi

# Check if location /api has client_max_body_size
if grep -A 10 "location /api" "$NGINX_CONF" | grep -q "client_max_body_size"; then
    echo "⚠️  client_max_body_size already exists in /api location, updating..."
    sudo sed -i '/location \/api/,/}/ s/client_max_body_size.*/        client_max_body_size 500m;/' "$NGINX_CONF"
else
    echo "➕ Adding client_max_body_size to /api location..."
    # Add before the closing brace of location /api
    sudo sed -i '/location \/api {/,/}/ { /proxy_read_timeout/a\        client_max_body_size 500m;\n        client_body_timeout 300s;\n        proxy_request_buffering off;' "$NGINX_CONF"
fi

echo ""
echo "🧪 Testing nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
    echo "🔄 Reloading nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "📋 Updated configuration:"
    echo "   - client_max_body_size: 500m"
    echo "   - client_body_timeout: 300s"
    echo "   - proxy_request_buffering: off (for /api)"
else
    echo "❌ Nginx configuration test failed!"
    echo "   Restoring backup..."
    sudo cp "${NGINX_CONF}.backup."* "$NGINX_CONF" 2>/dev/null || echo "   Manual restore may be needed"
    exit 1
fi

echo ""
echo "✅ Done! Nginx is now configured to accept uploads up to 500MB"

