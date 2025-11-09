# HTTPS Required for Video Calls

## Problem
Error: `Cannot read properties of undefined (reading 'getUserMedia')`

This happens because **modern browsers require HTTPS** to access camera and microphone in production environments.

## Why HTTPS is Required

- **Security**: Camera and microphone are sensitive devices
- **Browser Policy**: Browsers block `getUserMedia` on HTTP (except localhost)
- **WebRTC Requirement**: Video calls need secure connections

## Solutions

### Option 1: Use HTTPS (Recommended)

#### Using Let's Encrypt (Free SSL Certificate)

1. **Install Certbot:**
```bash
sudo yum install certbot python3-certbot-nginx -y
```

2. **Get SSL Certificate:**
```bash
sudo certbot --nginx -d 54.91.53.228
```

3. **Follow the prompts:**
   - Enter your email
   - Agree to terms
   - Choose to redirect HTTP to HTTPS

4. **Auto-renewal (already configured):**
```bash
sudo certbot renew --dry-run
```

#### Update Nginx for HTTPS

After getting the certificate, nginx will be automatically configured. You can verify:

```bash
sudo cat /etc/nginx/conf.d/interview-prep.conf
```

Should show:
- `listen 443 ssl;` for HTTPS
- `listen 80;` redirecting to HTTPS

### Option 2: Use AWS Application Load Balancer with SSL

1. Create an Application Load Balancer
2. Add SSL certificate (AWS Certificate Manager - free)
3. Point your domain to the load balancer
4. Configure security groups

### Option 3: Use Cloudflare (Free)

1. Add your domain to Cloudflare
2. Enable SSL/TLS (flexible or full)
3. Point DNS to your EC2 IP
4. Cloudflare will provide HTTPS

## Quick Test

After setting up HTTPS, access your site via:
- `https://54.91.53.228` (instead of `http://`)

The video calls should work!

## Current Status

- ✅ WebSocket connection: Working
- ✅ API endpoints: Working  
- ✅ Backend: Running
- ❌ Video calls: Need HTTPS

## Temporary Workaround

For development/testing, you can:
- Use `localhost` (works with HTTP)
- Use a VPN/tunnel service
- Use ngrok or similar: `ngrok http 80`

But for production, **HTTPS is required**.

