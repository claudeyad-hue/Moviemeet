const bcrypt = require('bcryptjs');
const Store = require('../services/store');
const { getIceServers } = require('../config/webrtc');

// Generate human-friendly readable room code: e.g. "MOV-4982" or "MEET-7123"
const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    prefix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
};

const createRoom = async (req, res) => {
  try {
    const { name, password, hostControlsOnly, initialVideoUrl } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    // Generate unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    while ((await Store.findRoomByCode(roomCode)) && attempts < 10) {
      roomCode = generateRoomCode();
      attempts++;
    }

    let passwordHash = null;
    let hasPassword = false;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password.trim(), salt);
      hasPassword = true;
    }

    const defaultVideo = initialVideoUrl?.trim() || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

    const room = await Store.createRoom({
      roomCode,
      name: name?.trim() || `${username}'s Watch Party`,
      hostUserId: userId,
      hostName: username,
      hasPassword,
      passwordHash,
      hostControlsOnly: !!hostControlsOnly,
      currentVideoUrl: defaultVideo,
      maxParticipants: 4
    });

    // Initialize runtime room state
    Store.getOrCreateRuntimeRoom(roomCode, defaultVideo, !!hostControlsOnly);

    const clientUrl = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://claudeyad-hue.github.io/Moviemeet' : 'http://localhost:5173');
    const inviteLink = `${clientUrl.replace(/\/$/, '')}/room/${roomCode}`;

    return res.status(201).json({
      success: true,
      room: {
        roomCode: room.roomCode,
        name: room.name,
        hostUserId: room.hostUserId,
        hostName: room.hostName,
        hasPassword: room.hasPassword,
        hostControlsOnly: room.hostControlsOnly,
        currentVideoUrl: room.currentVideoUrl,
        maxParticipants: room.maxParticipants,
        inviteLink
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'Failed to create room' });
  }
};

const getRoomInfo = async (req, res) => {
  try {
    const { code } = req.params;
    const room = await Store.findRoomByCode(code);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const runtime = Store.getRuntimeRoom(code);
    const participantCount = runtime ? runtime.participants.size : 0;

    return res.status(200).json({
      roomCode: room.roomCode,
      name: room.name,
      hostName: room.hostName,
      hasPassword: room.hasPassword,
      hostControlsOnly: room.hostControlsOnly,
      currentVideoUrl: room.currentVideoUrl,
      participantCount,
      maxParticipants: room.maxParticipants || 4,
      isFull: participantCount >= (room.maxParticipants || 4)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get room information' });
  }
};

const verifyJoinRoom = async (req, res) => {
  try {
    const { code } = req.params;
    const { password } = req.body;
    const room = await Store.findRoomByCode(code);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const runtime = Store.getRuntimeRoom(code);
    const participantCount = runtime ? runtime.participants.size : 0;
    if (participantCount >= (room.maxParticipants || 4)) {
      return res.status(403).json({ error: 'Room is full (maximum 4 participants)' });
    }

    const isRoomHost = room.hostUserId === req.user.userId;
    if (room.hasPassword && !isRoomHost) {
      const normalizedPassword = typeof password === 'string' ? password.trim() : '';
      if (!normalizedPassword) {
        return res.status(401).json({ error: 'Password required to join this room', requiresPassword: true });
      }
      const match = await bcrypt.compare(normalizedPassword, room.passwordHash);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect room password', requiresPassword: true });
      }
    }

    const clientUrl = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://claudeyad-hue.github.io/Moviemeet' : 'http://localhost:5173');
    return res.status(200).json({
      success: true,
      roomCode: room.roomCode,
      name: room.name,
      hostUserId: room.hostUserId,
      hostName: room.hostName,
      hostControlsOnly: room.hostControlsOnly,
      currentVideoUrl: room.currentVideoUrl,
      inviteLink: `${clientUrl}/room/${room.roomCode}`
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to join room' });
  }
};

const getIceServersConfig = async (req, res) => {
  try {
    const iceServers = getIceServers();
    return res.status(200).json({ iceServers });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve ICE servers' });
  }
};

module.exports = {
  createRoom,
  getRoomInfo,
  verifyJoinRoom,
  getIceServersConfig
};
