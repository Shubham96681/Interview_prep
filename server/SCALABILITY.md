# Scalability Guide - Handling 10,000+ Concurrent Users

This document outlines the optimizations and configurations needed to handle high traffic loads.

## Key Optimizations Implemented

### 1. **Database Connection Pooling**
- Prisma client configured with proper connection pooling
- For PostgreSQL: Configure connection pool in `DATABASE_URL`
  ```
  DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20"
  ```
- For SQLite: Consider migrating to PostgreSQL for production

### 2. **Process Clustering**
Two options available:

#### Option A: Node.js Cluster Module
```bash
npm run start:cluster
```
- Automatically uses all CPU cores
- Workers restart on crash
- Built-in load balancing

#### Option B: PM2 (Recommended for Production)
```bash
npm install -g pm2
npm run start:pm2
```
- Better process management
- Auto-restart on crashes
- Memory limit monitoring
- Log management
- Zero-downtime deployments

### 3. **Rate Limiting**
- General API: 200 requests per 15 minutes per IP (production)
- Email check: 20 requests per minute per IP
- Adjustable based on your needs

### 4. **Memory Management**
- Memory monitoring every minute
- Automatic garbage collection (with --expose-gc flag)
- Connection limits per user (5 max)
- Total connection limit (10,000)

### 5. **Error Handling**
- Global error handlers prevent crashes
- Uncaught exception handling
- Unhandled promise rejection handling
- Graceful shutdown on SIGTERM/SIGINT

### 6. **Server Configuration**
- Max connections: 10,000
- Keep-alive timeout: 65 seconds
- Request timeout: 30 seconds
- Request size limit: 10MB

## Production Deployment Checklist

### Database
- [ ] Migrate from SQLite to PostgreSQL
- [ ] Configure connection pooling (20-50 connections)
- [ ] Set up database replication for read scaling
- [ ] Enable query logging for slow queries

### Server
- [ ] Use PM2 or similar process manager
- [ ] Set up reverse proxy (Nginx) for load balancing
- [ ] Configure SSL/TLS certificates
- [ ] Set up monitoring (PM2 Plus, New Relic, etc.)

### Infrastructure
- [ ] Use load balancer (AWS ELB, Nginx, etc.)
- [ ] Deploy multiple server instances
- [ ] Set up Redis for distributed rate limiting
- [ ] Configure CDN for static assets
- [ ] Set up auto-scaling based on load

### Monitoring
- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Monitor CPU, memory, and disk usage
- [ ] Set up alerts for high error rates
- [ ] Monitor database connection pool usage
- [ ] Track response times and throughput

## Performance Testing

### Load Testing Tools
```bash
# Install Apache Bench
ab -n 10000 -c 100 http://localhost:5000/api/health

# Install Artillery
npm install -g artillery
artillery quick --count 1000 --num 10 http://localhost:5000/api/health
```

### Expected Performance
- **Response Time**: < 200ms for most endpoints
- **Throughput**: 1000+ requests/second
- **Concurrent Connections**: 10,000+
- **Memory Usage**: < 1GB per process
- **CPU Usage**: < 80% per core

## Database Migration to PostgreSQL

For production with 10,000+ users, PostgreSQL is strongly recommended:

1. **Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql
```

2. **Create Database**
```sql
CREATE DATABASE interview_marketplace;
CREATE USER interview_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE interview_marketplace TO interview_user;
```

3. **Update .env**
```env
DATABASE_URL="postgresql://interview_user:secure_password@localhost:5432/interview_marketplace?connection_limit=20&pool_timeout=20"
```

4. **Run Migration**
```bash
npm run migrate:postgresql
```

## Redis for Distributed Rate Limiting

For multiple server instances, use Redis:

```bash
npm install redis
npm install connect-redis
```

Update rate limiting to use Redis store instead of memory store.

## Monitoring Commands

```bash
# PM2 Monitoring
pm2 monit
pm2 logs
pm2 status

# System Resources
htop
iostat -x 1
netstat -an | grep :5000 | wc -l  # Connection count
```

## Troubleshooting

### High Memory Usage
- Check for memory leaks in realtime service
- Reduce connection timeout
- Enable garbage collection: `node --expose-gc index.js`

### Database Connection Errors
- Increase connection pool size
- Check database max_connections setting
- Monitor active connections

### Slow Response Times
- Enable database query logging
- Check for N+1 query problems
- Add database indexes
- Use connection pooling

### Server Crashes
- Check error logs: `pm2 logs`
- Review uncaught exceptions
- Monitor memory usage
- Check for infinite loops

## Recommended Server Specifications

For 10,000 concurrent users:

- **CPU**: 4-8 cores
- **RAM**: 8-16 GB
- **Database**: Separate server with 4+ cores, 8+ GB RAM
- **Network**: 1 Gbps
- **Storage**: SSD with 100+ GB

## Load Balancer Configuration (Nginx)

```nginx
upstream backend {
    least_conn;
    server localhost:5000;
    server localhost:5001;
    server localhost:5002;
    server localhost:5003;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
```

