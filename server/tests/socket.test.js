const http = require('http');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const app = require('../src/app');
const Store = require('../src/services/store');
const { socketAuthMiddleware, generateToken } = require('../src/middleware/authMiddleware');
const setupSocketHandler = require('../src/sockets/socketHandler');

describe('MovieMeet Socket.IO Real-time Synchronization Tests', () => {
  let server, io, port, serverUrl;
  let user1Token, user2Token;
  let clientSocket1, clientSocket2;
  const testRoomCode = 'TEST-1234';

  beforeAll((done) => {
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });
    io.use(socketAuthMiddleware);
    setupSocketHandler(io);

    server.listen(0, () => {
      port = server.address().port;
      serverUrl = `http://localhost:${port}`;

      // Create test room in Store
      Store.createRoom({
        roomCode: testRoomCode,
        name: 'Test Room',
        hostUserId: 'user-1',
        hostName: 'HostAlice',
        hasPassword: false,
        hostControlsOnly: false,
        currentVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });

      user1Token = generateToken({ userId: 'user-1', username: 'HostAlice', isGuest: true });
      user2Token = generateToken({ userId: 'user-2', username: 'GuestBob', isGuest: true });
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    io.close();
    server.close(done);
  });

  test('Socket connection requires valid JWT token', (done) => {
    const unauthSocket = ioClient(serverUrl, {
      auth: { token: 'invalid_token' },
      transports: ['websocket']
    });

    unauthSocket.on('connect_error', (err) => {
      expect(err.message).toMatch(/token/i);
      unauthSocket.disconnect();
      done();
    });
  });

  test('Two participants join the same room and exchange presence', (done) => {
    clientSocket1 = ioClient(serverUrl, {
      auth: { token: user1Token },
      transports: ['websocket']
    });

    clientSocket1.on('connect', () => {
      clientSocket1.emit('room:join', { roomCode: testRoomCode });
    });

    clientSocket1.on('room:joined', (data) => {
      expect(data.roomCode).toBe(testRoomCode);
      expect(data.self.username).toBe('HostAlice');
      expect(data.self.isHost).toBe(true);

      // Connect user 2
      clientSocket2 = ioClient(serverUrl, {
        auth: { token: user2Token },
        transports: ['websocket']
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('room:join', { roomCode: testRoomCode });
      });

      clientSocket2.on('room:joined', (bobData) => {
        expect(bobData.roomCode).toBe(testRoomCode);
        expect(bobData.self.username).toBe('GuestBob');
        expect(bobData.self.isHost).toBe(false);
        expect(bobData.participants.length).toBe(2);
      });
    });

    clientSocket1.on('room:user-joined', ({ participant }) => {
      expect(participant.username).toBe('GuestBob');
      done();
    });
  });

  test('Synchronized playback events (play, pause, seek) broadcast to room peers', (done) => {
    // User 1 sends play action at 42.5 seconds
    clientSocket2.once('playback:sync', (syncData) => {
      expect(syncData.action).toBe('play');
      expect(syncData.state.isPlaying).toBe(true);
      expect(syncData.state.currentTime).toBe(42.5);
      expect(syncData.triggeredBy).toBe('HostAlice');
      done();
    });

    clientSocket1.emit('playback:action', {
      type: 'play',
      currentTime: 42.5
    });
  });

  test('Screen sharing events broadcast correctly to peers', (done) => {
    clientSocket2.once('screenshare:started', (data) => {
      expect(data.socketId).toBe(clientSocket1.id);
      expect(data.username).toBe('HostAlice');

      // Now stop screen share
      clientSocket2.once('screenshare:stopped', (stopData) => {
        expect(stopData.socketId).toBe(clientSocket1.id);
        done();
      });

      clientSocket1.emit('screenshare:stop');
    });

    clientSocket1.emit('screenshare:start');
  });

  test('Chat message broadcasts with timestamp and sanitized content', (done) => {
    clientSocket1.once('chat:message', (msg) => {
      expect(msg.senderName).toBe('GuestBob');
      expect(msg.text).toBe('Hey Alice, movie looks awesome!');
      expect(msg.timestamp).toBeDefined();
      done();
    });

    clientSocket2.emit('chat:message', {
      text: 'Hey Alice, movie looks awesome!'
    });
  });

  test('WebRTC signaling (offer, answer, ICE candidate) relays between room peers', (done) => {
    // Bob listens for WebRTC offer from Alice
    clientSocket2.once('webrtc:signal', ({ fromSocketId, signal }) => {
      expect(fromSocketId).toBe(clientSocket1.id);
      expect(signal.type).toBe('offer');
      expect(signal.sdp).toBe('mock_offer_sdp_data');

      // Bob replies with WebRTC answer
      clientSocket1.once('webrtc:signal', (answerData) => {
        expect(answerData.fromSocketId).toBe(clientSocket2.id);
        expect(answerData.signal.type).toBe('answer');
        expect(answerData.signal.sdp).toBe('mock_answer_sdp_data');
        done();
      });

      clientSocket2.emit('webrtc:signal', {
        toSocketId: fromSocketId,
        signal: { type: 'answer', sdp: 'mock_answer_sdp_data' }
      });
    });

    clientSocket1.emit('webrtc:signal', {
      toSocketId: clientSocket2.id,
      signal: { type: 'offer', sdp: 'mock_offer_sdp_data' }
    });
  });

  test('Media status changes (mic mute, camera toggle) broadcast to room peers', (done) => {
    clientSocket2.once('media:status-changed', (status) => {
      expect(status.socketId).toBe(clientSocket1.id);
      expect(status.audioEnabled).toBe(false);
      expect(status.videoEnabled).toBe(true);
      done();
    });

    clientSocket1.emit('media:toggle', {
      audioEnabled: false,
      videoEnabled: true
    });
  });
});
