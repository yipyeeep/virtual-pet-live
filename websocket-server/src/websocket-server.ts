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

// Create HTTP server
const server = http.createServer();

// Create Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

// Create Redis subscriber
const redisSubscriber = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
redisSubscriber.connect().then(() => {
  console.log('Redis subscriber connected');
  
  redisSubscriber.subscribe('test_channel', (message: string) => {
    console.log('Redis ->', message);
    
    // Parse JSON message
    let parsedMessage: RedisMessage;
    try {
      parsedMessage = JSON.parse(message) as RedisMessage;
    } catch (e) {
      console.error('Failed to parse Redis message:', e);
      parsedMessage = { type: 'ERROR', message: 'Invalid JSON' };
    }
    
    // Broadcast to all Socket.IO clients
    io.emit('quiz_event', parsedMessage);
  });
}).catch((err: Error) => {
  console.error('Redis connection error:', err);
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`New dashboard client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, 0, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});