import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../utils/api';

export const useWebRTC = ({ socket, roomCode, selfParticipant, participants, activeScreenSharer }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { [socketId]: MediaStream }
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [hiddenVideoTiles, setHiddenVideoTiles] = useState({}); // { [socketId]: boolean }
  const [mediaError, setMediaError] = useState(null);

  const peerConnections = useRef({}); // { [socketId]: RTCPeerConnection }
  const screenSendersRef = useRef({}); // { [socketId]: RTCRtpSender }
  const pendingCandidates = useRef({}); // { [socketId]: RTCIceCandidateInit[] }
  const iceServersRef = useRef([{ urls: 'stun:stun.l.google.com:19302' }]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});

  // Keep remoteStreamsRef synchronized
  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  // Load ICE servers configuration
  useEffect(() => {
    if (!roomCode) return;
    api.getIceServers(roomCode)
      .then((servers) => {
        if (servers && servers.length) {
          iceServersRef.current = servers;
        }
      })
      .catch((err) => console.warn('Using default STUN server:', err.message));
  }, [roomCode]);

  // Initialize local user camera & microphone
  useEffect(() => {
    let isMounted = true;

    const startLocalMedia = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported. Please use HTTPS or localhost.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaError(null);
      } catch (err) {
        console.warn('Microphone/Camera access error:', err.name, err.message);
        setMediaError(
          err.name === 'NotAllowedError'
            ? 'Camera/microphone permission was denied. You can still watch the movie, view screen shares, and use chat.'
            : 'Could not access camera or microphone: ' + err.message
        );
      }
    };

    startLocalMedia();

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
    };
  }, []);

  // Helper to create RTCPeerConnection
  const createPeerConnection = useCallback((peerSocketId, isInitiator) => {
    if (peerConnections.current[peerSocketId]) {
      return peerConnections.current[peerSocketId];
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 2
    });

    peerConnections.current[peerSocketId] = pc;
    pendingCandidates.current[peerSocketId] = [];

    // Add local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Add local screen share track if already active
    if (screenStreamRef.current) {
      const screenTrack = screenStreamRef.current.getVideoTracks()[0];
      if (screenTrack) {
        const sender = pc.addTrack(screenTrack, screenStreamRef.current);
        screenSendersRef.current[peerSocketId] = sender;
      }
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:signal', {
          toSocketId: peerSocketId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate
          }
        });
      }
    };

    // Track handler
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      const track = event.track;

      const isScreen =
        (activeScreenSharer?.streamId && incomingStream.id === activeScreenSharer.streamId) ||
        (activeScreenSharer?.socketId === peerSocketId && track.kind === 'video' && remoteStreamsRef.current[peerSocketId]?.getVideoTracks().length > 0) ||
        (incomingStream.id && incomingStream.id.toLowerCase().includes('screen')) ||
        (track.label && /screen|display|window|monitor|tab/i.test(track.label));

      if (isScreen) {
        setRemoteScreenStream(incomingStream);
      } else {
        setRemoteStreams((prev) => {
          const existing = prev[peerSocketId];
          if (existing) {
            if (!existing.getTracks().some((t) => t.id === track.id)) {
              existing.addTrack(track);
            }
            return { ...prev };
          }
          return { ...prev, [peerSocketId]: incomingStream };
        });
      }

      track.onended = () => {
        if (isScreen) {
          setRemoteScreenStream(null);
        }
      };
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch (e) {}
      }
    };

    // If initiator, create and send offer
    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (socket) {
            socket.emit('webrtc:signal', {
              toSocketId: peerSocketId,
              signal: {
                type: 'offer',
                sdp: pc.localDescription
              }
            });
          }
        })
        .catch((err) => console.error('Create offer error:', err));
    }

    return pc;
  }, [socket, activeScreenSharer]);

  // Mesh connection management: connect to other participants
  useEffect(() => {
    if (!socket || !selfParticipant) return;

    participants.forEach((peer) => {
      if (peer.socketId === selfParticipant.socketId) return;

      if (!peerConnections.current[peer.socketId]) {
        // The newly joined user initiates the offer to existing peers
        const shouldInitiate = selfParticipant.joinedAt > peer.joinedAt;
        createPeerConnection(peer.socketId, shouldInitiate);
      }
    });

    // Cleanup peers who left
    Object.keys(peerConnections.current).forEach((peerSocketId) => {
      const exists = participants.some((p) => p.socketId === peerSocketId);
      if (!exists) {
        try {
          peerConnections.current[peerSocketId].close();
        } catch (e) {}
        delete peerConnections.current[peerSocketId];
        delete pendingCandidates.current[peerSocketId];
        delete screenSendersRef.current[peerSocketId];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerSocketId];
          return next;
        });
      }
    });
  }, [participants, selfParticipant, socket, createPeerConnection]);

  // Clean remote screen stream if active sharer stops
  useEffect(() => {
    if (!activeScreenSharer) {
      setRemoteScreenStream(null);
    }
  }, [activeScreenSharer]);

  // WebRTC Signal Listener
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({ fromSocketId, signal }) => {
      let pc = peerConnections.current[fromSocketId];

      if (!pc) {
        pc = createPeerConnection(fromSocketId, false);
      }

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process queued ICE candidates
          if (pendingCandidates.current[fromSocketId]) {
            for (const cand of pendingCandidates.current[fromSocketId]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidates.current[fromSocketId] = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('webrtc:signal', {
            toSocketId: fromSocketId,
            signal: {
              type: 'answer',
              sdp: pc.localDescription
            }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          if (pendingCandidates.current[fromSocketId]) {
            for (const cand of pendingCandidates.current[fromSocketId]) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidates.current[fromSocketId] = [];
          }
        } else if (signal.type === 'ice-candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            if (!pendingCandidates.current[fromSocketId]) {
              pendingCandidates.current[fromSocketId] = [];
            }
            pendingCandidates.current[fromSocketId].push(signal.candidate);
          }
        }
      } catch (err) {
        console.error('Signal handling error:', err);
      }
    };

    socket.on('webrtc:signal', handleSignal);

    return () => {
      socket.off('webrtc:signal', handleSignal);
    };
  }, [socket, createPeerConnection]);

  // Audio mute/unmute
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioEnabled;
        audioTracks.forEach((t) => (t.enabled = nextState));
        setAudioEnabled(nextState);
        return nextState;
      }
    }
    return audioEnabled;
  }, [audioEnabled]);

  // Video on/off
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoEnabled;
        videoTracks.forEach((t) => (t.enabled = nextState));
        setVideoEnabled(nextState);
        return nextState;
      }
    }
    return videoEnabled;
  }, [videoEnabled]);

  // Stop Screen Share implementation
  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);
    setIsScreenSharing(false);

    if (socket) {
      socket.emit('screenshare:stop');
    }

    // Remove screen track from peer connections and renegotiate
    Object.entries(peerConnections.current).forEach(async ([peerSocketId, pc]) => {
      const sender = screenSendersRef.current[peerSocketId];
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch (e) {}
        delete screenSendersRef.current[peerSocketId];
      }

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (socket) {
          socket.emit('webrtc:signal', {
            toSocketId: peerSocketId,
            signal: {
              type: 'offer',
              sdp: pc.localDescription
            }
          });
        }
      } catch (e) {
        console.warn('Renegotiation after screen removal error:', e);
      }
    });
  }, [socket]);

  // Start Screen Share implementation
  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported by your browser or requires a secure HTTPS context.');
      }

      // Check mobile detection
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        throw new Error('Screen sharing cannot be initiated on mobile browsers. You can still view shared screens.');
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });

      const screenVideoTrack = displayStream.getVideoTracks()[0];
      if (!screenVideoTrack) {
        throw new Error('No video track received from screen share.');
      }

      // Listen for browser's native "Stop Sharing" button
      screenVideoTrack.onended = () => {
        stopScreenShare();
      };

      screenStreamRef.current = displayStream;
      setLocalScreenStream(displayStream);
      setIsScreenSharing(true);

      if (socket) {
        socket.emit('screenshare:start', { streamId: displayStream.id });
      }

      // Add screen track to all peer connections and renegotiate
      Object.entries(peerConnections.current).forEach(async ([peerSocketId, pc]) => {
        try {
          const sender = pc.addTrack(screenVideoTrack, displayStream);
          screenSendersRef.current[peerSocketId] = sender;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:signal', {
            toSocketId: peerSocketId,
            signal: {
              type: 'offer',
              sdp: pc.localDescription
            }
          });
        } catch (err) {
          console.error('Failed to renegotiate screen track:', err);
        }
      });

      return true;
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        alert(err.message || 'Screen sharing failed.');
      }
      return false;
    }
  }, [socket, stopScreenShare]);

  // Independent Participant Video Tile Hiding (Critical Feature)
  // Local only: does not disconnect user or mute audio!
  const toggleHideParticipantVideo = useCallback((socketId) => {
    setHiddenVideoTiles((prev) => ({
      ...prev,
      [socketId]: !prev[socketId]
    }));
  }, []);

  return {
    localStream,
    remoteStreams,
    remoteScreenStream,
    localScreenStream,
    isScreenSharing,
    audioEnabled,
    videoEnabled,
    hiddenVideoTiles,
    mediaError,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    toggleHideParticipantVideo
  };
};
