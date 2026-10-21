const request = require('supertest');
const app = require('../src/app');

describe('MovieMeet REST API Tests', () => {
  let guestToken = '';
  let guestUser = null;
  let testRoomCode = '';

  test('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('database');
  });

  test('POST /api/auth/guest should create a guest session and JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/guest')
      .send({ username: 'Cinephile_Alice' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toBe('Cinephile_Alice');
    expect(res.body.user.isGuest).toBe(true);

    guestToken = res.body.token;
    guestUser = res.body.user;
  });

  test('GET /api/auth/me should return authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe(guestUser.userId);
  });

  test('POST /api/rooms should create a new watch-party room', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        name: 'Friday Movie Night',
        hostControlsOnly: true,
        initialVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.room.roomCode).toBeDefined();
    expect(res.body.room.name).toBe('Friday Movie Night');
    expect(res.body.room.hostControlsOnly).toBe(true);

    testRoomCode = res.body.room.roomCode;
  });

  test('POST /api/rooms/:code/join should allow the host and validate guest passwords', async () => {
    const created = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ name: 'Password Test Room', password: ' screening ' });

    expect(created.status).toBe(201);
    expect(created.body.room.hasPassword).toBe(true);
    expect(created.body.room).not.toHaveProperty('passwordHash');
    const roomCode = created.body.room.roomCode;

    const secondGuest = await request(app)
      .post('/api/auth/guest')
      .send({ username: 'Cinephile_Bob' });
    expect(secondGuest.status).toBe(200);

    const noPassword = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({});
    expect(noPassword.status).toBe(200);

    const guestWithoutPassword = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${secondGuest.body.token}`)
      .send({});
    expect(guestWithoutPassword.status).toBe(401);
    expect(guestWithoutPassword.body.error).toBe('Password required to join this room');

    const paddedPassword = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ password: ' screening ' });

    expect(paddedPassword.status).toBe(200);

    const secondUserJoin = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${secondGuest.body.token}`)
      .send({ password: 'screening' });
    expect(secondUserJoin.status).toBe(200);

    const incorrectPassword = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .set('Authorization', `Bearer ${secondGuest.body.token}`)
      .send({ password: 'incorrect' });

    expect(incorrectPassword.status).toBe(401);
    expect(incorrectPassword.body.error).toBe('Incorrect room password');

    const missingRoom = await request(app)
      .post('/api/rooms/ZZZ-0000/join')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ password: 'screening' });
    expect(missingRoom.status).toBe(404);
    expect(missingRoom.body.error).toBe('Room not found');
  });

  test('GET /api/rooms/:code should return public room info', async () => {
    const res = await request(app).get(`/api/rooms/${testRoomCode}`);
    expect(res.status).toBe(200);
    expect(res.body.roomCode).toBe(testRoomCode);
    expect(res.body.name).toBe('Friday Movie Night');
    expect(res.body.participantCount).toBe(0);
  });

  test('POST /api/rooms/:code/join should verify room access', async () => {
    const res = await request(app)
      .post(`/api/rooms/${testRoomCode}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.roomCode).toBe(testRoomCode);
  });

  test('GET /api/rooms/:code/ice-servers should provide WebRTC ICE servers', async () => {
    const res = await request(app)
      .get(`/api/rooms/${testRoomCode}/ice-servers`)
      .set('Authorization', `Bearer ${guestToken}`);

    expect(res.status).toBe(200);
    expect(res.body.iceServers).toBeDefined();
    expect(Array.isArray(res.body.iceServers)).toBe(true);
    expect(res.body.iceServers.length).toBeGreaterThan(0);
  });

  test('GET /api/videos/samples should return authorized sample movies', async () => {
    const res = await request(app).get('/api/videos/samples');
    expect(res.status).toBe(200);
    expect(res.body.samples).toBeDefined();
    expect(res.body.samples.length).toBeGreaterThan(0);
    expect(res.body.samples[0]).toHaveProperty('title');
    expect(res.body.samples[0]).toHaveProperty('url');
  });
});
