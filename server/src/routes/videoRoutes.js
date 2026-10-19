const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('../middleware/authMiddleware');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage for authorized video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.ogg', '.mkv', '.vtt', '.srt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.startsWith('video/') || file.mimetype === 'text/vtt') {
      cb(null, true);
    } else {
      cb(new Error('Invalid video or subtitle file format. Only MP4, WebM, and VTT files are supported.'));
    }
  }
});

// Authorized open-source sample movies
const AUTHORIZED_SAMPLES = [
  {
    id: 'big-buck-bunny',
    title: 'Big Buck Bunny (Blender Foundation, Open Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&auto=format&fit=crop&q=60',
    duration: '9:56',
    description: 'A large and lovable rabbit deals with bullying forest creatures in this classic open-source animated short.'
  },
  {
    id: 'tears-of-steel',
    title: 'Tears of Steel (Blender VFX Sci-Fi Open Movie)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=60',
    duration: '12:14',
    description: 'Set in a dystopian future Amsterdam, warriors attempt to salvage humanity from hostile robots.'
  },
  {
    id: 'sintel',
    title: 'Sintel (Blender Foundation Animated Fantasy)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=500&auto=format&fit=crop&q=60',
    duration: '14:48',
    description: 'A lonely young woman searches the dangerous wilderness for a baby dragon she befriended.'
  },
  {
    id: 'elephants-dream',
    title: "Elephants Dream (World's First Open Movie)",
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60',
    duration: '10:54',
    description: 'Proog and Emo journey through the surreal and mechanical Machine.'
  }
];

// GET /api/videos/samples - Get preset sample videos
router.get('/samples', (req, res) => {
  res.json({ samples: AUTHORIZED_SAMPLES });
});

// POST /api/videos/upload - Upload authorized local video file
router.post('/upload', authMiddleware, upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/api/videos/stream/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return res.status(500).json({ error: 'Video upload failed' });
  }
});

// GET /api/videos/stream/:filename - Stream video with HTTP 206 Partial Content support
router.get('/stream/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  // res.sendFile handles byte-range requests automatically
  res.sendFile(filePath);
});

module.exports = router;
