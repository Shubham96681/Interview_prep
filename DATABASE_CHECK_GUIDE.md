# Database Check Guide

This guide shows you how to check your SQLite database to find expert IDs and other information.

## Method 1: Using the Check Script (Recommended)

I've created a script that will automatically query and display all experts:

### On Local Machine:
```bash
cd server
npm run db:check-experts
```

### On Production Server (via SSH):
```bash
cd /path/to/your/server
npm run db:check-experts
```

This will show:
- All expert IDs (the actual database IDs)
- Expert names, emails, and details
- Profile URLs you can use
- Whether experts are active/verified

## Method 2: Using Prisma Studio (Visual Interface)

Prisma Studio provides a visual interface to browse your database:

### On Local Machine:
```bash
cd server
npx prisma studio
```

This will open a web interface at `http://localhost:5555` where you can:
- Browse all tables
- View and edit data
- See relationships between tables

### On Production Server:
You can use SSH port forwarding:
```bash
ssh -L 5555:localhost:5555 user@your-server-ip
# Then in another terminal on the server:
cd /path/to/your/server
npx prisma studio
# Access it at http://localhost:5555 on your local machine
```

## Method 3: Using SQLite Command Line

If you have direct access to the database file:

### On Local Machine:
```bash
cd server/prisma
sqlite3 dev.db
```

### On Production Server:
```bash
cd /path/to/your/server/prisma
sqlite3 dev.db
```

### Useful SQL Queries:

```sql
-- List all experts
SELECT id, email, name, title, company, isActive, createdAt 
FROM users 
WHERE userType = 'expert';

-- Find expert by email
SELECT id, email, name, title, company, isActive 
FROM users 
WHERE userType = 'expert' AND email = 'your-email@example.com';

-- Find expert by name
SELECT id, email, name, title, company, isActive 
FROM users 
WHERE userType = 'expert' AND name LIKE '%YourName%';

-- Count all experts
SELECT COUNT(*) as total_experts 
FROM users 
WHERE userType = 'expert';

-- Exit SQLite
.quit
```

## Method 4: Using Node.js Script Directly

You can also create a custom script:

```javascript
// check-db.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const experts = await prisma.user.findMany({
    where: { userType: 'expert' },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true
    }
  });
  
  console.log('Experts:', JSON.stringify(experts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run it:
```bash
node check-db.js
```

## Method 5: Check Server Logs

If you just registered an expert, check your server logs. The registration endpoint should log the created user ID.

Look for lines like:
```
✅ User registered successfully
User ID: clx1234567890abcdef
```

## Finding Your Expert ID

Once you find your expert ID, use it in the URL:
```
https://54.91.53.228/expert/{actual-database-id}
```

**Important:** 
- ✅ Use the actual database ID (usually starts with "cl" for Prisma CUIDs)
- ❌ Don't use frontend-generated IDs like `user-1763264118243`

## Troubleshooting

### Database file not found
- Check the `DATABASE_URL` in your `.env` file
- Default location: `server/prisma/dev.db`

### Permission errors
- Make sure you have read permissions on the database file
- On production, ensure the server user has access

### Connection errors
- Verify the database file exists
- Check that Prisma client is generated: `npx prisma generate`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run db:check-experts` | List all experts with IDs |
| `npx prisma studio` | Open visual database browser |
| `sqlite3 prisma/dev.db` | Open SQLite CLI |
| `npx prisma generate` | Regenerate Prisma client |

