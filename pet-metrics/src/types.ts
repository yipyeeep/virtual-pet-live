// =============================================================================
// TYPES DEFINITION FILE
// =============================================================================

// pet-metrics/src/types.ts
/**
 * Shared type definitions for the Pet Metrics Service
 * 
 * Contains all interfaces and types used across the metrics system.
 * These types can be imported by other services for consistency.
 */

// Core data entry types
export interface HappinessEntry {
    newValue: number;
    timestamp: number;
  }
  
  export interface ActivityEntry {
    activity: 'idle' | 'playing' | 'sleeping' | 'eating';
    timestamp: number;
  }
  
  export interface ResponseTimeEntry {
    responseTime: number;
    timestamp: number;
  }
  
  // Activity types
  export type ActivityType = 'idle' | 'playing' | 'sleeping' | 'eating';
  
  export interface ActivityDistribution {
    idle: number;
    playing: number;
    sleeping: number;
    eating: number;
  }
  
  // Command and user statistics
  export interface CommandStats {
    commandCounts: Record<string, number>;
    userCounts: Record<string, number>;
    totalCommands: number;
    totalUsers: number;
  }
  
  // System performance metrics
  export interface SystemMetrics {
    averageResponseTime: number;
    maxResponseTime: number;
    totalRequests: number;
    uptime: number;
  }
  
  // Happiness-related metrics
  export interface HappinessMetrics {
    current: number;
    average: number;
    trend: HappinessEntry[];
  }
  
  // Main summary response
  export interface MetricsSummary {
    happiness: HappinessMetrics;
    activity: ActivityDistribution;
    commands: CommandStats;
    system: SystemMetrics;
    timestamp: number;
  }
  
  // API query parameters
  export interface TimeRangeQuery {
    hours?: string;
  }
  
  // Health check response
  export interface HealthResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: number;
    uptime: number;
  }
  
  // Error response format
  export interface ErrorResponse {
    error: string;
    timestamp?: number;
    code?: string;
  }
  
  // Redis key patterns for type safety
  export const REDIS_KEYS = {
    HAPPINESS_HISTORY: 'pet:metrics:happiness_history',
    ACTIVITY_LOG: 'pet:metrics:activity_log',
    RESPONSE_TIMES: 'pet:metrics:response_times',
    COMMANDS: 'pet:metrics:commands',
    USERS: 'pet:metrics:users'
  } as const;
  
  // Configuration types
  export interface MetricsConfig {
    redisUrl: string;
    port: number;
    dataRetentionDays: number;
    cleanupIntervalHours: number;
  }
  
  // Utility types for API responses
  export type ApiResponse<T> = T | ErrorResponse;