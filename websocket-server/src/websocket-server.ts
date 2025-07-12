/**
 * WebSocket Server for Virtual Pet System
 * 
 * Bridges Redis pub/sub messages to Socket.IO clients for real-time dashboard updates.
 * Subscribes to pet state changes and broadcasts them to connected dashboard clients.
 */

import { Server } from 'socket.io';
import * as redis from 'redis';
import * as http from 'http';

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

interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

type RedisMessage = PetUpdate | ErrorMessage;

// Pet state constants
const PET_STATE_KEY = 'pet:state';
const PET_CHANNEL = 'pet_updates';

// Create HTTP server for Socket.IO
const server = http.createServer();

// Create Socket.IO server with CORS config
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

// Redis subscriber client
const redisSubscriber = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis and set up subscription
redisSubscriber.connect().then(() => {
  console.log('Redis subscriber connected');
  
  // Subscribe to pet updates channel
  redisSubscriber.subscribe(PET_CHANNEL, (message: string) => {
    console.log('Redis ->', message);
    
    // Parse and validate JSON message
    let parsedMessage: RedisMessage;
    try {
      parsedMessage = JSON.parse(message) as RedisMessage;
    } catch (e) {
      console.error('Failed to parse Redis message:', e);
      parsedMessage = { type: 'ERROR', message: 'Invalid JSON' };
    }
    
    // Broadcast to all connected dashboard clients
    io.emit('pet_update', parsedMessage);
  });
}).catch((err: Error) => {
  console.error('Redis connection error:', err);
});

// Handle Socket.IO client connections
io.on('connection', (socket) => {
  console.log(`New dashboard client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the WebSocket server
const PORT = process.env.PORT || 8080;
server.listen(PORT, 0, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});