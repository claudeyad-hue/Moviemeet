const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const Store = require('../services/store');
const { generateToken } = require('../middleware/authMiddleware');

const sanitizeUser = (user) => ({
  userId: user.userId,
  username: user.username,
  email: user.email || null,
  isGuest: !!user.isGuest,
  createdAt: user.createdAt
});

const guestLogin = async (req, res) => {
  try {
    let { username } = req.body;
    if (!username || typeof username !== 'string' || !username.trim()) {
      username = `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      username = username.trim().slice(0, 32);
    }

    const userId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const user = await Store.createUser({
      userId,
      username,
      isGuest: true
    });

    const token = generateToken({
      userId: user.userId,
      username: user.username,
      isGuest: true
    });

    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Guest login error:', error);
    return res.status(500).json({ error: 'Failed to create guest session' });
  }
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters long' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUsername = await Store.findUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    if (email) {
      const existingEmail = await Store.findUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    const user = await Store.createUser({
      userId,
      username: username.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      passwordHash,
      isGuest: false
    });

    const token = generateToken({
      userId: user.userId,
      username: user.username,
      isGuest: false
    });

    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // username or email

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required' });
    }

    let user = await Store.findUserByUsername(identifier);
    if (!user && identifier.includes('@')) {
      user = await Store.findUserByEmail(identifier);
    }

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = generateToken({
      userId: user.userId,
      username: user.username,
      isGuest: false
    });

    return res.status(200).json({
      success: true,
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to authenticate' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await Store.findUserById(req.user.userId);
    if (!user) {
      // If user was ephemeral guest from token
      return res.status(200).json({
        user: {
          userId: req.user.userId,
          username: req.user.username,
          isGuest: !!req.user.isGuest
        }
      });
    }

    return res.status(200).json({
      user: sanitizeUser(user)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

module.exports = {
  guestLogin,
  register,
  login,
  getMe
};
