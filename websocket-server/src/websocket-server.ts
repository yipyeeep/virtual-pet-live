import { Server } from "socket.io";
import * as redis from "redis";
import * as http from "http";

const server = http.createServer();

const io = new Server(server, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

const redisSubscriber = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
redisSubscriber.connect().then(() => {
  console.log('Redis subscriber connected');
  
  redisSubscriber.subscribe('test_channel', (message) => {
    console.log('Redis ->', message);
    
    // Parse JSON message
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (e) {
      console.error('Failed to parse Redis message:', e);
      parsedMessage = { type: 'ERROR', message: 'Invalid JSON' };
    }
    
    // Broadcast to all Socket.IO clients
    io.emit('quiz_event', parsedMessage);
  });
}).catch(err => {
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