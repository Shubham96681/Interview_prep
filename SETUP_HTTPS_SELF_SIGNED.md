# Setup HTTPS with Self-Signed Certificate

## Step 1: Create SSL Directory

```bash
sudo mkdir -p /etc/nginx/ssl
```

## Step 2: Generate Self-Signed Certificate

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/nginx-selfsigned.key \
  -out /etc/nginx/ssl/nginx-selfsigned.crt \
  -subj "/CN=54.91.53.228"
```

## Step 3: Update Nginx Configuration

The deploy script will automatically configure nginx with HTTPS support. After deployment, nginx will:
- Listen on port 443 (HTTPS)
- Redirect HTTP (port 80) to HTTPS
- Use the self-signed certificate

## Step 4: Update Security Group

Make sure your EC2 security group allows:
- Port 443 (HTTPS) from 0.0.0.0/0

## Step 5: Access via HTTPS

After setup, access your site via:
- `https://54.91.53.228`

**Note:** Browsers will show a security warning for self-signed certificates. Click "Advanced" → "Proceed to 54.91.53.228" to continue.

## For Production (Recommended)

For production, use a real domain name with Let's Encrypt:
1. Get a domain name
2. Point DNS to your EC2 IP
3. Run: `sudo certbot --nginx -d yourdomain.com`

