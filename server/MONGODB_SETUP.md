# MongoDB Setup Guide

## Prerequisites

1. MongoDB installed and running (local or cloud)
2. Node.js and npm installed
3. Prisma CLI installed (`npm install -g prisma` or use `npx`)

## Setup Steps

### 1. Install MongoDB (if not already installed)

**Local Installation:**
- Download from: https://www.mongodb.com/try/download/community
- Or use Docker: `docker run -d -p 27017:27017 --name mongodb mongo:latest`

**Cloud (MongoDB Atlas):**
- Sign up at: https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Get connection string

### 2. Update Environment Variables

Create or update `.env` file in the `server` directory:

```bash
# MongoDB Connection String
# Local MongoDB:
DATABASE_URL="mongodb://localhost:27017/interview_marketplace?retryWrites=true&w=majority"

# MongoDB Atlas (Cloud):
# DATABASE_URL="mongodb+srv://username:password@cluster.mongodb.net/interview_marketplace?retryWrites=true&w=majority"

# Connection Pool Settings (optional, can be in connection string)
# maxPoolSize=50&minPoolSize=5&maxIdleTimeMS=30000
```

### 3. Generate Prisma Client

```bash
cd server
npx prisma generate
```

### 4. Push Schema to MongoDB

```bash
npx prisma db push
```

This will create the collections in MongoDB based on your Prisma schema.

### 5. Seed Database (Optional)

```bash
npm run db:seed
```

## Connection String Format

### Local MongoDB
```
mongodb://localhost:27017/database_name?retryWrites=true&w=majority
```

### MongoDB Atlas (Cloud)
```
mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority
```

### With Connection Pooling
```
mongodb://localhost:27017/database_name?retryWrites=true&w=majority&maxPoolSize=50&minPoolSize=5&maxIdleTimeMS=30000
```

## Connection Pool Parameters

- `maxPoolSize`: Maximum number of connections (default: 100)
- `minPoolSize`: Minimum number of connections (default: 0)
- `maxIdleTimeMS`: Maximum time a connection can be idle (default: 0)

For 10,000+ concurrent users, recommended:
```
maxPoolSize=50&minPoolSize=10&maxIdleTimeMS=30000
```

## Differences from SQLite

1. **IDs**: MongoDB uses ObjectId instead of cuid()
2. **Collections**: MongoDB uses collections instead of tables
3. **No @@map**: MongoDB uses collection names directly
4. **Relations**: MongoDB supports relations but uses ObjectId references
5. **JSON Fields**: MongoDB natively supports JSON/BSON

## Migration from SQLite

If you have existing SQLite data:

1. Export data from SQLite
2. Transform IDs from cuid() to ObjectId format
3. Import into MongoDB
4. Update all references

**Note**: This is a complex migration. Consider using a migration script or starting fresh.

## Verification

Check if MongoDB is connected:

```bash
# Check connection
node -e "require('dotenv').config(); const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.$connect().then(() => console.log('✅ Connected to MongoDB')).catch(e => console.error('❌', e)).finally(() => prisma.$disconnect());"
```

## Troubleshooting

### Connection Refused
- Ensure MongoDB is running: `mongosh` or check service status
- Check firewall settings
- Verify connection string

### Authentication Failed
- Check username/password in connection string
- Verify database user permissions

### Schema Push Fails
- Ensure MongoDB is accessible
- Check Prisma schema syntax
- Try `npx prisma db push --force-reset` (⚠️ deletes all data)

## Production Recommendations

1. **Use MongoDB Atlas** for managed hosting
2. **Enable Replica Sets** for high availability
3. **Set up Indexes** for frequently queried fields
4. **Monitor Connection Pool** usage
5. **Enable SSL/TLS** for secure connections
6. **Set up Backups** regularly

## Performance Tuning

For high concurrency (10,000+ users):

1. **Connection Pooling**: Set appropriate pool sizes
2. **Indexes**: Create indexes on frequently queried fields
3. **Read Preferences**: Use read replicas for read-heavy operations
4. **Write Concerns**: Balance between performance and durability

Example indexes:
```javascript
// Create indexes via MongoDB shell or Prisma
db.users.createIndex({ email: 1 })
db.sessions.createIndex({ candidateId: 1, expertId: 1 })
db.sessions.createIndex({ scheduledDate: 1 })
```

