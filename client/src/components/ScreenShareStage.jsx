import React, { useRef, useEffect } from 'react';
import {
  Monitor,
  Square,
  AlertCircle,
  Volume2,
  Maximize2
} from 'lucide-react';

export const ScreenShareStage = ({
  activeScreenSharer,
  selfParticipant,
  isScreenSharing,
  localScreenStream,
  remoteScreenStream,
  onStopScreenShare
}) => {
  const videoRef = useRef(null);

  const isSelfSharing = isScreenSharing || activeScreenSharer?.socketId === selfParticipant?.socketId;
  const activeStream = isSelfSharing ? localScreenStream : remoteScreenStream;

  useEffect(() => {
    if (videoRef.current && activeStream) {
      videoRef.current.srcObject = activeStream;
    }
  }, [activeStream]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-cinematic border border-indigo-500/30">
      {/* Screen Video Element */}
      {activeStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelfSharing} // mute local screen to avoid echo
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 text-slate-400 p-8 text-center">
          <Monitor className="w-14 h-14 text-indigo-400 animate-pulse" />
          <h3 className="text-base font-semibold text-slate-200">
            Connecting to Screen Stream...
          </h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {activeScreenSharer?.username || 'Participant'} has started sharing their screen.
          </p>
        </div>
      )}

      {/* Top Status Banner */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-2">
          {isSelfSharing ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold backdrop-blur-md pointer-events-auto shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>You are sharing your screen</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-semibold backdrop-blur-md pointer-events-auto shadow-sm">
              <Monitor className="w-3.5 h-3.5 text-indigo-400" />
              <span>Viewing {activeScreenSharer?.username || 'Remote User'}'s screen</span>
            </div>
          )}
        </div>

        {/* Stop sharing button (if self is sharing) */}
        {isSelfSharing && (
          <button
            onClick={onStopScreenShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-lg shadow-glow-sm transition-all pointer-events-auto"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop Sharing</span>
          </button>
        )}
      </div>

      {/* Bottom Advisory Info Pill regarding DRM and Tab Audio */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/75 border border-slate-700/50 text-[11px] text-slate-300 backdrop-blur-md pointer-events-auto max-w-lg">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="truncate">
            Tip: For movie audio, select "Share tab audio" in Chrome/Edge when choosing a browser tab. DRM-protected video may display a black screen.
          </span>
        </div>
      </div>
    </div>
  );
};
