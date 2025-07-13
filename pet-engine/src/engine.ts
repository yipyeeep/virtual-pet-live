// =============================================================================
// 3. ENHANCED ENGINE WITH ACTIVITY LOGGING
// =============================================================================

// pet-engine/src/engine.ts
/**
 * Enhanced Pet Engine with Comprehensive Activity Logging
 * 
 * Tracks all autonomous behaviors, happiness changes, and activity transitions
 * for metrics collection and analysis.
 */

import * as dotenv from 'dotenv';
import * as redis from 'redis';

dotenv.config();

interface PetState {
  happiness: number;
  activity: 'idle' | 'playing' | 'sleeping' | 'eating';
  lastUpdate: number;
}

interface PetUpdate {
  type: 'PET_STATE_UPDATE';
  state: PetState;
  timestamp: number;
}

// Redis clients
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const redisMetrics = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';

/**
 * Log activity change for metrics
 */
async function logActivityChange(oldActivity: string, newActivity: string, cause: string) {
  await redisMetrics.lPush('pet:metrics:activity_log', JSON.stringify({
    oldActivity,
    newActivity,
    cause,
    timestamp: Date.now()
  }));
  
  // Keep only last 1000 activity changes
  await redisMetrics.lTrim('pet:metrics:activity_log', 0, 999);
}

/**
 * Log happiness change for trend tracking
 */
async function logHappinessChange(oldHappiness: number, newHappiness: number, cause: string) {
  if (oldHappiness !== newHappiness) {
    await redisMetrics.lPush('pet:metrics:happiness_history', JSON.stringify({
      oldValue: oldHappiness,
      newValue: newHappiness,
      change: newHappiness - oldHappiness,
      cause,
      timestamp: Date.now()
    }));
    
    // Keep only last 2000 happiness records
    await redisMetrics.lTrim('pet:metrics:happiness_history', 0, 1999);
  }
}

async function getPetState(): Promise<PetState> {
  const state = await redisClient.get(PET_STATE_KEY);
  return state ? JSON.parse(state) : {
    happiness: 50,
    activity: 'idle' as const,
    lastUpdate: Date.now()
  };
}

async function setPetState(newState: PetState): Promise<void> {
  await redisClient.set(PET_STATE_KEY, JSON.stringify(newState));
  
  const update: PetUpdate = {
    type: 'PET_STATE_UPDATE',
    state: newState,
    timestamp: Date.now()
  };
  
  await redisClient.publish(PET_CHANNEL, JSON.stringify(update));
}

async function updatePetBehavior(): Promise<void> {
  const currentState = await getPetState();
  const timeSinceLastUpdate = Date.now() - currentState.lastUpdate;
  
  // Calculate happiness decay
  const happinessDecay = Math.floor(timeSinceLastUpdate / (5 * 60 * 1000));
  const newHappiness = Math.max(0, currentState.happiness - happinessDecay);
  
  // Track happiness changes
  if (newHappiness !== currentState.happiness) {
    await logHappinessChange(currentState.happiness, newHappiness, 'natural_decay');
  }
  
  // Determine new activity
  let newActivity: PetState['activity'] = 'idle';
  
  if (currentState.activity === 'idle') {
    const rand = Math.random();
    if (newHappiness < 30) {
      newActivity = 'sleeping';
    } else if (rand < 0.3) {
      newActivity = 'playing';
    } else if (rand < 0.5) {
      newActivity = 'sleeping';
    } else {
      newActivity = 'idle';
    }
  } else if (currentState.activity === 'playing' || currentState.activity === 'sleeping') {
    const activityDuration = Date.now() - currentState.lastUpdate;
    if (activityDuration > 30000) {
      newActivity = 'idle';
    } else {
      newActivity = currentState.activity;
    }
  }
  
  // Log activity changes
  if (newActivity !== currentState.activity) {
    await logActivityChange(currentState.activity, newActivity, 'autonomous_behavior');
  }
  
  const newState: PetState = {
    happiness: newHappiness,
    activity: newActivity,
    lastUpdate: Date.now()
  };
  
  // Only update if something changed
  if (newState.happiness !== currentState.happiness || newState.activity !== currentState.activity) {
    await setPetState(newState);
    console.log(`Pet behavior updated: happiness=${newHappiness}, activity=${newActivity}`);
  }
}

async function startPetEngine(): Promise<void> {
  try {
    await redisClient.connect();
    await redisMetrics.connect();
    console.log('Enhanced Pet Engine connected to Redis!');
    
    await updatePetBehavior();
    
    // Update every minute
    setInterval(async () => {
      try {
        await updatePetBehavior();
      } catch (error) {
        console.error('Error updating pet behavior:', error);
      }
    }, 60000);
    
    console.log('Enhanced Pet Engine running with metrics tracking!');
  } catch (error) {
    console.error('Failed to start Pet Engine:', error);
    process.exit(1);
  }
}

startPetEngine();