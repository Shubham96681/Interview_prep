# Check Users Script

This script allows you to query users directly from the database using Prisma.

## Usage

### List all users
```bash
npm run db:check-users
# or
node scripts/check-users.js all
```

### Find user by email
```bash
npm run db:check-users email user@example.com
# or
node scripts/check-users.js email user@example.com
```

### Find user by ID
```bash
npm run db:check-users id clx1234567890abcdef
# or
node scripts/check-users.js id clx1234567890abcdef
```

### Find users by type
```bash
npm run db:check-users type candidate
npm run db:check-users type expert
npm run db:check-users type admin
```

### Find only active users
```bash
npm run db:check-users active
```

### Show user count statistics
```bash
npm run db:check-users count
```

## Examples

```bash
# List all users
node scripts/check-users.js

# Find a specific user by email
node scripts/check-users.js email john@example.com

# Find all experts
node scripts/check-users.js type expert

# Show statistics
node scripts/check-users.js count
```

## Direct Database Access (SQLite)

If you want to query the SQLite database directly:

```bash
# Using sqlite3 command line tool
sqlite3 server/prisma/dev.db

# Then run SQL queries:
SELECT * FROM users;
SELECT * FROM users WHERE email = 'user@example.com';
SELECT * FROM users WHERE userType = 'expert';
```

## Using Prisma Studio (GUI)

For a visual interface to browse the database:

```bash
npx prisma studio
```

This will open a web interface at `http://localhost:5555` where you can browse and edit data.

