import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Square,
  Sparkles,
  MessageSquare,
  LogOut,
  Film
} from 'lucide-react';

export const MeetingToolbar = ({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  activeScreenSharer,
  isFocusMode,
  isChatOpen,
  onToggleAudio,
  onToggleVideo,
  onStartScreenShare,
  onStopScreenShare,
  onToggleFocusMode,
  onToggleChat,
  onOpenSourceModal,
  onLeaveRoom
}) => {
  const isSomeoneElseSharing = activeScreenSharer && !isScreenSharing;

  return (
    <div className="w-full flex items-center justify-center py-2 px-4 z-30">
      <div className="flex items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-2xl cinematic-glass-dark border border-slate-700/70 shadow-cinematic">
        {/* Mic Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
            audioEnabled
              ? 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-100 hover:text-white'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
          }`}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center ${
            videoEnabled
              ? 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-100 hover:text-white'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
          }`}
          title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="w-px h-6 bg-slate-700/80 mx-1" />

        {/* Share Screen Toggle */}
        {isScreenSharing ? (
          <button
            onClick={onStopScreenShare}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-glow-sm transition-all"
            title="Stop sharing your screen"
          >
            <Square className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">Stop Share</span>
          </button>
        ) : (
          <button
            onClick={onStartScreenShare}
            disabled={isSomeoneElseSharing}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
              isSomeoneElseSharing
                ? 'bg-charcoal-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow-sm hover:scale-[1.02]'
            }`}
            title={
              isSomeoneElseSharing
                ? 'Another participant is already sharing screen'
                : 'Share your screen with room'
            }
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden sm:inline">Share Screen</span>
          </button>
        )}

        {/* Movie Focus Mode Toggle */}
        <button
          onClick={onToggleFocusMode}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
            isFocusMode
              ? 'bg-brand-500 text-white shadow-glow'
              : 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-300 hover:text-white'
          }`}
          title="Movie Focus Mode (Distraction-free theater)"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="hidden md:inline">Focus Mode</span>
        </button>

        {/* Video Source Picker */}
        <button
          onClick={onOpenSourceModal}
          className="p-3 rounded-xl bg-charcoal-750 hover:bg-charcoal-700 text-slate-200 hover:text-white transition-all"
          title="Change Movie / Video Source"
        >
          <Film className="w-5 h-5 text-brand-400" />
        </button>

        {/* Chat Toggle */}
        <button
          onClick={onToggleChat}
          className={`p-3 rounded-xl transition-all ${
            isChatOpen
              ? 'bg-brand-600 text-white shadow-glow-sm'
              : 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-200 hover:text-white'
          }`}
          title="Toggle Room Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-slate-700/80 mx-1" />

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="p-3 rounded-xl bg-red-500/20 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/30 transition-all flex items-center justify-center"
          title="Leave Watch Party"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
