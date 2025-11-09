# Fix WebSocket Connection for Socket.io

## Problem
The WebSocket connection is failing with error:
```
WebSocket connection to 'ws://54.159.42.7/socket.io/?EIO=4&transport=websocket' failed: 
Error during WebSocket handshake: Unexpected response code: 200
```

This happens because Nginx is not properly configured to proxy WebSocket connections for Socket.io.

## Solution

### Step 1: SSH into your EC2 instance
```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```

### Step 2: Update Nginx Configuration

Edit the Nginx configuration file:
```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

### Step 3: Replace the entire content with this configuration:

```nginx
# Map for WebSocket upgrade
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

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
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
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

**Important Notes:**
- The `map $http_upgrade $connection_upgrade` directive at the top is crucial for WebSocket support
- The `/socket.io/` location block specifically handles Socket.io connections
- The `Connection "upgrade"` header is required for WebSocket handshake

### Step 4: Test and Reload Nginx

```bash
# Test the configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# Or restart if reload doesn't work
sudo systemctl restart nginx
```

### Step 5: Verify the Fix

1. Open your browser and go to: `http://54.159.42.7`
2. Open the browser console (F12)
3. Try joining a meeting
4. Check the console - you should no longer see WebSocket connection errors
5. The Socket.io connection should now work properly

### Step 6: Check Nginx Logs (if issues persist)

```bash
# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check access logs
sudo tail -f /var/log/nginx/access.log
```

## Troubleshooting

### If nginx -t fails:
- Check for syntax errors in the config file
- Make sure all semicolons and braces are correct
- Verify the `map` directive is at the top level (not inside server block)

### If WebSocket still doesn't work:
1. Verify the backend is running:
   ```bash
   pm2 status
   curl http://localhost:5000/api/health
   ```

2. Check if Socket.io is initialized on the backend:
   ```bash
   pm2 logs interview-prep-backend | grep -i socket
   ```

3. Verify the backend is listening on port 5000:
   ```bash
   netstat -tlnp | grep 5000
   ```

### Alternative: If the map directive causes issues

If your Nginx version doesn't support the `map` directive in this location, you can use this simpler version:

```nginx
server {
    listen 80;
    server_name 54.159.42.7;

    client_max_body_size 10M;

    location / {
        root /var/www/interview-prep/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

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

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## After Fix

Once the Nginx configuration is updated, the WebSocket connections should work and you should be able to:
- ✅ Join video calls
- ✅ See video streams
- ✅ Use real-time features
- ✅ Connect to Socket.io without errors

