# AWS EC2 Deployment Guide for InterviewAce

Complete step-by-step guide to deploy your InterviewAce application to AWS EC2.

**Instance Details:**
- Instance ID: `i-0fad22450e70f3261`
- Public IP: `54.159.42.7`
- Private IP: `172.31.16.53`
- GitHub Repo: `https://github.com/Shubham96681/Interview_prep`

---

## Step 1: Prepare Your EC2 Instance

### 1.1 SSH into your EC2 instance
```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```
Replace `your-key-file.pem` with your actual key file name.

### 1.2 Update and install necessary software
```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo yum install -y nginx
```

### 1.3 Verify installations
```bash
node --version  # Should show v18.x.x
npm --version
git --version
nginx -v
pm2 --version
```

---

## Step 2: Set Up Your Project on EC2

### 2.1 Create project directory
```bash
# Create directory
sudo mkdir -p /var/www/interview-prep

# Change ownership to ec2-user
sudo chown -R ec2-user:ec2-user /var/www/interview-prep

# Navigate to directory
cd /var/www/interview-prep
```

### 2.2 Clone your GitHub repository
```bash
git clone https://github.com/Shubham96681/Interview_prep.git .
```

### 2.3 Install project dependencies
```bash
# Install frontend dependencies
npm install --production

# Install backend dependencies
cd server
npm install --production
cd ..
```

---

## Step 3: Configure Environment Variables

### 3.1 Create backend .env file
```bash
cd server
cp env.example .env
nano .env
```

### 3.2 Update .env with production values:
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database - Use PostgreSQL for production (AWS RDS)
# Or keep SQLite for now (not recommended for production)
DATABASE_URL="file:./prod.db"

# JWT Configuration - CHANGE THIS!
JWT_SECRET=your-super-secret-production-jwt-key-min-32-chars

# Frontend URL (for CORS)
FRONTEND_URL=http://54.159.42.7

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 4: Set Up Database

### 4.1 Option A: Using SQLite (Quick Start)
```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

### 4.2 Option B: Using PostgreSQL (Recommended for Production)
1. Create AWS RDS PostgreSQL instance
2. Update `server/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Update `server/.env`:
   ```env
   DATABASE_URL="postgresql://username:password@your-rds-endpoint:5432/interview_marketplace"
   ```
4. Run migrations:
   ```bash
   cd server
   npx prisma migrate deploy
   npx prisma generate
   ```

---

## Step 5: Deploy Script Setup

### 5.1 The deploy.sh script is already in your repo
Make sure it's executable:
```bash
cd /var/www/interview-prep
chmod +x deploy.sh
```

---

## Step 6: Set Up Nginx

### 6.1 Create nginx configuration
```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

### 6.2 Add this configuration:
```nginx
# Backend API Server
server {
    listen 80;
    server_name 54.159.42.7;

    # Frontend static files (served from dist/)
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

### 6.3 Test and start nginx
```bash
# Test nginx configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

---

## Step 7: Start Your Application with PM2

### 7.1 Build frontend first
```bash
cd /var/www/interview-prep
npm run build
```

### 7.2 Start backend server only
```bash
pm2 start npm --name "interview-prep-backend" --cwd server -- start
```

**Note:** Frontend is served by nginx as static files from `dist/` directory. No need to run a separate frontend Node.js process.

### 7.4 Save PM2 configuration
```bash
pm2 save
pm2 startup
# Follow the instructions it gives you to enable startup
```

### 7.5 Check status
```bash
pm2 status
pm2 logs
```

---

## Step 8: Set Up GitHub Actions (CI/CD)

### 8.1 The workflow file is already in your repo
`.github/workflows/deploy.yml` is ready to use.

### 8.2 Add GitHub Secret for SSH Key

1. **Get your EC2 private key content** (on your local machine):
   ```bash
   cat your-key-file.pem
   ```
   Copy the entire content including:
   ```
   -----BEGIN RSA PRIVATE KEY-----
   [your entire key content]
   -----END RSA PRIVATE KEY-----
   ```

2. **Add secret to GitHub:**
   - Go to: https://github.com/Shubham96681/Interview_prep
   - Click **Settings** tab
   - Click **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Enter:
     - **Name:** `EC2_SSH_KEY`
     - **Value:** Paste your entire private key content
   - Click **Add secret**

---

## Step 9: Configure AWS Security Groups

### 9.1 In AWS Console:
1. Go to **EC2** → **Security Groups**
2. Find your instance's security group
3. Edit **Inbound rules**:

   | Type | Protocol | Port | Source | Description |
   |------|----------|------|--------|-------------|
   | HTTP | TCP | 80 | 0.0.0.0/0 | Web access |
   | HTTPS | TCP | 443 | 0.0.0.0/0 | HTTPS (optional) |
   | SSH | TCP | 22 | Your IP | SSH access |
   | Custom TCP | TCP | 5000 | 127.0.0.1 | Backend (local only) |

---

## Step 10: Test Your Application

### 10.1 Test locally on EC2
```bash
# Check backend health
curl http://localhost:5000/api/health

# Check if files are built
ls -la /var/www/interview-prep/dist
```

### 10.2 Test from browser
Open your web browser and go to:
```
http://54.159.42.7
```

You should see:
- Frontend application loading
- API endpoints accessible at `/api/health`

---

## Step 11: Test CI/CD Pipeline

### 11.1 Make a small change
```bash
# On your local machine
cd your-local-interview-prep-folder
echo "# Deployment test" >> TEST.md
git add .
git commit -m "Test CI/CD deployment"
git push origin main
```

### 11.2 Monitor deployment
1. Go to: https://github.com/Shubham96681/Interview_prep
2. Click **Actions** tab
3. Watch the "Deploy InterviewAce to EC2" workflow run
4. Check logs for any errors

### 11.3 Verify deployment
- Check application: http://54.159.42.7
- Check backend health: http://54.159.42.7/api/health

---

## Step 12: Troubleshooting

### 12.1 Check application status
```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@54.159.42.7

# Check PM2 status
pm2 status
pm2 logs interview-prep-backend
pm2 logs interview-prep-frontend

# Check nginx status
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(80|5000|5173)'
```

### 12.2 Common Issues

**Issue: Port already in use**
```bash
# Find process using port 5000
sudo lsof -i :5000
# Kill the process
sudo kill -9 <PID>
```

**Issue: Nginx not serving files**
```bash
# Check nginx config
sudo nginx -t
# Reload nginx
sudo systemctl reload nginx
# Check file permissions
sudo chown -R ec2-user:ec2-user /var/www/interview-prep/dist
```

**Issue: Database connection failed**
```bash
# Check database file exists
ls -la server/prisma/
# Run migrations again
cd server
npx prisma migrate deploy
```

---

## Step 13: Manual Deployment (If Needed)

If you need to deploy manually without GitHub Actions:

```bash
cd /var/www/interview-prep
./deploy.sh
```

Or step by step:
```bash
cd /var/www/interview-prep
git pull origin main
npm install --production
cd server && npm install --production && cd ..
npm run build
cd server && npx prisma migrate deploy && cd ..
pm2 restart all
```

---

## Project Structure on EC2

```
/var/www/interview-prep/
├── dist/                    # Built frontend (served by nginx)
├── server/                  # Backend application
│   ├── prisma/
│   │   └── prod.db         # Production database
│   ├── .env                # Backend environment variables
│   └── node_modules/
├── node_modules/           # Frontend dependencies
├── deploy.sh               # Deployment script
└── .github/
    └── workflows/
        └── deploy.yml      # GitHub Actions workflow
```

---

## Important Notes

1. **Database**: For production, migrate to PostgreSQL (AWS RDS)
2. **SSL/HTTPS**: Set up Let's Encrypt for HTTPS
3. **Environment Variables**: Never commit `.env` files
4. **Backups**: Set up regular database backups
5. **Monitoring**: Consider AWS CloudWatch for monitoring
6. **File Storage**: Use S3 for user uploads instead of local storage

---

## Quick Reference Commands

```bash
# View application logs
pm2 logs

# Restart services
pm2 restart all

# Check nginx status
sudo systemctl status nginx

# Check backend health
curl http://localhost:5000/api/health

# Manual deployment
cd /var/www/interview-prep && ./deploy.sh
```

---

**Your application is now deployed!** 🚀

Access it at: http://54.159.42.7

