# Deployment Status & Next Steps

## ✅ Completed
- ✅ All TypeScript errors fixed (30 errors resolved)
- ✅ Database service updated (removed incorrect profile relations)
- ✅ Build passing locally
- ✅ CI/CD workflow configured
- ✅ Changes pushed to GitHub

---

## 🔍 Check GitHub Actions

Your GitHub Actions workflow should have automatically triggered. Check the status:

1. Go to: https://github.com/Shubham96681/Interview_prep/actions
2. Click on the latest workflow run (should be "Fix TypeScript errors...")
3. Monitor the deployment progress

**If the workflow fails**, common issues:
- SSH key not properly configured → Re-check GitHub Secrets
- EC2 instance not accessible → Check security groups
- PM2 not installed → Run setup commands on EC2

---

## 🚀 Initial EC2 Setup (If Not Done Yet)

If you haven't set up your EC2 instance yet, SSH in and run:

```bash
# 1. SSH into EC2
ssh -i your-key-file.pem ec2-user@54.159.42.7

# 2. Run initial setup
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git nginx
sudo npm install -g pm2

# 3. Create project directory
sudo mkdir -p /var/www/interview-prep
sudo chown -R ec2-user:ec2-user /var/www/interview-prep
cd /var/www/interview-prep

# 4. Clone repository
git clone https://github.com/Shubham96681/Interview_prep.git .

# 5. Setup environment variables
cd server
cp env.example .env
nano .env
```

**Update `.env` file with:**
```env
PORT=5000
NODE_ENV=production
DATABASE_URL="file:./prod.db"
JWT_SECRET=change-this-to-a-random-32-char-string
FRONTEND_URL=http://54.159.42.7
```

Save with `Ctrl+X`, then `Y`, then `Enter`

```bash
# 6. Run initial deployment
cd /var/www/interview-prep
chmod +x deploy.sh
./deploy.sh

# 7. Setup Nginx
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

**Add this Nginx config:**
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
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 8. Start Nginx
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx

# 9. Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown
pm2 save
```

---

## 🔄 Automatic Deployments

Once initial setup is complete, every push to `main` branch will:
1. ✅ Build the frontend
2. ✅ SSH into EC2
3. ✅ Pull latest code
4. ✅ Install dependencies
5. ✅ Run database migrations
6. ✅ Restart PM2 processes

---

## 🌐 Access Your Application

- **Frontend:** http://54.159.42.7
- **Backend API:** http://54.159.42.7/api
- **Health Check:** http://54.159.42.7/api/health

---

## 🔧 Manual Deployment (If Needed)

If you need to manually deploy:

```bash
# SSH into EC2
ssh -i your-key-file.pem ec2-user@54.159.42.7

# Navigate to project
cd /var/www/interview-prep

# Pull and deploy
git pull origin main
./deploy.sh
```

---

## 🐛 Troubleshooting

### Check PM2 Status
```bash
pm2 status
pm2 logs interview-prep-backend
```

### Check Nginx Status
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Check Backend Logs
```bash
pm2 logs interview-prep-backend --lines 100
```

### Restart Services
```bash
pm2 restart interview-prep-backend
sudo systemctl restart nginx
```

---

## 📝 Notes

- The application uses SQLite for now (easy to switch to PostgreSQL later)
- PM2 keeps the backend running in the background
- Nginx serves the frontend static files and proxies API requests
- GitHub Actions automates future deployments

