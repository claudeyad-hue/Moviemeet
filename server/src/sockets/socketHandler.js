const Store = require('../services/store');

// Basic HTML sanitization for chat messages
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .slice(0, 1000)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const setupSocketHandler = (io) => {
  io.on('connection', (socket) => {
    let currentRoomCode = null;
    const user = socket.user;

    // Join Room handler
    socket.on('room:join', async ({ roomCode }) => {
      try {
        if (!roomCode) {
          return socket.emit('room:error', { message: 'Room code is required' });
        }

        const upperCode = roomCode.toUpperCase().trim();
        const room = await Store.findRoomByCode(upperCode);
        if (!room) {
          return socket.emit('room:error', { message: 'Room does not exist' });
        }

        let runtime = Store.getOrCreateRuntimeRoom(
          upperCode,
          room.currentVideoUrl,
          room.hostControlsOnly
        );

        // Cancel empty room cleanup timer if active
        if (runtime.emptyRoomTimer) {
          clearTimeout(runtime.emptyRoomTimer);
          runtime.emptyRoomTimer = null;
        }

        // Calculate dynamic playback time if video was playing
        let currentPlaybackTime = runtime.playback.currentTime;
        if (runtime.playback.isPlaying) {
          const elapsed = (Date.now() - runtime.playback.lastUpdated) / 1000;
          currentPlaybackTime += elapsed * (runtime.playback.playbackRate || 1);
        }

        // Clean up any stale participant sessions with the same userId (e.g. from page refresh or re-join)
        for (const [existingSocketId, p] of runtime.participants.entries()) {
          if (p.userId === user.userId && existingSocketId !== socket.id) {
            runtime.participants.delete(existingSocketId);
            socket.to(upperCode).emit('room:user-left', {
              socketId: existingSocketId,
              username: p.username,
              newHost: null
            });
          }
        }

        // If this exact socket has already joined, re-emit room:joined without duplicate broadcasts
        if (runtime.participants.has(socket.id)) {
          const currentParticipant = runtime.participants.get(socket.id);
          return socket.emit('room:joined', {
            roomCode: upperCode,
            roomName: room.name,
            self: currentParticipant,
            participants: Array.from(runtime.participants.values()),
            playback: {
              ...runtime.playback,
              currentTime: currentPlaybackTime
            },
            activeScreenSharer: runtime.activeScreenSharer
          });
        }

        // Capacity check
        if (runtime.participants.size >= (room.maxParticipants || 4)) {
          return socket.emit('room:error', { message: 'Room is full (max 4 participants)' });
        }

        // Check if user is host
        const isHost = room.hostUserId === user.userId || runtime.participants.size === 0;

        // Register participant
        const participant = {
          socketId: socket.id,
          userId: user.userId,
          username: user.username,
          isHost,
          isGuest: !!user.isGuest,
          joinedAt: Date.now(),
          audioEnabled: true,
          videoEnabled: true,
          isScreenSharing: false
        };

        runtime.participants.set(socket.id, participant);
        currentRoomCode = upperCode;
        socket.join(upperCode);

        const participantsList = Array.from(runtime.participants.values());

        // Emit room:joined to the joining user
        socket.emit('room:joined', {
          roomCode: upperCode,
          roomName: room.name,
          self: participant,
          participants: participantsList,
          playback: {
            ...runtime.playback,
            currentTime: currentPlaybackTime
          },
          activeScreenSharer: runtime.activeScreenSharer
        });

        // Broadcast to other participants in room
        socket.to(upperCode).emit('room:user-joined', {
          participant
        });
      } catch (err) {
        console.error('Error joining room socket:', err);
        socket.emit('room:error', { message: 'Failed to join room' });
      }
    });

    // WebRTC Mesh Signaling (offer, answer, ICE candidate)
    socket.on('webrtc:signal', ({ toSocketId, signal }) => {
      if (!currentRoomCode || !toSocketId || !signal) return;

      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime || !runtime.participants.has(toSocketId)) {
        return;
      }

      // Relay signal to target peer
      io.to(toSocketId).emit('webrtc:signal', {
        fromSocketId: socket.id,
        signal
      });
    });

    // Media status change (mic mute, camera toggle)
    socket.on('media:toggle', ({ audioEnabled, videoEnabled }) => {
      if (!currentRoomCode) return;
      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime) return;

      const participant = runtime.participants.get(socket.id);
      if (participant) {
        if (typeof audioEnabled === 'boolean') participant.audioEnabled = audioEnabled;
        if (typeof videoEnabled === 'boolean') participant.videoEnabled = videoEnabled;

        socket.to(currentRoomCode).emit('media:status-changed', {
          socketId: socket.id,
          audioEnabled: participant.audioEnabled,
          videoEnabled: participant.videoEnabled
        });
      }
    });

    // Screen Sharing Events
    socket.on('screenshare:start', ({ streamId } = {}) => {
      if (!currentRoomCode) return;
      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime) return;

      // Only one screen share per room at a time
      if (runtime.activeScreenSharer && runtime.activeScreenSharer !== socket.id) {
        const sharer = runtime.participants.get(runtime.activeScreenSharer);
        return socket.emit('screenshare:error', {
          message: `${sharer ? sharer.username : 'Another user'} is already sharing their screen.`
        });
      }

      runtime.activeScreenSharer = socket.id;
      const participant = runtime.participants.get(socket.id);
      if (participant) {
        participant.isScreenSharing = true;
      }

      io.to(currentRoomCode).emit('screenshare:started', {
        socketId: socket.id,
        username: user.username,
        streamId: streamId || null
      });
    });

    socket.on('screenshare:stop', () => {
      if (!currentRoomCode) return;
      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime) return;

      if (runtime.activeScreenSharer === socket.id) {
        runtime.activeScreenSharer = null;
        const participant = runtime.participants.get(socket.id);
        if (participant) {
          participant.isScreenSharing = false;
        }

        io.to(currentRoomCode).emit('screenshare:stopped', {
          socketId: socket.id
        });
      }
    });

    // Video Playback Synchronization
    socket.on('playback:action', ({ type, currentTime, videoUrl, hostControlsOnly, playbackRate }) => {
      if (!currentRoomCode) return;
      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime) return;

      const participant = runtime.participants.get(socket.id);
      if (!participant) return;

      // Host control authorization check
      if (runtime.playback.hostControlsOnly && !participant.isHost && type !== 'request-sync') {
        return socket.emit('playback:error', {
          message: 'Playback controls are restricted to the host only.'
        });
      }

      const now = Date.now();

      switch (type) {
        case 'play':
          runtime.playback.isPlaying = true;
          if (typeof currentTime === 'number') {
            runtime.playback.currentTime = currentTime;
          }
          runtime.playback.lastUpdated = now;
          break;

        case 'pause':
          runtime.playback.isPlaying = false;
          if (typeof currentTime === 'number') {
            runtime.playback.currentTime = currentTime;
          }
          runtime.playback.lastUpdated = now;
          break;

        case 'seek':
          if (typeof currentTime === 'number') {
            runtime.playback.currentTime = currentTime;
          }
          runtime.playback.lastUpdated = now;
          break;

        case 'change-video':
          if (videoUrl && typeof videoUrl === 'string') {
            runtime.playback.videoUrl = videoUrl.trim();
            runtime.playback.currentTime = 0;
            runtime.playback.isPlaying = false;
            runtime.playback.lastUpdated = now;
          }
          break;

        case 'playback-rate':
          if (typeof playbackRate === 'number' && playbackRate >= 0.25 && playbackRate <= 3) {
            runtime.playback.playbackRate = playbackRate;
            runtime.playback.lastUpdated = now;
          }
          break;

        case 'toggle-host-controls':
          if (participant.isHost && typeof hostControlsOnly === 'boolean') {
            runtime.playback.hostControlsOnly = hostControlsOnly;
          }
          break;

        default:
          break;
      }

      // Broadcast playback update to everyone in room
      io.to(currentRoomCode).emit('playback:sync', {
        action: type,
        state: { ...runtime.playback },
        triggeredBy: user.username,
        socketId: socket.id
      });
    });

    // Direct playback state request (used for late joins or manual resync)
    socket.on('playback:request-sync', () => {
      if (!currentRoomCode) return;
      const runtime = Store.getRuntimeRoom(currentRoomCode);
      if (!runtime) return;

      let currentPlaybackTime = runtime.playback.currentTime;
      if (runtime.playback.isPlaying) {
        const elapsed = (Date.now() - runtime.playback.lastUpdated) / 1000;
        currentPlaybackTime += elapsed * (runtime.playback.playbackRate || 1);
      }

      socket.emit('playback:sync', {
        action: 'sync',
        state: {
          ...runtime.playback,
          currentTime: currentPlaybackTime
        },
        triggeredBy: 'server'
      });
    });

    // Text Chat Message
    socket.on('chat:message', ({ text }) => {
      if (!currentRoomCode || !text) return;
      const cleanText = sanitizeText(text);
      if (!cleanText.trim()) return;

      const messagePayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        senderId: user.userId,
        senderName: user.username,
        socketId: socket.id,
        text: cleanText,
        timestamp: Date.now()
      };

      io.to(currentRoomCode).emit('chat:message', messagePayload);
    });

    // Floating Real-Time Reaction Emoji
    socket.on('room:reaction', ({ emoji }) => {
      if (!currentRoomCode || !emoji) return;
      const allowedEmojis = ['❤️', '😂', '🍿', '😱', '🔥', '👏', '🎬', '😍', '🎉'];
      const safeEmoji = allowedEmojis.includes(emoji) ? emoji : '🍿';

      const reactionPayload = {
        id: `react_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        emoji: safeEmoji,
        senderName: user.username,
        x: Math.floor(Math.random() * 70) + 15, // 15% to 85% horizontal position
        timestamp: Date.now()
      };

      io.to(currentRoomCode).emit('room:reaction', reactionPayload);
    });

    // Leave room manually
    socket.on('room:leave', () => {
      handleUserDeparture();
    });

    // Socket disconnection
    socket.on('disconnect', () => {
      handleUserDeparture();
    });

    // Common departure logic
    function handleUserDeparture() {
      if (!currentRoomCode) return;
      const upperCode = currentRoomCode;
      const runtime = Store.getRuntimeRoom(upperCode);
      if (!runtime) return;

      const leavingParticipant = runtime.participants.get(socket.id);
      if (!leavingParticipant) return;

      // Clean up participant
      runtime.participants.delete(socket.id);
      socket.leave(upperCode);
      currentRoomCode = null;

      // Handle active screen sharing cleanup
      if (runtime.activeScreenSharer === socket.id) {
        runtime.activeScreenSharer = null;
        io.to(upperCode).emit('screenshare:stopped', { socketId: socket.id });
      }

      // Handle host departure: migrate to participant who has been in room longest
      let newHostInfo = null;
      if (leavingParticipant.isHost && runtime.participants.size > 0) {
        let longestParticipant = null;
        for (const p of runtime.participants.values()) {
          if (!longestParticipant || p.joinedAt < longestParticipant.joinedAt) {
            longestParticipant = p;
          }
        }
        if (longestParticipant) {
          longestParticipant.isHost = true;
          newHostInfo = {
            socketId: longestParticipant.socketId,
            userId: longestParticipant.userId,
            username: longestParticipant.username
          };
          io.to(upperCode).emit('room:host-migrated', newHostInfo);
        }
      }

      // Notify remaining peers
      io.to(upperCode).emit('room:user-left', {
        socketId: socket.id,
        username: leavingParticipant.username,
        newHost: newHostInfo
      });

      // If room is empty, initiate grace period timer before removing
      if (runtime.participants.size === 0) {
        runtime.emptyRoomTimer = setTimeout(() => {
          const checkRuntime = Store.getRuntimeRoom(upperCode);
          if (checkRuntime && checkRuntime.participants.size === 0) {
            Store.removeRuntimeRoom(upperCode);
            console.log(`[Room] Room ${upperCode} closed after grace period.`);
          }
        }, 60000); // 60s grace period
        if (runtime.emptyRoomTimer && typeof runtime.emptyRoomTimer.unref === 'function') {
          runtime.emptyRoomTimer.unref();
        }
      }
    }
  });
};

module.exports = setupSocketHandler;
