# Next Steps for EC2 Deployment

You've added the GitHub secret. Now follow these steps on your EC2 instance.

## Step 1: SSH into Your EC2 Instance

On your local machine, run:
```bash
ssh -i your-key-file.pem ec2-user@54.159.42.7
```
Replace `your-key-file.pem` with your actual key file name.

---

## Step 2: Run Initial Setup on EC2

Once you're SSH'd into EC2, run these commands:

### 2.1 Update and Install Software
```bash
# Update system
sudo yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Git
sudo yum install -y git

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo yum install -y nginx

# Verify installations
node --version
npm --version
git --version
nginx -v
pm2 --version
```

### 2.2 Create Project Directory
```bash
sudo mkdir -p /var/www/interview-prep
sudo chown -R ec2-user:ec2-user /var/www/interview-prep
cd /var/www/interview-prep
```

### 2.3 Clone Repository
```bash
git clone https://github.com/Shubham96681/Interview_prep.git .
```

---

## Step 3: Configure Environment Variables

### 3.1 Create Backend .env File
```bash
cd server
cp env.example .env
nano .env
```

### 3.2 Update .env with These Values:
```env
PORT=5000
NODE_ENV=production

# Database (SQLite for now - can switch to PostgreSQL later)
DATABASE_URL="file:./prod.db"

# JWT Secret - CHANGE THIS TO A RANDOM STRING!
JWT_SECRET=your-super-secret-production-jwt-key-change-this-to-random-string-min-32-chars

# Frontend URL (for CORS)
FRONTEND_URL=http://54.159.42.7

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 4: Install Dependencies and Build

### 4.1 Install Dependencies
```bash
cd /var/www/interview-prep

# Install frontend dependencies
npm install --production

# Install backend dependencies
cd server
npm install --production
cd ..
```

### 4.2 Build Frontend
```bash
npm run build
```

### 4.3 Setup Database
```bash
cd server
npx prisma migrate deploy
npx prisma generate
cd ..
```

---

## Step 5: Configure Nginx

### 5.1 Create Nginx Config
```bash
sudo nano /etc/nginx/conf.d/interview-prep.conf
```

### 5.2 Add This Configuration:
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

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

### 5.3 Test and Start Nginx
```bash
# Test nginx configuration
sudo nginx -t

# Start nginx
sudo systemctl start nginx

# Enable nginx to start on boot
sudo systemctl enable nginx
```

---

## Step 6: Start Application with PM2

### 6.1 Start Backend Server
```bash
cd /var/www/interview-prep
pm2 start npm --name "interview-prep-backend" --cwd server -- start
```

### 6.2 Save PM2 Configuration
```bash
pm2 save
pm2 startup
# Copy and run the command it gives you
```

### 6.3 Check Status
```bash
pm2 status
pm2 logs interview-prep-backend
```

---

## Step 7: Configure AWS Security Group

### 7.1 In AWS Console:
1. Go to **EC2** → **Instances**
2. Select your instance: `i-0fad22450e70f3261`
3. Click **Security** tab → Click security group link
4. Click **Edit inbound rules**
5. Add these rules:

| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| HTTP | TCP | 80 | 0.0.0.0/0 | Web access |
| SSH | TCP | 22 | Your IP | SSH access |

6. Click **Save rules**

---

## Step 8: Test Your Application

### 8.1 Test Backend Health
```bash
curl http://localhost:5000/api/health
```

### 8.2 Test from Browser
Open: http://54.159.42.7

You should see your application!

---

## Step 9: Test CI/CD Pipeline

### 9.1 Make a Small Change
On your local machine:
```bash
echo "# Deployment test - $(date)" >> TEST.md
git add .
git commit -m "Test CI/CD deployment"
git push origin main
```

### 9.2 Monitor Deployment
1. Go to: https://github.com/Shubham96681/Interview_prep/actions
2. Watch the deployment workflow run
3. Check your app: http://54.159.42.7

---

## Troubleshooting

If something doesn't work:

```bash
# Check PM2 logs
pm2 logs interview-prep-backend

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(80|5000)'

# Restart services
pm2 restart all
sudo systemctl restart nginx

# Manual deployment test
cd /var/www/interview-prep
./deploy.sh
```

---

**Once you complete these steps, your app will be live!** 🚀

