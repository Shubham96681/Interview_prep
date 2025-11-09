# Backend API Not Responding - Quick Fix

## Problem
Frontend loads but all API requests timeout. Error: `ERR_CONNECTION_TIMED_OUT`

## Quick Fix Steps

### Step 1: SSH into EC2 and Check Backend Status

```bash
ssh -i your-key-file.pem ec2-user@54.91.53.228

# Check if PM2 is running the backend
pm2 status

# Check backend logs
pm2 logs interview-prep-backend --lines 50
```

### Step 2: If Backend is Not Running, Start It

```bash
cd /var/www/interview-prep/server

# Check if .env file exists
ls -la .env

# If missing, create it
cp env.example .env
nano .env  # Set PORT=5000 and other values

# Start backend with PM2
pm2 start npm --name "interview-prep-backend" --cwd /var/www/interview-prep/server -- start

# Save PM2 config
pm2 save
```

### Step 3: Check Nginx Configuration

```bash
# Check if nginx config exists
sudo cat /etc/nginx/conf.d/interview-prep.conf

# If missing or wrong, create/update it:
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

**Nginx config should be:**
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
    }
}
```

### Step 4: Test and Restart Nginx

```bash
# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check nginx status
sudo systemctl status nginx
```

### Step 5: Verify Backend is Listening

```bash
# Check if port 5000 is listening
sudo netstat -tlnp | grep 5000
# or
sudo ss -tlnp | grep 5000

# Test backend directly
curl http://localhost:5000/api/health
```

### Step 6: Check Backend Logs for Errors

```bash
pm2 logs interview-prep-backend --lines 100
```

Look for:
- Port already in use errors
- Database connection errors
- Missing environment variables
- Module not found errors

## Common Issues

### Issue 1: Backend Not Started
**Fix:** Start with PM2 (see Step 2)

### Issue 2: Wrong Port
**Fix:** Check `server/.env` has `PORT=5000`

### Issue 3: Nginx Not Configured
**Fix:** Create nginx config (see Step 3)

### Issue 4: Database Issues
**Fix:**
```bash
cd /var/www/interview-prep/server
npx prisma generate
npx prisma db push
```

### Issue 5: Missing Dependencies
**Fix:**
```bash
cd /var/www/interview-prep/server
npm install
```

## Quick Test Commands

```bash
# Test backend health
curl http://localhost:5000/api/health

# Test through nginx
curl http://54.91.53.228/api/health

# Check PM2
pm2 status
pm2 logs

# Check nginx
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

## After Fixing

Once backend is running:
1. Test: `curl http://54.91.53.228/api/health`
2. Refresh your browser
3. Check browser console - errors should be gone

