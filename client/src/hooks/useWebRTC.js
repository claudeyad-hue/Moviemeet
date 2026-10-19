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
  const screenSendersRef = useRef({}); // { [socketId]: RTCRtpSender[] }
  const pendingCandidates = useRef({}); // { [socketId]: RTCIceCandidateInit[] }
  const iceServersRef = useRef([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers from Metered Open Relay (no signup needed)
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'e8dd65b92c62d5690916054a',
      credential: '3JGnSB/ariXEz5HT'
    },
    {
      urls: 'turn:a.relay.metered.ca:80?transport=tcp',
      username: 'e8dd65b92c62d5690916054a',
      credential: '3JGnSB/ariXEz5HT'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'e8dd65b92c62d5690916054a',
      credential: '3JGnSB/ariXEz5HT'
    },
    {
      urls: 'turns:a.relay.metered.ca:443?transport=tcp',
      username: 'e8dd65b92c62d5690916054a',
      credential: '3JGnSB/ariXEz5HT'
    }
  ]);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const activeScreenSharerRef = useRef(activeScreenSharer);
  const screenShareStreamIdsRef = useRef({}); // { [socketId]: streamId }
  const peerScreenStreamsRef = useRef({}); // { [socketId]: MediaStream }
  const makingOfferRef = useRef({}); // { [socketId]: boolean }

  // Keep references updated
  useEffect(() => {
    remoteStreamsRef.current = remoteStreams;
  }, [remoteStreams]);

  useEffect(() => {
    activeScreenSharerRef.current = activeScreenSharer;
    if (!activeScreenSharer) {
      setRemoteScreenStream(null);
    } else if (activeScreenSharer.socketId && peerScreenStreamsRef.current[activeScreenSharer.socketId]) {
      setRemoteScreenStream(peerScreenStreamsRef.current[activeScreenSharer.socketId]);
    }
  }, [activeScreenSharer]);

  // Load ICE servers configuration from backend
  useEffect(() => {
    if (!roomCode) return;
    api.getIceServers(roomCode)
      .then((servers) => {
        if (servers && servers.length) {
          iceServersRef.current = servers;
        }
      })
      .catch((err) => console.warn('Using default STUN servers:', err.message));
  }, [roomCode]);

  // Attach local camera/mic tracks to a specific peer connection
  const attachLocalTracksToPeer = useCallback((pc) => {
    if (!localStreamRef.current) return;
    const existingSenders = pc.getSenders();

    localStreamRef.current.getTracks().forEach((track) => {
      const existingSender = existingSenders.find(
        (s) => s.track && s.track.kind === track.kind
      );
      if (existingSender) {
        if (existingSender.track !== track) {
          existingSender.replaceTrack(track).catch((err) =>
            console.warn('Error replacing track on peer:', err)
          );
        }
      } else {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (err) {
          console.warn('Error adding track to peer:', err);
        }
      }
    });
  }, []);

  // Initialize local user camera & microphone with graceful fallback
  const startLocalMedia = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported. Please use HTTPS or localhost.');
      }

      let stream = null;
      let hasAudio = false;
      let hasVideo = false;

      // 1. First attempt: both video and audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        hasAudio = true;
        hasVideo = true;
      } catch (bothErr) {
        console.warn('Both video & audio failed, trying audio-only fallback:', bothErr.name);
        // 2. Second attempt: audio only (common if no webcam or webcam is in use by another app)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false
          });
          hasAudio = true;
          hasVideo = false;
        } catch (audioErr) {
          console.warn('Audio-only fallback failed, trying video-only:', audioErr.name);
          // 3. Third attempt: video only (if microphone unavailable)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } },
              audio: false
            });
            hasAudio = false;
            hasVideo = true;
          } catch (allErr) {
            console.warn('All media device requests failed:', allErr);
            throw allErr;
          }
        }
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setAudioEnabled(hasAudio);
      setVideoEnabled(hasVideo);
      setMediaError(null);

      // CRITICAL: Attach the newly acquired tracks to all existing peer connections and renegotiate!
      Object.entries(peerConnections.current).forEach(async ([peerSocketId, pc]) => {
        attachLocalTracksToPeer(pc);
        if (pc.signalingState === 'stable') {
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
          } catch (err) {
            console.warn('Renegotiation after acquiring local media error:', err);
          }
        }
      });
    } catch (err) {
      console.warn('Camera/Microphone access error:', err.name, err.message);
      setAudioEnabled(false);
      setVideoEnabled(false);
      setLocalStream(null);
      localStreamRef.current = null;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMediaError(
          'Camera / microphone access is blocked. Click the padlock 🔒 or tune icon in your browser address bar to allow permissions, then click Retry.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMediaError(
          'No camera or microphone hardware found on your computer. You can still watch movies, view screen shares, and chat.'
        );
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setMediaError(
          'Camera or microphone is currently in use by another app (Zoom, Teams, or another tab). Close the other app and click Retry.'
        );
      } else {
        setMediaError('Could not access camera or microphone: ' + err.message);
      }
    }
  }, [socket, attachLocalTracksToPeer]);

  // Start local media on mount
  useEffect(() => {
    startLocalMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
    };
  }, [startLocalMedia]);

  // Create an RTCPeerConnection for a remote peer
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
    screenSendersRef.current[peerSocketId] = [];
    makingOfferRef.current[peerSocketId] = false;

    // Add local media tracks if available
    attachLocalTracksToPeer(pc);

    // Add local screen share track if already active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          const sender = pc.addTrack(track, screenStreamRef.current);
          screenSendersRef.current[peerSocketId].push(sender);
        } catch (e) {
          console.warn('Error adding initial screen track:', e);
        }
      });
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

    // Track handler (Incoming remote camera or screen track)
    pc.ontrack = (event) => {
      const incomingStream = event.streams[0] || new MediaStream([event.track]);
      const track = event.track;

      // Determine whether this track belongs to a screen share:
      const knownScreenStreamId =
        activeScreenSharerRef.current?.streamId ||
        screenShareStreamIdsRef.current[peerSocketId];

      const isCurrentSharer =
        activeScreenSharerRef.current?.socketId === peerSocketId;

      const existingCameraStream = remoteStreamsRef.current[peerSocketId];
      const hasCameraVideo =
        existingCameraStream && existingCameraStream.getVideoTracks().length > 0;

      const isScreen =
        (knownScreenStreamId && incomingStream.id === knownScreenStreamId) ||
        (isCurrentSharer && track.kind === 'video' && hasCameraVideo) ||
        (isCurrentSharer && incomingStream.id !== existingCameraStream?.id);

      if (isScreen) {
        peerScreenStreamsRef.current[peerSocketId] = incomingStream;
        setRemoteScreenStream(incomingStream);

        track.onended = () => {
          if (peerScreenStreamsRef.current[peerSocketId] === incomingStream) {
            delete peerScreenStreamsRef.current[peerSocketId];
          }
          setRemoteScreenStream((current) => (current === incomingStream ? null : current));
        };
      } else {
        // Regular Camera / Microphone stream
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

        track.onended = () => {
          setRemoteStreams((prev) => {
            const stream = prev[peerSocketId];
            if (stream) {
              const remaining = stream.getTracks().filter((t) => t.id !== track.id);
              if (remaining.length === 0) {
                const next = { ...prev };
                delete next[peerSocketId];
                return next;
              }
            }
            return prev;
          });
        };
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch (e) {}
      }
    };

    // Initiate offer if designated as initiator
    if (isInitiator) {
      makingOfferRef.current[peerSocketId] = true;
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
        .catch((err) => console.error('Error creating offer:', err))
        .finally(() => {
          makingOfferRef.current[peerSocketId] = false;
        });
    }

    return pc;
  }, [socket, attachLocalTracksToPeer]);

  // Mesh connection management: connect to other room participants
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
        delete peerScreenStreamsRef.current[peerSocketId];
        delete screenShareStreamIdsRef.current[peerSocketId];
        delete makingOfferRef.current[peerSocketId];

        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerSocketId];
          return next;
        });
      }
    });
  }, [participants, selfParticipant, socket, createPeerConnection]);

  // WebRTC Signal Listener (Offers, Answers, and ICE candidates)
  useEffect(() => {
    if (!socket) return;

    const handleSignal = async ({ fromSocketId, signal }) => {
      let pc = peerConnections.current[fromSocketId];
      if (!pc) {
        pc = createPeerConnection(fromSocketId, false);
      }

      try {
        if (signal.type === 'offer') {
          // If offer includes screen share metadata, record it immediately
          if (signal.streamId) {
            screenShareStreamIdsRef.current[fromSocketId] = signal.streamId;
          }

          // Polite peer pattern: resolve offer glare / collision cleanly
          const peer = participants.find((p) => p.socketId === fromSocketId);
          const isPolite = selfParticipant && peer ? selfParticipant.joinedAt > peer.joinedAt : true;
          const offerCollision =
            makingOfferRef.current[fromSocketId] || pc.signalingState !== 'stable';

          if (offerCollision) {
            if (!isPolite) {
              return; // Ignore offer collision if impolite
            }
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch (e) {
              console.warn('Rollback error:', e);
            }
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Drain queued ICE candidates
          if (pendingCandidates.current[fromSocketId]) {
            for (const cand of pendingCandidates.current[fromSocketId]) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {}
            }
            pendingCandidates.current[fromSocketId] = [];
          }

          // Ensure local tracks are attached before answering
          attachLocalTracksToPeer(pc);

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
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

            if (pendingCandidates.current[fromSocketId]) {
              for (const cand of pendingCandidates.current[fromSocketId]) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {}
              }
              pendingCandidates.current[fromSocketId] = [];
            }
          }
        } else if (signal.type === 'ice-candidate' && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.warn('Error adding ICE candidate:', e);
            }
          } else {
            if (!pendingCandidates.current[fromSocketId]) {
              pendingCandidates.current[fromSocketId] = [];
            }
            pendingCandidates.current[fromSocketId].push(signal.candidate);
          }
        }
      } catch (err) {
        console.error('WebRTC signal handling error:', err);
      }
    };

    socket.on('webrtc:signal', handleSignal);

    return () => {
      socket.off('webrtc:signal', handleSignal);
    };
  }, [socket, createPeerConnection, participants, selfParticipant, attachLocalTracksToPeer]);

  // Audio mute/unmute with dynamic track acquisition
  const toggleAudio = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          const nextState = !audioEnabled;
          audioTracks.forEach((t) => (t.enabled = nextState));
          setAudioEnabled(nextState);
          return nextState;
        }
      }

      // If we don't have an audio track yet, request microphone on-demand!
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      if (!newAudioTrack) return false;

      let combined = localStreamRef.current;
      if (!combined) {
        combined = new MediaStream();
        localStreamRef.current = combined;
      }
      combined.addTrack(newAudioTrack);
      setLocalStream(new MediaStream(combined.getTracks()));
      setAudioEnabled(true);
      setMediaError(null);

      // Add track to all active peer connections and renegotiate
      Object.entries(peerConnections.current).forEach(async ([peerId, pc]) => {
        try {
          pc.addTrack(newAudioTrack, combined);
          if (pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (socket) {
              socket.emit('webrtc:signal', {
                toSocketId: peerId,
                signal: { type: 'offer', sdp: pc.localDescription }
              });
            }
          }
        } catch (e) {
          console.warn('Renegotiation after audio add error:', e);
        }
      });
      return true;
    } catch (err) {
      console.warn('Microphone toggle request error:', err);
      setMediaError('Could not activate microphone. Check browser permissions in your address bar.');
      return false;
    }
  }, [audioEnabled, socket]);

  // Video on/off with dynamic track acquisition
  const toggleVideo = useCallback(async () => {
    try {
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        if (videoTracks.length > 0) {
          const nextState = !videoEnabled;
          videoTracks.forEach((t) => (t.enabled = nextState));
          setVideoEnabled(nextState);
          return nextState;
        }
      }

      // If we don't have a video track yet, request camera on-demand!
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } }
      });
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (!newVideoTrack) return false;

      let combined = localStreamRef.current;
      if (!combined) {
        combined = new MediaStream();
        localStreamRef.current = combined;
      }
      combined.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(combined.getTracks()));
      setVideoEnabled(true);
      setMediaError(null);

      // Add track to all active peer connections and renegotiate
      Object.entries(peerConnections.current).forEach(async ([peerId, pc]) => {
        try {
          pc.addTrack(newVideoTrack, combined);
          if (pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (socket) {
              socket.emit('webrtc:signal', {
                toSocketId: peerId,
                signal: { type: 'offer', sdp: pc.localDescription }
              });
            }
          }
        } catch (e) {
          console.warn('Renegotiation after video add error:', e);
        }
      });
      return true;
    } catch (err) {
      console.warn('Camera toggle request error:', err);
      setMediaError('Could not activate camera. Check browser permissions or verify no other app is using the webcam.');
      return false;
    }
  }, [videoEnabled, socket]);

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

    // Remove screen tracks from each peer connection and renegotiate
    Object.entries(peerConnections.current).forEach(async ([peerSocketId, pc]) => {
      const senders = screenSendersRef.current[peerSocketId] || [];
      senders.forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch (e) {}
      });
      screenSendersRef.current[peerSocketId] = [];

      try {
        if (pc.signalingState === 'stable') {
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

      // Notify the room via socket that we started sharing screen with this stream ID
      if (socket) {
        socket.emit('screenshare:start', { streamId: displayStream.id });
      }

      // Add screen tracks (video + optional tab audio) to each peer connection and renegotiate
      Object.entries(peerConnections.current).forEach(async ([peerSocketId, pc]) => {
        try {
          if (!screenSendersRef.current[peerSocketId]) {
            screenSendersRef.current[peerSocketId] = [];
          }

          displayStream.getTracks().forEach((track) => {
            const sender = pc.addTrack(track, displayStream);
            screenSendersRef.current[peerSocketId].push(sender);
          });

          if (pc.signalingState === 'stable') {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:signal', {
              toSocketId: peerSocketId,
              signal: {
                type: 'offer',
                sdp: pc.localDescription,
                isScreenShare: true,
                streamId: displayStream.id
              }
            });
          }
        } catch (err) {
          console.error('Failed to renegotiate screen track with peer:', peerSocketId, err);
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

  // Independent Participant Video Tile Hiding (Local only)
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
    toggleHideParticipantVideo,
    retryMedia: startLocalMedia
  };
};
