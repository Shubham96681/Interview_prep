# Nginx WebSocket Configuration Guide

This guide shows how to manually configure Nginx for WebSocket support (Socket.io).

## Step 1: Update Nginx Server Configuration

Edit the server configuration file:

```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

Replace the content with:

```nginx
server {
    listen 80;
    server_name 54.159.42.7;

    # Increase body size for file uploads
    client_max_body_size 10M;

    # Frontend static files
    location / {
        root /var/www/interview-prep/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Socket.io WebSocket connections
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Real-time updates (Server-Sent Events)
    location /api/realtime {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_read_timeout 86400;
    }
}
```

## Step 2: Add WebSocket Map to Main Nginx Config

Edit the main Nginx configuration:

```bash
sudo nano /etc/nginx/nginx.conf
```

Find the `http {` block and add this map directive right after it:

```nginx
http {
    # Add this map block for WebSocket upgrade
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    # ... rest of your nginx.conf content
}
```

## Step 3: Test and Reload Nginx

```bash
# Test the configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# Or restart if reload doesn't work
sudo systemctl restart nginx
```

## Step 4: Verify WebSocket Connection

After configuration, check the browser console. You should see:
- ✅ Connected to signaling server
- No more "WebSocket handshake: Unexpected response code: 200" errors

## Troubleshooting

If you get errors:

1. **Check Nginx error logs:**
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Verify the map block is in the right place:**
   ```bash
   sudo grep -A 3 "map \$http_upgrade" /etc/nginx/nginx.conf
   ```

3. **Check if Socket.io endpoint is accessible:**
   ```bash
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:5000/socket.io/
   ```

4. **Restart Nginx if needed:**
   ```bash
   sudo systemctl restart nginx
   ```

