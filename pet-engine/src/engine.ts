import * as dotenv from 'dotenv';
import * as redis from 'redis';

dotenv.config();

// Types
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

// Redis setup
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';

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
  
  // Publish update to dashboard
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
  
  // Decrease happiness over time (1 point per 5 minutes)
  const happinessDecay = Math.floor(timeSinceLastUpdate / (5 * 60 * 1000));
  const newHappiness = Math.max(0, currentState.happiness - happinessDecay);
  
  // Determine autonomous behavior
  let newActivity: PetState['activity'] = 'idle';
  
  if (currentState.activity === 'idle') {
    // Random autonomous behaviors
    const rand = Math.random();
    
    if (newHappiness < 30) {
      newActivity = 'sleeping'; // Pet sleeps when unhappy
    } else if (rand < 0.3) {
      newActivity = 'playing'; // 30% chance to play
    } else if (rand < 0.5) {
      newActivity = 'sleeping'; // 20% chance to sleep
    } else {
      newActivity = 'idle'; // 50% chance to stay idle
    }
  } else if (currentState.activity === 'playing' || currentState.activity === 'sleeping') {
    // Return to idle after autonomous behaviors
    const activityDuration = Date.now() - currentState.lastUpdate;
    if (activityDuration > 30000) { // 30 seconds
      newActivity = 'idle';
    } else {
      newActivity = currentState.activity; // Continue current activity
    }
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
    console.log('Pet Engine connected to Redis!');
    
    // Initial state check
    await updatePetBehavior();
    
    // Update every minute
    setInterval(async () => {
      try {
        await updatePetBehavior();
      } catch (error) {
        console.error('Error updating pet behavior:', error);
      }
    }, 60000); // 60 seconds
    
    console.log('Pet Engine running! Updates every minute.');
    
  } catch (error) {
    console.error('Failed to start Pet Engine:', error);
    process.exit(1);
  }
}

startPetEngine();