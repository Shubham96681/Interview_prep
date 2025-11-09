# Demo Login Credentials

## Available Users

### Admin User
- **Email**: `admin@interviewace.com`
- **Password**: `admin123` (or any password - accepts any password for demo)
- **Role**: Admin
- **Access**: Full admin dashboard with all management features

### Candidate Users
1. **John Doe**
   - **Email**: `john@example.com`
   - **Password**: `password123` (or any password - accepts any password for demo)
   - **Role**: Candidate

2. **Shubham Singh**
   - **Email**: `shubhamsingh6087@gmail.com`
   - **Password**: `password123` (or any password - accepts any password for demo)
   - **Role**: Candidate

### Expert User
- **Jane Smith**
  - **Email**: `jane@example.com`
  - **Password**: `password123` (or any password - accepts any password for demo)
  - **Role**: Expert
  - **Status**: Verified

## Notes

- **For demo purposes, the login accepts ANY password** - you just need to use the correct email address
- **Recommended passwords** (for consistency):
  - Admin: `admin123`
  - Candidates: `password123`
  - Expert: `password123`
- These users are automatically created when the database is first initialized
- If you get "Invalid credentials", it means:
  1. The user doesn't exist in the database (database might not be seeded)
  2. The email address is incorrect
  3. The backend server is not running or not accessible

## Troubleshooting

If login fails:
1. Check that the backend server is running
2. Verify the database has been seeded (check server logs for "Database seeding" messages)
3. Try accessing the health endpoint: `http://your-server/api/health`
4. Check browser console for error messages
5. Check backend logs for login attempts

## Database Seeding

The database is automatically seeded when:
- The database is empty (no users exist)
- The server starts for the first time
- You manually run the seed script

To manually seed the database on EC2:
```bash
cd /var/www/interview-prep/server
node -e "const db = require('./services/database'); db.seedDatabase().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });"
```

