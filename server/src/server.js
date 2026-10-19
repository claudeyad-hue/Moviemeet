require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./config/db');
const { socketAuthMiddleware } = require('./middleware/authMiddleware');
const setupSocketHandler = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Socket.IO configuration with CORS and auth
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith('http://localhost:') ||
        origin.endsWith('.onrender.com') ||
        origin === process.env.CLIENT_URL
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive fallback
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

// Authenticate socket connections
io.use(socketAuthMiddleware);

// Initialize real-time handlers
setupSocketHandler(io);

// Start server
const startServer = async () => {
  // Attempt DB connection
  await connectDB();

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🎬 MovieMeet Server running on port ${PORT}`);
    console.log(`🚀 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Socket.IO Real-time & WebRTC Signaling Ready`);
    console.log(`===============================================`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { server, io, app };
