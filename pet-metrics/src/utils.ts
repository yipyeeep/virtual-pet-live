// =============================================================================
// UTILITY FUNCTIONS FILE
// =============================================================================

// pet-metrics/src/utils.ts
/**
 * Utility functions for the Pet Metrics Service
 * 
 * Contains helper functions for data parsing, validation, 
 * time calculations, and error handling.
 */

import { ActivityEntry, HappinessEntry, ResponseTimeEntry, ActivityType } from './types';

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn('Failed to parse JSON:', jsonString, error);
    return null;
  }
}

/**
 * Parse and validate happiness entry from Redis
 */
export function parseHappinessEntry(data: string): HappinessEntry | null {
  const parsed = safeJsonParse<HappinessEntry>(data);
  if (!parsed || typeof parsed.newValue !== 'number' || typeof parsed.timestamp !== 'number') {
    return null;
  }
  return parsed;
}

/**
 * Parse and validate activity entry from Redis
 */
export function parseActivityEntry(data: string): ActivityEntry | null {
  const parsed = safeJsonParse<ActivityEntry>(data);
  if (!parsed || !isValidActivity(parsed.activity) || typeof parsed.timestamp !== 'number') {
    return null;
  }
  return parsed;
}

/**
 * Parse and validate response time entry from Redis
 */
export function parseResponseTimeEntry(data: string): ResponseTimeEntry | null {
  const parsed = safeJsonParse<ResponseTimeEntry>(data);
  if (!parsed || typeof parsed.responseTime !== 'number' || typeof parsed.timestamp !== 'number') {
    return null;
  }
  return parsed;
}

/**
 * Check if activity is valid
 */
export function isValidActivity(activity: string): activity is ActivityType {
  return ['idle', 'playing', 'sleeping', 'eating'].includes(activity);
}

/**
 * Calculate time cutoff for filtering data
 */
export function getTimeCutoff(hours: number): number {
  return Date.now() - (hours * 60 * 60 * 1000);
}

/**
 * Parse integer safely with fallback
 */
export function parseIntSafe(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Convert string hash values to numbers
 */
export function convertHashToNumbers(hash: Record<string, string>): Record<string, number> {
  const result: Record<string, number> = {};
  Object.entries(hash).forEach(([key, value]) => {
    result[key] = parseInt(value, 10) || 0;
  });
  return result;
}

/**
 * Calculate average of number array
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
}

/**
 * Get maximum value from number array
 */
export function getMaxValue(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return Math.max(...numbers);
}

/**
 * Filter data by time range
 */
export function filterByTimeRange<T extends { timestamp: number }>(
  data: T[], 
  hours: number
): T[] {
  const cutoff = getTimeCutoff(hours);
  return data.filter(item => item.timestamp > cutoff);
}

/**
 * Sort data by timestamp
 */
export function sortByTimestamp<T extends { timestamp: number }>(
  data: T[], 
  ascending: boolean = true
): T[] {
  return data.sort((a, b) => 
    ascending ? a.timestamp - b.timestamp : b.timestamp - a.timestamp
  );
}

/**
 * Format uptime seconds to human readable string
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Validate if timestamp is reasonable (not too old or in future)
 */
export function isValidTimestamp(timestamp: number): boolean {
  const now = Date.now();
  const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
  const oneHourFromNow = now + (60 * 60 * 1000);
  
  return timestamp >= oneYearAgo && timestamp <= oneHourFromNow;
}

/**
 * Clamp number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Create error response object
 */
export function createErrorResponse(message: string, code?: string): { error: string; timestamp: number; code?: string } {
  return {
    error: message,
    timestamp: Date.now(),
    ...(code && { code })
  };
}

/**
 * Log with timestamp
 */
export function logWithTimestamp(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  switch (level) {
    case 'warn':
      console.warn(logMessage);
      break;
    case 'error':
      console.error(logMessage);
      break;
    default:
      console.log(logMessage);
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, i);
      logWithTimestamp(`Retry ${i + 1}/${maxRetries} failed, waiting ${delay}ms...`, 'warn');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}