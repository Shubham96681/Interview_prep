/**
 * Monitoring Service
 * Collects and aggregates system metrics for admin dashboard
 */

const os = require('os');
const EventEmitter = require('events');

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    this.metrics = {
      // Load Testing
      maxConcurrentMeetings: 0,
      currentConcurrentMeetings: 0,
      videoPlaybackLoad: [],
      
      // App Monitoring
      apiLatency: [],
      apiErrorRate: 0,
      totalApiRequests: 0,
      failedApiRequests: 0,
      serverCpu: [],
      serverMemory: [],
      
      // Real-Time Comms
      websocketConnections: 0,
      websocketJitter: [],
      websocketPacketLoss: [],
      websocketBitrate: [],
      
      // Logging
      errors: [],
      userActivity: [],
      
      // Distributed Tracing
      serviceLatency: {},
      bottlenecks: [],
      
      // Video Playback
      bufferingTime: [],
      cdnCacheHitRatio: 0,
      cdnCacheHits: 0,
      cdnCacheMisses: 0
    };
    
    this.startTime = Date.now();
    this.requestTimings = [];
    this.errorLog = [];
    this.activityLog = [];
    
    // Start monitoring
    this.startMonitoring();
  }

  startMonitoring() {
    // Collect system metrics every 5 seconds
    setInterval(() => {
      this.collectSystemMetrics();
      // Emit monitoring update event for real-time updates
      this.emit('metrics_updated', this.getMetrics('1h'));
    }, 5000);
    
    // Clean old metrics every minute
    setInterval(() => {
      this.cleanOldMetrics();
    }, 60000);
  }

  collectSystemMetrics() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();
    
    // CPU percentage (approximate)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    // Memory in MB
    const memUsedMB = memUsage.heapUsed / 1024 / 1024;
    const memTotalMB = memUsage.heapTotal / 1024 / 1024;
    const memPercent = (memUsedMB / memTotalMB) * 100;
    
    // Keep last 100 data points (5 minutes at 5s intervals)
    this.metrics.serverCpu.push({
      timestamp: Date.now(),
      usage: cpuPercent,
      loadAvg: loadAvg[0] // 1-minute load average
    });
    if (this.metrics.serverCpu.length > 100) {
      this.metrics.serverCpu.shift();
    }
    
    this.metrics.serverMemory.push({
      timestamp: Date.now(),
      used: memUsedMB,
      total: memTotalMB,
      percent: memPercent
    });
    if (this.metrics.serverMemory.length > 100) {
      this.metrics.serverMemory.shift();
    }
  }

  // API Monitoring
  recordApiRequest(duration, success = true, endpoint = '') {
    this.metrics.totalApiRequests++;
    if (!success) {
      this.metrics.failedApiRequests++;
    }
    
    // Calculate error rate
    this.metrics.apiErrorRate = (this.metrics.failedApiRequests / this.metrics.totalApiRequests) * 100;
    
    // Record latency
    this.metrics.apiLatency.push({
      timestamp: Date.now(),
      duration,
      endpoint,
      success
    });
    
    // Keep last 1000 requests
    if (this.metrics.apiLatency.length > 1000) {
      this.metrics.apiLatency.shift();
    }
    
    // Track service latency for distributed tracing
    if (endpoint) {
      const service = endpoint.split('/')[2] || 'unknown';
      if (!this.metrics.serviceLatency[service]) {
        this.metrics.serviceLatency[service] = [];
      }
      this.metrics.serviceLatency[service].push({
        timestamp: Date.now(),
        duration,
        endpoint
      });
      
      // Keep last 100 per service
      if (this.metrics.serviceLatency[service].length > 100) {
        this.metrics.serviceLatency[service].shift();
      }
    }
  }

  // Meeting/Video Monitoring
  updateConcurrentMeetings(count) {
    this.metrics.currentConcurrentMeetings = count;
    if (count > this.metrics.maxConcurrentMeetings) {
      this.metrics.maxConcurrentMeetings = count;
    }
  }

  recordVideoPlayback(quality, bitrate, bufferingTime) {
    this.metrics.videoPlaybackLoad.push({
      timestamp: Date.now(),
      quality,
      bitrate,
      bufferingTime
    });
    
    if (bufferingTime) {
      this.metrics.bufferingTime.push({
        timestamp: Date.now(),
        duration: bufferingTime
      });
      if (this.metrics.bufferingTime.length > 100) {
        this.metrics.bufferingTime.shift();
      }
    }
    
    // Keep last 100 video playback records
    if (this.metrics.videoPlaybackLoad.length > 100) {
      this.metrics.videoPlaybackLoad.shift();
    }
  }

  // WebSocket/Real-Time Monitoring
  updateWebSocketConnections(count) {
    this.metrics.websocketConnections = count;
  }

  recordWebSocketMetrics(jitter, packetLoss, bitrate) {
    if (jitter !== undefined) {
      this.metrics.websocketJitter.push({
        timestamp: Date.now(),
        value: jitter
      });
      if (this.metrics.websocketJitter.length > 100) {
        this.metrics.websocketJitter.shift();
      }
    }
    
    if (packetLoss !== undefined) {
      this.metrics.websocketPacketLoss.push({
        timestamp: Date.now(),
        value: packetLoss
      });
      if (this.metrics.websocketPacketLoss.length > 100) {
        this.metrics.websocketPacketLoss.shift();
      }
    }
    
    if (bitrate !== undefined) {
      this.metrics.websocketBitrate.push({
        timestamp: Date.now(),
        value: bitrate
      });
      if (this.metrics.websocketBitrate.length > 100) {
        this.metrics.websocketBitrate.shift();
      }
    }
  }

  // Error Logging
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      context,
      type: error.name || 'Error'
    };
    
    this.metrics.errors.push(errorEntry);
    this.errorLog.push(errorEntry);
    
    // Keep last 500 errors
    if (this.metrics.errors.length > 500) {
      this.metrics.errors.shift();
    }
    if (this.errorLog.length > 1000) {
      this.errorLog.shift();
    }
    
    this.emit('error', errorEntry);
  }

  // User Activity Logging
  logUserActivity(userId, action, details = {}) {
    const activity = {
      timestamp: Date.now(),
      userId,
      action,
      details
    };
    
    this.metrics.userActivity.push(activity);
    this.activityLog.push(activity);
    
    // Keep last 1000 activities
    if (this.metrics.userActivity.length > 1000) {
      this.metrics.userActivity.shift();
    }
    if (this.activityLog.length > 5000) {
      this.activityLog.shift();
    }
  }

  // CDN Cache Monitoring
  recordCdnRequest(hit) {
    if (hit) {
      this.metrics.cdnCacheHits++;
    } else {
      this.metrics.cdnCacheMisses++;
    }
    
    const total = this.metrics.cdnCacheHits + this.metrics.cdnCacheMisses;
    if (total > 0) {
      this.metrics.cdnCacheHitRatio = (this.metrics.cdnCacheHits / total) * 100;
    }
  }

  // Distributed Tracing - Detect Bottlenecks
  detectBottlenecks() {
    const bottlenecks = [];
    
    // Check service latency
    Object.entries(this.metrics.serviceLatency).forEach(([service, latencies]) => {
      if (latencies.length > 0) {
        const avgLatency = latencies.reduce((sum, l) => sum + l.duration, 0) / latencies.length;
        const recentLatencies = latencies.slice(-10);
        const recentAvg = recentLatencies.reduce((sum, l) => sum + l.duration, 0) / recentLatencies.length;
        
        // If recent average is significantly higher, it's a bottleneck
        if (recentAvg > avgLatency * 1.5 && recentAvg > 500) {
          bottlenecks.push({
            service,
            avgLatency: Math.round(avgLatency),
            recentLatency: Math.round(recentAvg),
            severity: recentAvg > 1000 ? 'high' : 'medium'
          });
        }
      }
    });
    
    this.metrics.bottlenecks = bottlenecks;
    return bottlenecks;
  }

  // Get aggregated metrics
  getMetrics(timeRange = '1h') {
    const now = Date.now();
    let cutoffTime;
    
    switch (timeRange) {
      case '5m':
        cutoffTime = now - 5 * 60 * 1000;
        break;
      case '15m':
        cutoffTime = now - 15 * 60 * 1000;
        break;
      case '1h':
        cutoffTime = now - 60 * 60 * 1000;
        break;
      case '24h':
        cutoffTime = now - 24 * 60 * 60 * 1000;
        break;
      default:
        cutoffTime = now - 60 * 60 * 1000;
    }
    
    // Filter metrics by time range
    const recentApiLatency = this.metrics.apiLatency.filter(m => m.timestamp >= cutoffTime);
    const recentErrors = this.metrics.errors.filter(e => e.timestamp >= cutoffTime);
    const recentActivity = this.metrics.userActivity.filter(a => a.timestamp >= cutoffTime);
    
    // Calculate averages
    const avgApiLatency = recentApiLatency.length > 0
      ? recentApiLatency.reduce((sum, m) => sum + m.duration, 0) / recentApiLatency.length
      : 0;
    
    const avgBufferingTime = this.metrics.bufferingTime.length > 0
      ? this.metrics.bufferingTime.reduce((sum, b) => sum + b.duration, 0) / this.metrics.bufferingTime.length
      : 0;
    
    const avgJitter = this.metrics.websocketJitter.length > 0
      ? this.metrics.websocketJitter.reduce((sum, j) => sum + j.value, 0) / this.metrics.websocketJitter.length
      : 0;
    
    const avgPacketLoss = this.metrics.websocketPacketLoss.length > 0
      ? this.metrics.websocketPacketLoss.reduce((sum, p) => sum + p.value, 0) / this.metrics.websocketPacketLoss.length
      : 0;
    
    const avgBitrate = this.metrics.websocketBitrate.length > 0
      ? this.metrics.websocketBitrate.reduce((sum, b) => sum + b.value, 0) / this.metrics.websocketBitrate.length
      : 0;
    
    // Get current CPU and Memory
    const currentCpu = this.metrics.serverCpu.length > 0
      ? this.metrics.serverCpu[this.metrics.serverCpu.length - 1]
      : { usage: 0, loadAvg: 0 };
    
    const currentMemory = this.metrics.serverMemory.length > 0
      ? this.metrics.serverMemory[this.metrics.serverMemory.length - 1]
      : { used: 0, total: 0, percent: 0 };
    
    // Detect bottlenecks
    const bottlenecks = this.detectBottlenecks();
    
    return {
      // Load Testing
      loadTesting: {
        maxConcurrentMeetings: this.metrics.maxConcurrentMeetings,
        currentConcurrentMeetings: this.metrics.currentConcurrentMeetings,
        videoPlaybackLoad: this.metrics.videoPlaybackLoad.slice(-20) // Last 20
      },
      
      // App Monitoring
      appMonitoring: {
        apiLatency: {
          average: Math.round(avgApiLatency),
          p95: this.calculatePercentile(recentApiLatency.map(m => m.duration), 95),
          p99: this.calculatePercentile(recentApiLatency.map(m => m.duration), 99),
          recent: recentApiLatency.slice(-50).map(m => ({
            timestamp: m.timestamp,
            duration: m.duration,
            endpoint: m.endpoint
          }))
        },
        errorRate: Math.round(this.metrics.apiErrorRate * 100) / 100,
        totalRequests: this.metrics.totalApiRequests,
        failedRequests: this.metrics.failedApiRequests,
        serverCpu: {
          current: Math.round(currentCpu.usage * 100) / 100,
          loadAvg: Math.round(currentCpu.loadAvg * 100) / 100,
          history: this.metrics.serverCpu.slice(-20)
        },
        serverMemory: {
          current: {
            used: Math.round(currentMemory.used),
            total: Math.round(currentMemory.total),
            percent: Math.round(currentMemory.percent * 100) / 100
          },
          history: this.metrics.serverMemory.slice(-20)
        }
      },
      
      // Real-Time Comms
      realtimeComms: {
        websocketConnections: this.metrics.websocketConnections,
        jitter: {
          average: Math.round(avgJitter * 100) / 100,
          recent: this.metrics.websocketJitter.slice(-20)
        },
        packetLoss: {
          average: Math.round(avgPacketLoss * 100) / 100,
          recent: this.metrics.websocketPacketLoss.slice(-20)
        },
        bitrate: {
          average: Math.round(avgBitrate),
          recent: this.metrics.websocketBitrate.slice(-20)
        }
      },
      
      // Logging
      logging: {
        errors: recentErrors.slice(-50), // Last 50 errors
        totalErrors: this.metrics.errors.length,
        userActivity: recentActivity.slice(-100) // Last 100 activities
      },
      
      // Distributed Tracing
      distributedTracing: {
        serviceLatency: Object.entries(this.metrics.serviceLatency).map(([service, latencies]) => ({
          service,
          average: latencies.length > 0
            ? Math.round(latencies.reduce((sum, l) => sum + l.duration, 0) / latencies.length)
            : 0,
          count: latencies.length
        })),
        bottlenecks
      },
      
      // Video Playback
      videoPlayback: {
        bufferingTime: {
          average: Math.round(avgBufferingTime * 100) / 100,
          recent: this.metrics.bufferingTime.slice(-20)
        },
        cdnCacheHitRatio: Math.round(this.metrics.cdnCacheHitRatio * 100) / 100,
        cdnCacheHits: this.metrics.cdnCacheHits,
        cdnCacheMisses: this.metrics.cdnCacheMisses
      },
      
      // System Info
      systemInfo: {
        uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        totalMemory: Math.round(os.totalmem() / 1024 / 1024) // MB
      }
    };
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  cleanOldMetrics() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    // Clean old API latency (keep last hour)
    this.metrics.apiLatency = this.metrics.apiLatency.filter(m => m.timestamp >= oneHourAgo);
    
    // Clean old errors (keep last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.metrics.errors = this.metrics.errors.filter(e => e.timestamp >= oneDayAgo);
  }

  // Get error logs for debugging
  getErrorLogs(limit = 100) {
    return this.errorLog.slice(-limit).reverse();
  }

  // Get user activity logs
  getActivityLogs(limit = 100) {
    return this.activityLog.slice(-limit).reverse();
  }
}

module.exports = new MonitoringService();

