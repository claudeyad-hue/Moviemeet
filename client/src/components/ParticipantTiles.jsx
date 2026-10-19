import React, { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Eye,
  EyeOff,
  Crown,
  User,
  Monitor
} from 'lucide-react';

// Single Remote Video/Audio Participant Tile
const RemoteParticipantTile = ({
  participant,
  stream,
  isHidden,
  onToggleHide
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // Bind remote stream
  useEffect(() => {
    if (stream) {
      if (videoRef.current && !isHidden) {
        videoRef.current.srcObject = stream;
      }
      // Audio element always receives stream so voice is NEVER muted when video is hidden!
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }
    }
  }, [stream, isHidden]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden cinematic-glass border border-slate-700/50 transition-all duration-300 ${
        isHidden ? 'h-14 w-full sm:w-44 flex items-center p-2.5 bg-charcoal-900/90' : 'aspect-video w-full sm:w-48 bg-charcoal-900'
      }`}
    >
      {/* Hidden audio element: ALWAYS plays remote audio regardless of video visibility */}
      <audio ref={audioRef} autoPlay playsInline />

      {!isHidden ? (
        <>
          {/* Active Video Stream */}
          {stream && participant.videoEnabled !== false ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-charcoal-850 gap-1.5 text-slate-400">
              <div className="w-10 h-10 rounded-full bg-charcoal-750 flex items-center justify-center text-slate-300">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[11px] text-slate-400">Camera Off</span>
            </div>
          )}

          {/* Overlay Status Bar */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none p-2 flex flex-col justify-between">
            {/* Top row: Badges & Hide Video Toggle */}
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-1">
                {participant.isHost && (
                  <span className="p-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    Host
                  </span>
                )}
                {participant.isScreenSharing && (
                  <span className="p-1 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold flex items-center gap-1">
                    <Monitor className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Clear Hide Video Toggle Button */}
              <button
                onClick={() => onToggleHide(participant.socketId)}
                className="px-2 py-0.5 rounded-md bg-black/60 hover:bg-black/90 text-[11px] text-slate-200 hover:text-white flex items-center gap-1 border border-slate-600/50 transition-colors"
                title="Hide this participant video tile locally (audio remains active)"
              >
                <EyeOff className="w-3 h-3 text-slate-400" />
                <span>Hide video</span>
              </button>
            </div>

            {/* Bottom row: Name & Audio Indicator */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-100 truncate max-w-[100px]">
                {participant.username}
              </span>
              <div className="p-1 rounded bg-black/50">
                {participant.audioEnabled !== false ? (
                  <Mic className="w-3 h-3 text-emerald-400" />
                ) : (
                  <MicOff className="w-3 h-3 text-red-400" />
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Minimized Audio-Only View When Video Tile is Hidden */
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1 truncate">
                <span className="text-xs font-medium text-slate-200 truncate">
                  {participant.username}
                </span>
                {participant.isHost && <Crown className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />}
              </div>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Mic className="w-2.5 h-2.5" /> Audio active
              </span>
            </div>
          </div>

          <button
            onClick={() => onToggleHide(participant.socketId)}
            className="ml-2 px-2 py-1 rounded bg-charcoal-750 hover:bg-charcoal-700 text-[11px] text-brand-300 flex items-center gap-1 transition-colors flex-shrink-0"
            title="Restore video tile"
          >
            <Eye className="w-3 h-3" />
            <span>Show video</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Local Participant Tile
const LocalParticipantTile = ({
  selfParticipant,
  localStream,
  audioEnabled,
  videoEnabled
}) => {
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="relative aspect-video w-full sm:w-48 rounded-xl overflow-hidden cinematic-glass border border-brand-500/30 bg-charcoal-900 flex-shrink-0">
      {localStream && videoEnabled ? (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-charcoal-850 gap-1 text-slate-400">
          <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-300">
            <User className="w-5 h-5" />
          </div>
          <span className="text-[11px] text-slate-400">Camera Off</span>
        </div>
      )}

      {/* Overlay Status Bar */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-brand-500/30 text-brand-300 text-[10px] font-semibold">
              You
            </span>
            {selfParticipant?.isHost && (
              <span className="p-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                Host
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-100 truncate max-w-[100px]">
            {selfParticipant?.username || 'You'}
          </span>
          <div className="p-1 rounded bg-black/50">
            {audioEnabled ? (
              <Mic className="w-3 h-3 text-emerald-400" />
            ) : (
              <MicOff className="w-3 h-3 text-red-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ParticipantTiles = ({
  selfParticipant,
  participants,
  localStream,
  remoteStreams,
  audioEnabled,
  videoEnabled,
  hiddenVideoTiles,
  onToggleHideParticipantVideo,
  isFocusMode
}) => {
  // If Movie Focus Mode is on, hide the participant strip
  if (isFocusMode) return null;

  const remoteParticipants = participants.filter(
    (p) => p.socketId !== selfParticipant?.socketId
  );

  return (
    <div className="flex sm:flex-row flex-col gap-2.5 items-center justify-start overflow-x-auto pb-1 max-w-full">
      {/* Self Tile */}
      <LocalParticipantTile
        selfParticipant={selfParticipant}
        localStream={localStream}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
      />

      {/* Remote Peer Tiles */}
      {remoteParticipants.map((peer) => (
        <RemoteParticipantTile
          key={peer.socketId}
          participant={peer}
          stream={remoteStreams[peer.socketId]}
          isHidden={!!hiddenVideoTiles[peer.socketId]}
          onToggleHide={onToggleHideParticipantVideo}
        />
      ))}
    </div>
  );
};
