const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/moviemeet';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    isConnected = true;
    console.log(`[MongoDB] Connected to database: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    isConnected = false;
    console.warn(`[MongoDB] Note: MongoDB connection failed (${error.message}). Falling back to memory store for room/user sessions.`);
    return null;
  }
};

const getDBStatus = () => ({
  isConnected,
  mongooseState: mongoose.connection.readyState
});

module.exports = {
  connectDB,
  getDBStatus,
  isMongooseConnected: () => isConnected
};
