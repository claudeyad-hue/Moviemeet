const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'Movie Night'
  },
  hostUserId: {
    type: String,
    required: true
  },
  hostName: {
    type: String,
    required: true
  },
  hasPassword: {
    type: Boolean,
    default: false
  },
  passwordHash: {
    type: String,
    default: null
  },
  hostControlsOnly: {
    type: Boolean,
    default: false
  },
  currentVideoUrl: {
    type: String,
    default: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  },
  maxParticipants: {
    type: Number,
    default: 4
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

roomSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  if (typeof next === 'function') next();
});

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);
