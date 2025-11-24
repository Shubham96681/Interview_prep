# Backend Configuration Guide

## Issue: 401 Unauthorized Error

If you're getting a `401 (Unauthorized)` error when trying to login, here are the possible solutions:

### 1. Set Backend URL via Environment Variable

Create a `.env` file in the root directory with:

```env
VITE_API_URL=http://localhost:5000
```

For production, set it to your backend server URL:
```env
VITE_API_URL=https://your-backend-server.com
```

### 2. Check Backend Server Status

Make sure your backend server is running:
```bash
npm run start:backend
```

The backend should be running on port 5000 by default.

### 3. Verify Credentials

Make sure you're using valid credentials. Test users:
- Email: `john@example.com`, Password: `password123` (Candidate)
- Email: `jane@example.com`, Password: `password123` (Expert)

### 4. Check CORS Configuration

If the backend is on a different domain, make sure CORS is properly configured in the backend server.

### 5. Production Setup

If deploying to production:
1. Set `VITE_API_URL` environment variable to your backend URL
2. Or configure Nginx to proxy `/api/*` requests to your backend server
3. Rebuild the frontend: `npm run build`

