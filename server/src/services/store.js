const { isMongooseConnected } = require('../config/db');
const User = require('../models/User');
const Room = require('../models/Room');

// In-memory fallbacks when MongoDB is not connected (e.g. during standalone testing or offline local development)
const memoryUsers = new Map();
const memoryRooms = new Map();

// Active realtime room runtime states (Socket.IO runtime data)
// Maps roomCode -> {
//   participants: Map(socketId -> { userId, username, isHost, joinedAt, audioEnabled, videoEnabled, isScreenSharing }),
//   playback: { currentTime: 0, isPlaying: false, playbackRate: 1, videoUrl: string, hostControlsOnly: boolean, lastUpdated: number },
//   activeScreenSharer: socketId | null,
//   emptyRoomTimer: Timeout | null
// }
const activeRoomStates = new Map();

const Store = {
  // User operations
  async createUser(userData) {
    if (isMongooseConnected()) {
      try {
        const user = new User(userData);
        await user.save();
        return user.toObject();
      } catch (err) {
        // Fall back to memory if DB error occurred
        console.warn('[Store] DB write failed, storing user in memory:', err.message);
      }
    }
    const userObj = {
      ...userData,
      createdAt: new Date()
    };
    memoryUsers.set(userData.userId, userObj);
    return userObj;
  },

  async findUserById(userId) {
    if (isMongooseConnected()) {
      try {
        const user = await User.findOne({ userId }).lean();
        if (user) return user;
      } catch (err) {
        // ignore and fallback
      }
    }
    return memoryUsers.get(userId) || null;
  },

  async findUserByUsername(username) {
    const clean = username.trim().toLowerCase();
    if (isMongooseConnected()) {
      try {
        const user = await User.findOne({ username: new RegExp(`^${clean}$`, 'i') }).lean();
        if (user) return user;
      } catch (err) {
        // ignore and fallback
      }
    }
    for (const u of memoryUsers.values()) {
      if (u.username.toLowerCase() === clean) return u;
    }
    return null;
  },

  async findUserByEmail(email) {
    const clean = email.trim().toLowerCase();
    if (isMongooseConnected()) {
      try {
        const user = await User.findOne({ email: clean }).lean();
        if (user) return user;
      } catch (err) {
        // ignore and fallback
      }
    }
    for (const u of memoryUsers.values()) {
      if (u.email && u.email.toLowerCase() === clean) return u;
    }
    return null;
  },

  // Room operations
  async createRoom(roomData) {
    if (isMongooseConnected()) {
      try {
        const room = new Room(roomData);
        await room.save();
        return room.toObject();
      } catch (err) {
        console.warn('[Store] DB write failed, storing room in memory:', err.message);
      }
    }
    const roomObj = {
      ...roomData,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    memoryRooms.set(roomData.roomCode.toUpperCase(), roomObj);
    return roomObj;
  },

  async findRoomByCode(code) {
    const upper = (code || '').toUpperCase().trim();
    if (isMongooseConnected()) {
      try {
        const room = await Room.findOne({ roomCode: upper }).lean();
        if (room) return room;
      } catch (err) {
        // ignore and fallback
      }
    }
    return memoryRooms.get(upper) || null;
  },

  async updateRoom(code, updates) {
    const upper = (code || '').toUpperCase().trim();
    if (isMongooseConnected()) {
      try {
        const updated = await Room.findOneAndUpdate(
          { roomCode: upper },
          { $set: { ...updates, updatedAt: new Date() } },
          { new: true }
        ).lean();
        if (updated) return updated;
      } catch (err) {
        // fallback
      }
    }
    const existing = memoryRooms.get(upper);
    if (existing) {
      const merged = { ...existing, ...updates, updatedAt: new Date() };
      memoryRooms.set(upper, merged);
      return merged;
    }
    return null;
  },

  // Real-time Runtime state operations (per active room in Socket.IO)
  getOrCreateRuntimeRoom(roomCode, defaultVideoUrl = '', hostControlsOnly = false) {
    const upper = (roomCode || '').toUpperCase().trim();
    if (!activeRoomStates.has(upper)) {
      activeRoomStates.set(upper, {
        participants: new Map(),
        playback: {
          currentTime: 0,
          isPlaying: false,
          playbackRate: 1,
          videoUrl: defaultVideoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          hostControlsOnly: !!hostControlsOnly,
          lastUpdated: Date.now()
        },
        activeScreenSharer: null,
        emptyRoomTimer: null
      });
    }
    return activeRoomStates.get(upper);
  },

  getRuntimeRoom(roomCode) {
    const upper = (roomCode || '').toUpperCase().trim();
    return activeRoomStates.get(upper) || null;
  },

  removeRuntimeRoom(roomCode) {
    const upper = (roomCode || '').toUpperCase().trim();
    const runtime = activeRoomStates.get(upper);
    if (runtime && runtime.emptyRoomTimer) {
      clearTimeout(runtime.emptyRoomTimer);
    }
    activeRoomStates.delete(upper);
  }
};

module.exports = Store;
