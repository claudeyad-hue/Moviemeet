import React, { useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Crown,
  User,
  Film,
  EyeOff,
  Maximize2,
  Volume2
} from 'lucide-react';

export const VideoCallGrid = ({
  selfParticipant,
  participants,
  localStream,
  remoteStreams,
  audioEnabled,
  videoEnabled,
  hiddenVideoTiles,
  onToggleHideParticipantVideo,
  onSwitchToCinema,
  playbackState
}) => {
  // Remote participants list
  const remotePeers = participants.filter((p) => p.socketId !== selfParticipant?.socketId);
  const totalCount = 1 + remotePeers.length;

  // Grid layout class based on participant count
  const getGridClass = () => {
    if (totalCount === 1) return 'grid-cols-1 max-w-3xl';
    if (totalCount === 2) return 'grid-cols-1 md:grid-cols-2 max-w-5xl';
    if (totalCount === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl';
    return 'grid-cols-1 sm:grid-cols-2 max-w-5xl'; // 4 participants -> 2x2
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-3 overflow-hidden select-none">
      {/* Top Floating Bar in Video Call Mode */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-charcoal-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs text-slate-200">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold">Live Video Call</span>
          <span className="text-slate-400">({totalCount} in call)</span>
        </div>

        {/* Quick button to switch back to Cinema Mode */}
        <button
          onClick={onSwitchToCinema}
          className="pointer-events-auto px-3.5 py-1.5 bg-brand-600/90 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-glow transition-all"
          title="Switch to synchronized movie viewing"
        >
          <Film className="w-3.5 h-3.5" />
          <span>Switch to Cinema Mode</span>
        </button>
      </div>

      {/* Main Responsive Video Grid */}
      <div className={`w-full h-full grid ${getGridClass()} gap-3.5 items-center justify-center p-2 pt-12`}>
        {/* Local Participant Card */}
        <div className="relative w-full h-full min-h-[140px] sm:min-h-[220px] max-h-[42vh] sm:max-h-[75vh] rounded-2xl overflow-hidden cinematic-glass-dark border-2 border-brand-500/40 bg-charcoal-900 flex items-center justify-center shadow-cinematic">
          <LocalGridTile
            localStream={localStream}
            selfParticipant={selfParticipant}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
          />
        </div>

        {/* Remote Participants Cards */}
        {remotePeers.map((peer) => {
          const stream = remoteStreams[peer.socketId];
          const isHidden = !!hiddenVideoTiles[peer.socketId];

          return (
            <div
              key={peer.socketId}
              className="relative w-full h-full min-h-[140px] sm:min-h-[220px] max-h-[42vh] sm:max-h-[75vh] rounded-2xl overflow-hidden cinematic-glass-dark border border-slate-700/60 bg-charcoal-900 flex items-center justify-center shadow-cinematic group"
            >
              <RemoteGridTile
                participant={peer}
                stream={stream}
                isHidden={isHidden}
                onToggleHide={onToggleHideParticipantVideo}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Local video tile inside grid
const LocalGridTile = ({ localStream, selfParticipant, audioEnabled, videoEnabled }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {localStream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-xl font-bold shadow-glow-sm">
            {selfParticipant?.username ? selfParticipant.username[0].toUpperCase() : <User className="w-8 h-8" />}
          </div>
          <span className="text-xs font-medium text-slate-300">Camera Off</span>
        </div>
      )}

      {/* Overlay details */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[11px] font-semibold">
            You
          </span>
          {selfParticipant?.isHost && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-400" /> Host
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pointer-events-auto">
          <span className="text-sm font-semibold text-white drop-shadow">
            {selfParticipant?.username || 'You'}
          </span>
          <div className="p-1.5 rounded-lg bg-black/60 text-slate-200">
            {audioEnabled ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
          </div>
        </div>
      </div>
    </div>
  );
};

// Remote video tile inside grid
const RemoteGridTile = ({ participant, stream, isHidden, onToggleHide }) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (stream) {
      if (videoRef.current && !isHidden) {
        videoRef.current.srcObject = stream;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [stream, isHidden]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Hidden audio element always keeps sound flowing */}
      <audio ref={audioRef} autoPlay playsInline />

      {!isHidden && stream && participant.videoEnabled !== false ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
          <div className="w-16 h-16 rounded-full bg-charcoal-750 text-slate-200 flex items-center justify-center text-xl font-bold">
            {participant?.username ? participant.username[0].toUpperCase() : <User className="w-8 h-8" />}
          </div>
          <span className="text-xs font-medium text-slate-400">
            {isHidden ? 'Video Hidden Locally' : 'Camera Off'}
          </span>
        </div>
      )}

      {/* Overlay details */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5">
            {participant.isHost && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> Host
              </span>
            )}
          </div>

          <button
            onClick={() => onToggleHide(participant.socketId)}
            className="px-2.5 py-1 rounded-lg bg-black/60 hover:bg-black/90 text-xs text-slate-200 border border-slate-600/50 flex items-center gap-1.5 transition-colors"
            title={isHidden ? 'Show video' : 'Hide video locally (audio continues)'}
          >
            <EyeOff className="w-3 h-3 text-slate-400" />
            <span>{isHidden ? 'Show video' : 'Hide video'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white drop-shadow truncate max-w-[180px]">
            {participant.username}
          </span>
          <div className="p-1.5 rounded-lg bg-black/60 text-slate-200">
            {participant.audioEnabled !== false ? (
              <Mic className="w-4 h-4 text-emerald-400" />
            ) : (
              <MicOff className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
