// =============================================================================
// MAIN METRICS SERVICE FILE
// =============================================================================

// pet-metrics/src/metrics.ts
/**
 * Metrics Collection and Aggregation Service
 * 
 * Processes Redis data streams, calculates aggregated metrics,
 * provides HTTP API for dashboard consumption, and manages data retention.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import * as redis from 'redis';

// Import types
import { HappinessEntry, ActivityEntry, ResponseTimeEntry, ActivityDistribution, CommandStats, SystemMetrics, HappinessMetrics, MetricsSummary, TimeRangeQuery, HealthResponse, ErrorResponse, REDIS_KEYS, MetricsConfig } from './types.js';

// Import utilities
import { parseHappinessEntry, parseActivityEntry, parseResponseTimeEntry, parseIntSafe, convertHashToNumbers, calculateAverage, getMaxValue, filterByTimeRange, sortByTimestamp, createErrorResponse, logWithTimestamp, retryWithBackoff} from './utils.js';

// Configuration
const config: MetricsConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  port: parseIntSafe(process.env.PORT, 8090),
  dataRetentionDays: parseIntSafe(process.env.DATA_RETENTION_DAYS, 7),
  cleanupIntervalHours: parseIntSafe(process.env.CLEANUP_INTERVAL_HOURS, 1)
};

// Express app setup
const app = express();
app.use(cors());
app.use(express.json());

// Redis client for metrics data
const redisClient = redis.createClient({
  url: config.redisUrl
});

// Initialize Redis connection with retry
async function initializeRedis(): Promise<void> {
  try {
    await retryWithBackoff(async () => {
      await redisClient.connect();
    });
    logWithTimestamp('Metrics service connected to Redis', 'info');
  } catch (error) {
    logWithTimestamp(`Metrics Redis connection error: ${error}`, 'error');
    throw error;
  }
}

/**
 * Calculate happiness trends over time periods
 */
async function getHappinessTrends(hours: number = 24): Promise<HappinessEntry[]> {
  try {
    const history = await redisClient.lRange(REDIS_KEYS.HAPPINESS_HISTORY, 0, -1);
    
    const trends = history
      .map(parseHappinessEntry)
      .filter((item): item is HappinessEntry => item !== null);
    
    const filtered = filterByTimeRange(trends, hours);
    return sortByTimestamp(filtered);
  } catch (error) {
    logWithTimestamp(`Error getting happiness trends: ${error}`, 'error');
    return [];
  }
}

/**
 * Get activity distribution over time period
 */
async function getActivityDistribution(hours: number = 24): Promise<ActivityDistribution> {
  try {
    const activities = await redisClient.lRange(REDIS_KEYS.ACTIVITY_LOG, 0, -1);
    
    const distribution: ActivityDistribution = { idle: 0, playing: 0, sleeping: 0, eating: 0 };
    
    const parsedActivities = activities
      .map(parseActivityEntry)
      .filter((item): item is ActivityEntry => item !== null);
    
    const filtered = filterByTimeRange(parsedActivities, hours);
    
    filtered.forEach((item) => {
      distribution[item.activity] += 1;
    });
    
    return distribution;
  } catch (error) {
    logWithTimestamp(`Error getting activity distribution: ${error}`, 'error');
    return { idle: 0, playing: 0, sleeping: 0, eating: 0 };
  }
}

/**
 * Get command usage statistics
 */
async function getCommandStats(): Promise<CommandStats> {
  try {
    const [commands, users] = await Promise.all([
      redisClient.hGetAll(REDIS_KEYS.COMMANDS),
      redisClient.hGetAll(REDIS_KEYS.USERS)
    ]);
    
    const commandCounts = convertHashToNumbers(commands);
    const userCounts = convertHashToNumbers(users);
    
    const totalCommands = Object.values(commandCounts).reduce((a, b) => a + b, 0);
    const totalUsers = Object.keys(userCounts).length;
    
    return {
      commandCounts,
      userCounts,
      totalCommands,
      totalUsers
    };
  } catch (error) {
    logWithTimestamp(`Error getting command stats: ${error}`, 'error');
    return {
      commandCounts: {},
      userCounts: {},
      totalCommands: 0,
      totalUsers: 0
    };
  }
}

/**
 * Get system performance metrics
 */
async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    const responseTimes = await redisClient.lRange(REDIS_KEYS.RESPONSE_TIMES, 0, -1);
    
    const times = responseTimes
      .map(parseResponseTimeEntry)
      .filter((item): item is ResponseTimeEntry => item !== null)
      .map(entry => entry.responseTime)
      .filter(time => time > 0);
    
    const avgResponseTime = calculateAverage(times);
    const maxResponseTime = getMaxValue(times);
    
    return {
      averageResponseTime: Math.round(avgResponseTime),
      maxResponseTime,
      totalRequests: times.length,
      uptime: process.uptime()
    };
  } catch (error) {
    logWithTimestamp(`Error getting system metrics: ${error}`, 'error');
    return {
      averageResponseTime: 0,
      maxResponseTime: 0,
      totalRequests: 0,
      uptime: process.uptime()
    };
  }
}

// API Endpoints
app.get('/api/metrics/happiness-trends', async (req: Request<{}, HappinessEntry[] | ErrorResponse, {}, TimeRangeQuery>, res: Response) => {
  try {
    const hours = parseIntSafe(req.query.hours, 24);
    const trends = await getHappinessTrends(hours);
    res.json(trends);
  } catch (error) {
    logWithTimestamp(`Error in happiness-trends endpoint: ${error}`, 'error');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

app.get('/api/metrics/activity-distribution', async (req: Request<{}, ActivityDistribution | ErrorResponse, {}, TimeRangeQuery>, res: Response) => {
  try {
    const hours = parseIntSafe(req.query.hours, 24);
    const distribution = await getActivityDistribution(hours);
    res.json(distribution);
  } catch (error) {
    logWithTimestamp(`Error in activity-distribution endpoint: ${error}`, 'error');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

app.get('/api/metrics/commands', async (req: Request<{}, CommandStats | ErrorResponse>, res: Response) => {
  try {
    const stats = await getCommandStats();
    res.json(stats);
  } catch (error) {
    logWithTimestamp(`Error in commands endpoint: ${error}`, 'error');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

app.get('/api/metrics/system', async (req: Request<{}, SystemMetrics | ErrorResponse>, res: Response) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logWithTimestamp(`Error in system endpoint: ${error}`, 'error');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

app.get('/api/metrics/summary', async (req: Request<{}, MetricsSummary | ErrorResponse>, res: Response) => {
  try {
    const [trends, distribution, commands, system] = await Promise.all([
      getHappinessTrends(24),
      getActivityDistribution(24),
      getCommandStats(),
      getSystemMetrics()
    ]);
    
    const currentHappiness = trends.length > 0 ? trends[trends.length - 1].newValue : 50;
    const avgHappiness = trends.length > 0 ? calculateAverage(trends.map(t => t.newValue)) : 50;
    
    const summary: MetricsSummary = {
      happiness: {
        current: currentHappiness,
        average: Math.round(avgHappiness),
        trend: trends.slice(-10) // Last 10 changes
      },
      activity: distribution,
      commands: commands,
      system: system,
      timestamp: Date.now()
    };
    
    res.json(summary);
  } catch (error) {
    logWithTimestamp(`Error in summary endpoint: ${error}`, 'error');
    res.status(500).json(createErrorResponse('Internal server error'));
  }
});

// Health check endpoint
app.get('/health', (req: Request<{}, HealthResponse>, res: Response) => {
  const healthResponse: HealthResponse = {
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime()
  };
  res.json(healthResponse);
});

// Data cleanup job
async function runDataCleanup(): Promise<void> {
  try {
    logWithTimestamp('Running data cleanup job...', 'info');
    
    // Keep data trimmed to reasonable sizes
    await Promise.all([
      redisClient.lTrim(REDIS_KEYS.HAPPINESS_HISTORY, 0, 2000),
      redisClient.lTrim(REDIS_KEYS.ACTIVITY_LOG, 0, 2000),
      redisClient.lTrim(REDIS_KEYS.RESPONSE_TIMES, 0, 1000)
    ]);
    
    logWithTimestamp('Data cleanup completed', 'info');
  } catch (error) {
    logWithTimestamp(`Error in data cleanup: ${error}`, 'error');
  }
}

// Setup cleanup interval
const cleanupInterval = setInterval(
  runDataCleanup,
  config.cleanupIntervalHours * 60 * 60 * 1000
);

// Graceful shutdown
function gracefulShutdown(signal: string): void {
  logWithTimestamp(`Received ${signal}, shutting down gracefully...`, 'info');
  clearInterval(cleanupInterval);
  redisClient.quit();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeRedis();
    
    app.listen(config.port, () => {
      logWithTimestamp(`Metrics API server running on port ${config.port}`, 'info');
    });
    
    // Run initial cleanup
    await runDataCleanup();
    
  } catch (error) {
    logWithTimestamp(`Failed to start server: ${error}`, 'error');
    process.exit(1);
  }
}

startServer();