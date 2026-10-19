const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/', authMiddleware, roomController.createRoom);
router.get('/:code', roomController.getRoomInfo);
router.post('/:code/join', authMiddleware, roomController.verifyJoinRoom);
router.get('/:code/ice-servers', authMiddleware, roomController.getIceServersConfig);

module.exports = router;
