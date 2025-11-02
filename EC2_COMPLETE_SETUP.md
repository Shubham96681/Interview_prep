# Complete EC2 Setup Guide

You've run the initial setup. Now complete these final steps:

## Step 1: Fix Build Dependencies

Since the frontend build needs TypeScript, install all dependencies (including dev):

```bash
cd /var/www/interview-prep
npm install
```

This will install TypeScript and other build tools.

## Step 2: Build Frontend Again

```bash
npm run build
```

This should now work.

## Step 3: Configure Environment Variables

```bash
cd /var/www/interview-prep/server
nano .env
```

Update these important values:
```env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./prod.db"
JWT_SECRET=change-this-to-a-random-32-plus-character-string-for-production
FRONTEND_URL=http://54.159.42.7
```

**IMPORTANT:** Change `JWT_SECRET` to a random secure string!

Save: `Ctrl+X`, then `Y`, then `Enter`

## Step 4: Rebuild Database (with production database name)

```bash
cd /var/www/interview-prep/server
# Update DATABASE_URL in .env first (should be prod.db)
npx prisma generate
npx prisma db push --skip-generate
```

## Step 5: Configure Nginx

```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name 54.159.42.7;

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

Save: `Ctrl+X`, then `Y`, then `Enter`

Test and start Nginx:
```bash
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 6: Start Backend with PM2

```bash
cd /var/www/interview-prep
pm2 start npm --name "interview-prep-backend" --cwd server -- start
pm2 save
pm2 startup
# Follow the instructions shown (run the command it outputs)
```

## Step 7: Verify Everything is Running

```bash
# Check PM2
pm2 status
pm2 logs interview-prep-backend

# Check Nginx
sudo systemctl status nginx

# Test backend
curl http://localhost:5000/api/health

# Test frontend (from your browser)
# http://54.159.42.7
```

## Step 8: Security Group (AWS Console)

Make sure your EC2 security group allows:
- **Inbound HTTP (port 80)** from anywhere (0.0.0.0/0)
- **Inbound SSH (port 22)** from your IP only

## Troubleshooting

### If PM2 shows error:
```bash
pm2 logs interview-prep-backend --lines 50
```

### If Nginx doesn't serve files:
```bash
sudo tail -f /var/log/nginx/error.log
```

### If build still fails:
```bash
cd /var/www/interview-prep
rm -rf node_modules
npm install
npm run build
```

### To restart everything:
```bash
pm2 restart interview-prep-backend
sudo systemctl restart nginx
```

## Future Deployments

After this initial setup, GitHub Actions will automatically deploy on every push to `main` branch!

