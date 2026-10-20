import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { Navbar } from '../components/Navbar';
import { MoviePlayer } from '../components/MoviePlayer';
import { ScreenShareStage } from '../components/ScreenShareStage';
import { ParticipantTiles } from '../components/ParticipantTiles';
import { VideoCallGrid } from '../components/VideoCallGrid';
import { MeetingToolbar } from '../components/MeetingToolbar';
import { ChatPanel } from '../components/ChatPanel';
import { VideoSourceModal } from '../components/VideoSourceModal';
import { ShareRoomModal } from '../components/ShareRoomModal';
import { api } from '../utils/api';
import { AlertCircle, Lock, Loader2, Sparkles, RefreshCw, Home, ArrowLeft } from 'lucide-react';

export const WatchPartyRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const upperCode = (code || '').toUpperCase().trim();

  const { user, loginGuest, isAuthenticated } = useAuth();
  const {
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
    clearRoomError,
    joinRoom,
    leaveRoom,
    sendPlaybackAction,
    requestPlaybackSync,
    sendChatMessage,
    sendReaction,
    updateMediaStatus
  } = useSocket();

  // Local state
  const [viewMode, setViewMode] = useState('cinema'); // 'cinema' | 'grid'
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [subtitlesUrl, setSubtitlesUrl] = useState('');

  // Room verification & join flow states
  const [roomInfo, setRoomInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [roomPassword, setRoomPassword] = useState(location.state?.password || '');
  const [guestDisplayName, setGuestDisplayName] = useState(user?.username || '');
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinTimedOut, setJoinTimedOut] = useState(false);

  const lastMsgCountRef = useRef(0);
  const hasAutoJoinedRef = useRef(false);

  useEffect(() => {
    if (!isChatOpen && messages.length > lastMsgCountRef.current) {
      setUnreadCount((prev) => prev + (messages.length - lastMsgCountRef.current));
    }
    lastMsgCountRef.current = messages.length;
  }, [messages, isChatOpen]);

  const handleToggleChat = () => {
    const nextState = !isChatOpen;
    setIsChatOpen(nextState);
    if (nextState) {
      setUnreadCount(0);
    }
  };

  // WebRTC hook integration
  const {
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
    retryMedia
  } = useWebRTC({
    socket,
    roomCode: upperCode,
    selfParticipant,
    participants,
    activeScreenSharer
  });

  // Step 1: Fetch room metadata on mount or when upperCode changes
  const fetchRoomInfo = useCallback(async () => {
    if (!upperCode) return;
    setLoadingInfo(true);
    setInfoError(null);

    try {
      const info = await api.getRoomInfo(upperCode);
      setRoomInfo(info);
      if (info.hasPassword) {
        setPasswordRequired(true);
      }
    } catch (err) {
      console.warn('Failed to fetch room info:', err.message);
      setInfoError(err.message || 'Room not found or server is unreachable');
    } finally {
      setLoadingInfo(false);
    }
  }, [upperCode]);

  useEffect(() => {
    fetchRoomInfo();
  }, [fetchRoomInfo]);

  // Step 2: Attempt joining room with API verification and socket registration
  const attemptJoin = useCallback(async (targetPassword) => {
    setIsSubmittingJoin(true);
    setJoinError(null);
    setJoinTimedOut(false);
    if (clearRoomError) clearRoomError();

    try {
      const pwd = targetPassword !== undefined ? targetPassword : roomPassword;
      await api.joinRoom(upperCode, pwd || undefined);
      joinRoom(upperCode);
    } catch (err) {
      console.warn('Join error:', err.message);
      setJoinError(err.message || 'Could not connect to room');
      setIsSubmittingJoin(false);
    }
  }, [upperCode, roomPassword, joinRoom, clearRoomError]);

  // Step 3: Auto-join if user is already authenticated and no password is required (or password is provided)
  useEffect(() => {
    if (roomData || hasAutoJoinedRef.current || !roomInfo || loadingInfo) return;

    if (isAuthenticated) {
      if (!roomInfo.hasPassword || (roomPassword && roomPassword.trim())) {
        hasAutoJoinedRef.current = true;
        attemptJoin(roomPassword);
      }
    }
  }, [roomInfo, loadingInfo, isAuthenticated, roomPassword, roomData, attemptJoin]);

  // Step 4: Handle form submission for guest name and/or room password
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setJoinError(null);
    if (clearRoomError) clearRoomError();
    setIsSubmittingJoin(true);

    try {
      if (!isAuthenticated) {
        const name = guestDisplayName.trim() || `Viewer_${Math.floor(1000 + Math.random() * 9000)}`;
        await loginGuest(name);
      }
      await attemptJoin(roomPassword);
    } catch (err) {
      setJoinError(err.message || 'Failed to enter watch party');
      setIsSubmittingJoin(false);
    }
  };

  // Step 5: Join timeout guard - never leave user stuck on an infinite loading screen
  useEffect(() => {
    if (roomData) {
      setIsSubmittingJoin(false);
      setJoinTimedOut(false);
      return;
    }

    if (isSubmittingJoin) {
      const timer = setTimeout(() => {
        if (!roomData) {
          setJoinTimedOut(true);
          setIsSubmittingJoin(false);
          setJoinError('Connection timed out while joining watch party. The real-time server may be waking up or your connection was interrupted.');
        }
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [isSubmittingJoin, roomData]);

  // Reset joining state when roomData successfully arrives
  useEffect(() => {
    if (roomData) {
      setIsSubmittingJoin(false);
      setJoinError(null);
      setJoinTimedOut(false);
    }
  }, [roomData]);

  // Retry action for users
  const handleRetry = () => {
    setJoinError(null);
    setJoinTimedOut(false);
    if (clearRoomError) clearRoomError();

    if (infoError) {
      fetchRoomInfo();
    } else {
      attemptJoin(roomPassword);
    }
  };

  // Broadcast mic/camera state to socket peers
  const handleToggleAudio = async () => {
    const nextState = await toggleAudio();
    updateMediaStatus(nextState, videoEnabled);
  };

  const handleToggleVideo = async () => {
    const nextState = await toggleVideo();
    updateMediaStatus(audioEnabled, nextState);
  };

  // Video source change
  const handleSelectVideo = (videoUrl) => {
    sendPlaybackAction('change-video', { videoUrl });
  };

  const handleToggleHostControls = (hostControlsOnly) => {
    sendPlaybackAction('toggle-host-controls', { hostControlsOnly });
  };

  // Copy invitation link
  const handleCopyInvite = () => {
    const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const link = `${window.location.origin}${baseUrl}/room/${upperCode}`;
    navigator.clipboard.writeText(link);
  };

  // Leave room
  const handleLeaveRoom = () => {
    if (window.confirm('Are you sure you want to leave this watch party?')) {
      stopScreenShare();
      leaveRoom();
      navigate('/');
    }
  };

  // UI STATE 1: Initial room info loading
  if (loadingInfo && !roomData) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4 text-center select-none">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-200 mb-1">
          Finding Watch Party {upperCode}...
        </p>
        <p className="text-xs text-slate-400">
          Checking room status & server availability...
        </p>
      </div>
    );
  }

  // UI STATE 2: Room not found or server info error
  if (infoError && !roomData) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="w-full max-w-md cinematic-glass-dark p-6 rounded-2xl border border-red-500/40 shadow-cinematic">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            Watch Party Not Found
          </h2>
          <p className="text-xs text-slate-400 font-mono mb-3">Room: {upperCode}</p>
          <div className="p-3 mb-5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 leading-relaxed">
            {infoError}
          </div>
          <div className="flex gap-2.5 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-glow transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 bg-charcoal-800 hover:bg-charcoal-750 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UI STATE 3: Prompt for Display Name and/or Room Password
  const needsUserInput = !isAuthenticated || (passwordRequired && !roomPassword && !isSubmittingJoin);

  if (needsUserInput && !roomData) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md cinematic-glass-dark p-6 rounded-2xl border border-slate-700/80 shadow-cinematic text-center">
          <div className="w-12 h-12 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-brand-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            Join {roomInfo?.name || 'Watch Party'}
          </h2>
          <p className="text-xs text-slate-400 mb-5 font-mono">Room Code: {upperCode}</p>

          {(joinError || roomError) && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 text-left">
              {joinError || roomError}
            </div>
          )}

          <form onSubmit={handleModalSubmit} className="space-y-4 text-left">
            {!isAuthenticated && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CinemaGuest"
                  value={guestDisplayName}
                  onChange={(e) => setGuestDisplayName(e.target.value)}
                  className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>
            )}

            {passwordRequired && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Room Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter room password"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingJoin}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-glow transition-all flex items-center justify-center gap-2"
            >
              {isSubmittingJoin ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Entering Room...</span>
                </>
              ) : (
                'Join Watch Party'
              )}
            </button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // UI STATE 4: Join Error or Timeout Screen
  if (!roomData && (joinError || roomError || joinTimedOut)) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="w-full max-w-md cinematic-glass-dark p-6 rounded-2xl border border-red-500/40 shadow-cinematic">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-300 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            Could Not Connect to Watch Party
          </h2>
          <p className="text-xs text-slate-400 font-mono mb-3">Room: {upperCode}</p>
          <div className="p-3 mb-5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 leading-relaxed">
            {joinError || roomError || 'Connection timed out while joining watch party.'}
          </div>
          <div className="flex gap-2.5 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-glow transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2.5 bg-charcoal-800 hover:bg-charcoal-750 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // UI STATE 5: Active connecting / loading screen (while socket receives room:joined metadata)
  if (!roomData) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4 text-center select-none">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-200 mb-1">
          Entering Watch Party {upperCode}...
        </p>
        <p className="text-xs text-slate-400 mb-5">
          Connecting to real-time sync server & participants...
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-3.5 py-1.5 rounded-lg bg-charcoal-850 hover:bg-charcoal-800 text-slate-400 hover:text-slate-200 text-xs border border-slate-800 transition-colors"
        >
          Cancel & Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen bg-charcoal-950 flex flex-col overflow-hidden select-none">
      {/* Top Navbar */}
      <Navbar
        roomCode={upperCode}
        roomName={roomData?.roomName || roomInfo?.name}
        participantCount={participants.length}
        isConnected={isConnected}
        onCopyInvite={() => setIsShareModalOpen(true)}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
      />

      {/* Media Warning Banner if permission denied */}
      {mediaError && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{mediaError}</span>
          </div>
          <button
            onClick={retryMedia}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors ml-3 cursor-pointer"
          >
            Retry Permissions
          </button>
        </div>
      )}

      {/* Main Viewing Stage & Panels */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3 min-h-0">
        {/* Central Stage: Movie Player, Video Call Grid, or Screen Share View */}
        <div className="flex-1 relative w-full h-full min-h-0 min-w-0">
          {activeScreenSharer ? (
            <ScreenShareStage
              activeScreenSharer={activeScreenSharer}
              selfParticipant={selfParticipant}
              isScreenSharing={isScreenSharing}
              localScreenStream={localScreenStream}
              remoteScreenStream={remoteScreenStream}
              onStopScreenShare={stopScreenShare}
            />
          ) : viewMode === 'grid' ? (
            <VideoCallGrid
              selfParticipant={selfParticipant}
              participants={participants}
              localStream={localStream}
              remoteStreams={remoteStreams}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              hiddenVideoTiles={hiddenVideoTiles}
              onToggleHideParticipantVideo={toggleHideParticipantVideo}
              onSwitchToCinema={() => setViewMode('cinema')}
              playbackState={playbackState}
            />
          ) : (
            <MoviePlayer
              playbackState={playbackState}
              selfParticipant={selfParticipant}
              sendPlaybackAction={sendPlaybackAction}
              requestPlaybackSync={requestPlaybackSync}
              onOpenSourceModal={() => setIsSourceModalOpen(true)}
              isFocusMode={isFocusMode}
              subtitlesUrl={subtitlesUrl}
              reactions={reactions}
            />
          )}
        </div>

        {/* Side/Bottom Participant Video Strip (Shown in Cinema Mode) */}
        {viewMode === 'cinema' && !activeScreenSharer && (
          <ParticipantTiles
            selfParticipant={selfParticipant}
            participants={participants}
            localStream={localStream}
            remoteStreams={remoteStreams}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            hiddenVideoTiles={hiddenVideoTiles}
            onToggleHideParticipantVideo={toggleHideParticipantVideo}
            isFocusMode={isFocusMode}
          />
        )}

        {/* Collapsible Chat Sidebar */}
        <ChatPanel
          messages={messages}
          selfParticipant={selfParticipant}
          onSendMessage={sendChatMessage}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </div>

      {/* Bottom Meeting Toolbar */}
      <MeetingToolbar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        activeScreenSharer={activeScreenSharer}
        isFocusMode={isFocusMode}
        isChatOpen={isChatOpen}
        unreadCount={unreadCount}
        onToggleAudio={handleToggleAudio}
        onToggleVideo={handleToggleVideo}
        onStartScreenShare={startScreenShare}
        onStopScreenShare={stopScreenShare}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
        onToggleChat={handleToggleChat}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onSendReaction={sendReaction}
        onLeaveRoom={handleLeaveRoom}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
      />

      {/* Video Source Switcher Modal */}
      <VideoSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        currentVideoUrl={playbackState?.videoUrl}
        subtitlesUrl={subtitlesUrl}
        isHost={!!selfParticipant?.isHost}
        hostControlsOnly={!!playbackState?.hostControlsOnly}
        onSelectVideo={handleSelectVideo}
        onUpdateSubtitles={setSubtitlesUrl}
        onToggleHostControls={handleToggleHostControls}
      />

      {/* Share Room / QR Code Modal */}
      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomCode={upperCode}
        roomName={roomData?.roomName || roomInfo?.name}
      />
    </div>
  );
};
