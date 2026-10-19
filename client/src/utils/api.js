const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const getHeaders = (isJson = true) => {
  const token = localStorage.getItem('moviemeet_token');
  const headers = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  // Auth
  async guestLogin(username) {
    const res = await fetch(`${API_BASE}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Guest login failed');
    }
    return res.json();
  },

  async register(data) {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  async login(data) {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error('Not authenticated');
    }
    return res.json();
  },

  // Rooms
  async createRoom(data) {
    const res = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create room');
    }
    return res.json();
  },

  async getRoomInfo(code) {
    const res = await fetch(`${API_BASE}/api/rooms/${code}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Room not found');
    }
    return res.json();
  },

  async joinRoom(code, password) {
    const res = await fetch(`${API_BASE}/api/rooms/${code}/join`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to join room');
    }
    return res.json();
  },

  async getIceServers(code) {
    const res = await fetch(`${API_BASE}/api/rooms/${code}/ice-servers`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
    const data = await res.json();
    return data.iceServers;
  },

  // Videos
  async getSamples() {
    const res = await fetch(`${API_BASE}/api/videos/samples`);
    if (!res.ok) return { samples: [] };
    return res.json();
  },

  async uploadVideo(file) {
    const formData = new FormData();
    formData.append('video', file);

    const res = await fetch(`${API_BASE}/api/videos/upload`, {
      method: 'POST',
      headers: getHeaders(false),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload video');
    }
    return res.json();
  }
};
