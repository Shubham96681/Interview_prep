# Fix Duplicate Backend Processes

## Problem
You have TWO backend processes running:
- Process 0: Port 5000 ✅ (correct)
- Process 1: Port 5001 ❌ (duplicate, wrong port)

Nginx is configured to proxy to port 5000, so the duplicate on 5001 won't work.

## Quick Fix

### Step 1: Stop All Backend Processes

```bash
pm2 stop all
pm2 delete all
```

### Step 2: Start Only One Backend Process

```bash
cd /var/www/interview-prep/server
pm2 start npm --name "interview-prep-backend" -- start
pm2 save
```

### Step 3: Verify Only One Process is Running

```bash
pm2 status
```

You should see only ONE process with status "online".

### Step 4: Check It's Running on Port 5000

```bash
pm2 logs interview-prep-backend --lines 20
```

Look for: `✅ Server running on http://localhost:5000`

### Step 5: Test Backend

```bash
curl http://localhost:5000/api/health
```

Should return JSON response.

### Step 6: Test Through Nginx

```bash
curl http://54.91.53.228/api/health
```

Should also return JSON response.

## Why This Happened

When you ran `pm2 start` again, it created a second process. Since port 5000 was already in use, the new process started on port 5001. But nginx is configured to proxy to port 5000, so requests go to the wrong port.

## Prevention

Always check `pm2 status` before starting:
- If process exists: use `pm2 restart interview-prep-backend`
- If process doesn't exist: use `pm2 start`

