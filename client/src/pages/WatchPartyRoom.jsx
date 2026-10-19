import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import { Navbar } from '../components/Navbar';
import { MoviePlayer } from '../components/MoviePlayer';
import { ScreenShareStage } from '../components/ScreenShareStage';
import { ParticipantTiles } from '../components/ParticipantTiles';
import { MeetingToolbar } from '../components/MeetingToolbar';
import { ChatPanel } from '../components/ChatPanel';
import { VideoSourceModal } from '../components/VideoSourceModal';
import { ShareRoomModal } from '../components/ShareRoomModal';
import { api } from '../utils/api';
import { AlertCircle, Lock, Loader2, Sparkles } from 'lucide-react';

export const WatchPartyRoom = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const upperCode = (code || '').toUpperCase();

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
    joinRoom,
    leaveRoom,
    sendPlaybackAction,
    requestPlaybackSync,
    sendChatMessage,
    sendReaction,
    updateMediaStatus
  } = useSocket();

  // Local state
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [subtitlesUrl, setSubtitlesUrl] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [guestDisplayName, setGuestDisplayName] = useState('');
  const [joining, setJoining] = useState(true);
  const [joinError, setJoinError] = useState(null);
  const lastMsgCountRef = useRef(0);

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

  // Check room status and authentication on mount
  useEffect(() => {
    let isCancelled = false;

    const verifyAndJoin = async () => {
      setJoining(true);
      setJoinError(null);

      try {
        // Fetch public room metadata
        const info = await api.getRoomInfo(upperCode);
        if (isCancelled) return;
        setRoomInfo(info);

        if (info.hasPassword) {
          setPasswordRequired(true);
        }

        // If not authenticated, prompt or prepare guest
        if (!isAuthenticated) {
          setJoining(false);
          return;
        }

        // If password is required and not yet provided
        if (info.hasPassword && !roomPassword) {
          setJoining(false);
          return;
        }

        // Verify join authorization
        await api.joinRoom(upperCode, roomPassword || undefined);

        // Join socket room
        joinRoom(upperCode);
        setJoining(false);
      } catch (err) {
        if (isCancelled) return;
        setJoinError(err.message || 'Could not connect to room');
        setJoining(false);
      }
    };

    verifyAndJoin();

    return () => {
      isCancelled = true;
    };
  }, [upperCode, isAuthenticated]);

  // Handle guest quick-login if visiting directly via invite link
  const handleGuestJoinSubmit = async (e) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    try {
      const name = guestDisplayName.trim() || `Viewer_${Math.floor(1000 + Math.random() * 9000)}`;
      await loginGuest(name);

      await api.joinRoom(upperCode, roomPassword || undefined);
      joinRoom(upperCode);
      setPasswordRequired(false);
    } catch (err) {
      setJoinError(err.message || 'Failed to join watch party');
    } finally {
      setJoining(false);
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
    const link = `${window.location.origin}/room/${upperCode}`;
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

  // Password / Guest Join Prompt Modal
  if (!isAuthenticated || (passwordRequired && !roomData)) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md cinematic-glass-dark p-6 rounded-2xl border border-slate-700/80 shadow-cinematic text-center">
          <div className="w-12 h-12 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            Join {roomInfo?.name || 'Watch Party'}
          </h2>
          <p className="text-xs text-slate-400 mb-6 font-mono">Room Code: {upperCode}</p>

          {joinError && (
            <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
              {joinError}
            </div>
          )}

          <form onSubmit={handleGuestJoinSubmit} className="space-y-4 text-left">
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
              disabled={joining}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl shadow-glow transition-all"
            >
              {joining ? 'Entering Room...' : 'Join Watch Party'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading Room State
  if (joining && !roomData) {
    return (
      <div className="min-h-screen bg-charcoal-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-300">Entering Watch Party {upperCode}...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-charcoal-950 flex flex-col overflow-hidden select-none">
      {/* Top Navbar */}
      <Navbar
        roomCode={upperCode}
        roomName={roomData?.roomName || roomInfo?.name}
        participantCount={participants.length}
        isConnected={isConnected}
        onCopyInvite={() => setIsShareModalOpen(true)}
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
      <div className="flex-1 flex overflow-hidden p-3 gap-3">
        {/* Central Stage: Movie Player or Screen Share View */}
        <div className="flex-1 flex flex-col min-w-0 h-full gap-3">
          <div className="flex-1 relative w-full h-full min-h-0">
            {activeScreenSharer ? (
              <ScreenShareStage
                activeScreenSharer={activeScreenSharer}
                selfParticipant={selfParticipant}
                isScreenSharing={isScreenSharing}
                localScreenStream={localScreenStream}
                remoteScreenStream={remoteScreenStream}
                onStopScreenShare={stopScreenShare}
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

          {/* Bottom Participant Video Strip */}
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
        </div>

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
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onSendReaction={sendReaction}
        onLeaveRoom={handleLeaveRoom}
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
