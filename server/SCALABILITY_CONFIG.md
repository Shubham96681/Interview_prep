# Scalability Configuration for 10,000+ Concurrent Users

## Current Optimizations

### 1. Rate Limiting
- **General API**: 1,000 requests per 15 minutes per IP (production)
- **Monitoring**: 300 requests per minute
- **SSE Connections**: Excluded from rate limiting
- **Note**: For multi-instance deployments, use Redis for distributed rate limiting

### 2. Database Connection Pooling
- **Prisma Client**: Configured with connection pooling
- **PostgreSQL**: Set `connection_limit` in DATABASE_URL
  ```
  DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=50&pool_timeout=20"
  ```
- **SQLite**: Not recommended for 10K+ users (use PostgreSQL)

### 3. Real-Time Connections (SSE)
- **Max Total Connections**: 10,000
- **Max Per User**: 10 connections (for multi-tab usage)
- **Heartbeat**: Every 30 seconds
- **Cleanup**: Stale connections cleaned every 5 minutes

### 4. Server Configuration
- **Max Connections**: 10,000 concurrent connections
- **Request Timeout**: 30 seconds
- **Compression**: Enabled (level 6, threshold 1KB)
- **Request Size Limit**: 10MB

### 5. Memory Management
- **Connection Cleanup**: Automatic cleanup of stale connections
- **Metrics Retention**: Last 100-1000 data points (auto-cleanup)
- **Error Log Retention**: Last 500 errors

## Recommended Production Setup

### 1. Load Balancer
- Use Nginx or AWS ALB with sticky sessions
- Distribute traffic across multiple Node.js instances
- Health checks every 10 seconds

### 2. Database
- **PostgreSQL** (not SQLite) with:
  - Connection pool: 50-100 connections
  - Read replicas for read-heavy operations
  - Connection pooling at database level (PgBouncer)

### 3. Caching Layer
- **Redis** for:
  - Session storage
  - Rate limiting (distributed)
  - Frequently accessed data
  - Real-time connection tracking (multi-instance)

### 4. Monitoring
- Monitor:
  - Connection count
  - Memory usage
  - CPU usage
  - Database connection pool
  - Response times
  - Error rates

### 5. Horizontal Scaling
- Run multiple Node.js instances (PM2 cluster mode or Kubernetes)
- Use Redis for shared state
- Use sticky sessions for SSE connections
- Database connection pooling across instances

## Environment Variables

```bash
# Database (PostgreSQL recommended)
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=50&pool_timeout=20"

# Node.js
NODE_ENV=production
PORT=5000

# For multi-instance deployments
REDIS_URL="redis://localhost:6379"  # Optional, for distributed rate limiting
```

## Performance Targets

- **Response Time**: < 200ms (p95)
- **Concurrent Users**: 10,000+
- **Requests/Second**: 1,000+
- **Database Connections**: 50-100 (pooled)
- **Memory per Instance**: 2-4GB
- **CPU**: 2-4 cores per instance

## Monitoring

Check these metrics regularly:
1. Active connections count
2. Memory usage (should stay < 80%)
3. CPU usage (should stay < 70%)
4. Database connection pool usage
5. Error rate (should be < 1%)
6. Response time percentiles (p50, p95, p99)

