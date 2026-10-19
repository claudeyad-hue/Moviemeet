import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);
const SERVER_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? 'https://moviemeet.onrender.com' : 'http://localhost:5000');

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [selfParticipant, setSelfParticipant] = useState(null);
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentTime: 0,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    hostControlsOnly: false,
    lastUpdated: Date.now()
  });
  const [activeScreenSharer, setActiveScreenSharer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [roomError, setRoomError] = useState(null);

  const socketRef = useRef(null);
  const currentRoomCodeRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const s = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      setIsConnected(true);
      setRoomError(null);
      // Auto re-join room after network reconnection (e.g. mobile lock/unlock or Wi-Fi to cellular switch)
      if (currentRoomCodeRef.current) {
        s.emit('room:join', { roomCode: currentRoomCodeRef.current });
      }
    });

    s.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('Socket disconnected:', reason);
    });

    s.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
      setRoomError(err.message);
    });

    // Room joined acknowledgment
    s.on('room:joined', (data) => {
      setRoomData({
        roomCode: data.roomCode,
        roomName: data.roomName
      });
      setSelfParticipant(data.self);
      setParticipants(data.participants);
      if (data.playback) {
        setPlaybackState(data.playback);
      }
      if (data.activeScreenSharer) {
        setActiveScreenSharer({ socketId: data.activeScreenSharer });
      } else {
        setActiveScreenSharer(null);
      }
      setRoomError(null);
    });

    // Another user joined
    s.on('room:user-joined', ({ participant }) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === participant.socketId);
        if (exists) return prev;
        return [...prev, participant];
      });
    });

    // User left
    s.on('room:user-left', ({ socketId, newHost }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      if (activeScreenSharer?.socketId === socketId) {
        setActiveScreenSharer(null);
      }
      if (newHost) {
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === newHost.socketId ? { ...p, isHost: true } : p))
        );
        setSelfParticipant((prev) =>
          prev && prev.socketId === newHost.socketId ? { ...prev, isHost: true } : prev
        );
      }
    });

    // Host migrated
    s.on('room:host-migrated', (newHost) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === newHost.socketId ? { ...p, isHost: true } : { ...p, isHost: false }))
      );
      setSelfParticipant((prev) =>
        prev && prev.socketId === newHost.socketId ? { ...prev, isHost: true } : { ...prev, isHost: false }
      );
    });

    // Media status changed for a peer (mic / cam)
    s.on('media:status-changed', ({ socketId, audioEnabled, videoEnabled }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, audioEnabled, videoEnabled } : p))
      );
    });

    // Screen sharing started/stopped
    s.on('screenshare:started', ({ socketId, username, streamId }) => {
      setActiveScreenSharer({ socketId, username, streamId });
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isScreenSharing: true } : p))
      );
    });

    s.on('screenshare:stopped', ({ socketId }) => {
      setActiveScreenSharer((prev) => (prev?.socketId === socketId ? null : prev));
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isScreenSharing: false } : p))
      );
    });

    // Screen share error
    s.on('screenshare:error', ({ message }) => {
      alert(message);
    });

    // Synchronized playback updates
    s.on('playback:sync', (syncPayload) => {
      if (syncPayload.state) {
        setPlaybackState(syncPayload.state);
      }
    });

    s.on('playback:error', ({ message }) => {
      alert(message);
    });

    // Chat message received
    s.on('chat:message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Reaction received
    s.on('room:reaction', (reaction) => {
      setReactions((prev) => [...prev.slice(-25), reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 3500);
    });

    // Room errors
    s.on('room:error', ({ message }) => {
      setRoomError(message);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinRoom = useCallback(
    (roomCode) => {
      currentRoomCodeRef.current = roomCode;
      if (socketRef.current) {
        socketRef.current.emit('room:join', { roomCode });
      }
    },
    []
  );

  const leaveRoom = useCallback(() => {
    currentRoomCodeRef.current = null;
    if (socketRef.current) {
      socketRef.current.emit('room:leave');
    }
    setRoomData(null);
    setParticipants([]);
    setSelfParticipant(null);
    setActiveScreenSharer(null);
    setMessages([]);
  }, []);

  const sendPlaybackAction = useCallback(
    (type, data = {}) => {
      if (socketRef.current) {
        socketRef.current.emit('playback:action', { type, ...data });
      }
    },
    []
  );

  const requestPlaybackSync = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('playback:request-sync');
    }
  }, []);

  const startScreenShare = useCallback((streamId) => {
    if (socketRef.current) {
      socketRef.current.emit('screenshare:start', { streamId });
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('screenshare:stop');
    }
  }, []);

  const sendChatMessage = useCallback(
    (text) => {
      if (socketRef.current && text.trim()) {
        socketRef.current.emit('chat:message', { text: text.trim() });
      }
    },
    []
  );

  const updateMediaStatus = useCallback(
    (audioEnabled, videoEnabled) => {
      if (socketRef.current) {
        socketRef.current.emit('media:toggle', { audioEnabled, videoEnabled });
      }
    },
    []
  );

  const sendReaction = useCallback((emoji) => {
    if (socketRef.current && emoji) {
      socketRef.current.emit('room:reaction', { emoji });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        roomData,
        participants,
        selfParticipant,
        playbackState,
        activeScreenSharer,
        messages,
        reactions,
        roomError,
        joinRoom,
        leaveRoom,
        sendPlaybackAction,
        requestPlaybackSync,
        startScreenShare,
        stopScreenShare,
        sendChatMessage,
        sendReaction,
        updateMediaStatus
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
