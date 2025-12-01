# Deploying MongoDB Configuration to EC2

## Quick Setup Steps

### 1. SSH into your EC2 instance
```bash
ssh ec2-user@54.91.53.228
```

### 2. Navigate to server directory
```bash
cd /var/www/interview-prep/server
```

### 3. Pull latest changes
```bash
git pull origin main
```

### 4. Install MongoDB (if not installed)
```bash
# Check if MongoDB is installed
mongod --version

# If not installed, install MongoDB:
# For Amazon Linux 2:
sudo vi /etc/yum.repos.d/mongodb-org-7.0.repo
# Add:
# [mongodb-org-7.0]
# name=MongoDB Repository
# baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/7.0/x86_64/
# gpgcheck=1
# enabled=1
# gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc

# Then install:
sudo yum install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 5. Update .env file
```bash
# Edit .env file
nano .env

# Update DATABASE_URL to:
DATABASE_URL="mongodb://localhost:27017/interview_marketplace?retryWrites=true&w=majority&maxPoolSize=50&minPoolSize=10&maxIdleTimeMS=30000"
```

### 6. Install dependencies (if mongodb package was added)
```bash
npm install
```

### 7. Generate Prisma client for MongoDB
```bash
npx prisma generate
```

### 8. Push schema to MongoDB
```bash
npx prisma db push
```

### 9. Seed database (optional)
```bash
npm run db:seed
npm run db:create-admin
```

### 10. Restart server
```bash
pm2 restart interview-prep-backend
pm2 logs interview-prep-backend --lines 50
```

## Verify MongoDB is Running

```bash
# Check MongoDB status
sudo systemctl status mongod

# Connect to MongoDB
mongosh

# In MongoDB shell:
use interview_marketplace
show collections
db.users.countDocuments()
exit
```

## Troubleshooting

### If MongoDB is not installed:
```bash
# Install MongoDB Community Edition
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### If connection fails:
1. Check MongoDB is running: `sudo systemctl status mongod`
2. Check firewall: `sudo firewall-cmd --list-all`
3. Verify connection string in `.env`
4. Check MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`

### If Prisma errors occur:
1. Regenerate client: `npx prisma generate`
2. Check schema: `npx prisma validate`
3. Push schema again: `npx prisma db push --force-reset` (⚠️ deletes data)

## Quick One-Liner Setup

```bash
cd /var/www/interview-prep/server && \
git pull origin main && \
npm install && \
npx prisma generate && \
npx prisma db push && \
pm2 restart interview-prep-backend
```

