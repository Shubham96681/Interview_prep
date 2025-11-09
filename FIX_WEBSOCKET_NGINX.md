# Fix WebSocket Connection in Nginx

## Problem
WebSocket connection failing: `Error during WebSocket handshake: Unexpected response code: 200`

This happens because nginx isn't configured to properly proxy WebSocket connections for Socket.io.

## Solution: Update Nginx Configuration

### Step 1: SSH into EC2

```bash
ssh -i your-key-file.pem ec2-user@54.91.53.228
```

### Step 2: Update Nginx Config

```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

### Step 3: Replace with This Configuration

```nginx
server {
    listen 80;
    server_name 54.91.53.228;

    # Frontend static files
    location / {
        root /var/www/interview-prep/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.io WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

### Step 4: Test and Restart Nginx

```bash
# Test configuration
sudo nginx -t

# If test passes, restart nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

### Step 5: Verify WebSocket Works

Refresh your browser and check the console. The WebSocket error should be gone.

## Key Changes

1. **Added `/socket.io/` location block** - Specifically handles Socket.io WebSocket connections
2. **Set `Connection "upgrade"`** - Required for WebSocket upgrade
3. **Disabled buffering** - `proxy_buffering off` and `proxy_cache off` for real-time connections
4. **Increased timeout** - `proxy_read_timeout 86400` for long-lived connections

## After Fixing

- WebSocket connections should work
- Real-time features should function
- Video call signaling should work

