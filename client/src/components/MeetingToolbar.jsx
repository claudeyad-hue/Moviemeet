import React, { useState } from 'react';
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
  Film,
  Smile,
  Share2
} from 'lucide-react';

const EMOJIS = ['❤️', '😂', '🍿', '😱', '🔥', '👏'];

export const MeetingToolbar = ({
  audioEnabled,
  videoEnabled,
  isScreenSharing,
  activeScreenSharer,
  isFocusMode,
  isChatOpen,
  unreadCount = 0,
  onToggleAudio,
  onToggleVideo,
  onStartScreenShare,
  onStopScreenShare,
  onToggleFocusMode,
  onToggleChat,
  onOpenShareModal,
  onSendReaction,
  onLeaveRoom,
  viewMode = 'cinema',
  onToggleViewMode
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isSomeoneElseSharing = activeScreenSharer && !isScreenSharing;

  const handleEmojiClick = (emoji) => {
    if (onSendReaction) {
      onSendReaction(emoji);
    }
  };

  return (
    <div className="w-full flex items-center justify-center py-1.5 sm:py-2 px-2 sm:px-4 z-30 select-none">
      <div className="relative flex items-center gap-1 sm:gap-2.5 px-2 sm:px-4 py-1.5 sm:py-2 rounded-2xl cinematic-glass-dark border border-slate-700/70 shadow-cinematic overflow-x-auto max-w-full scrollbar-none">
        {/* Floating Emoji Picker Popover */}
        {showEmojiPicker && (
          <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 rounded-2xl cinematic-glass border border-slate-700 shadow-cinematic z-40 animate-fade-in">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  handleEmojiClick(emoji);
                  setShowEmojiPicker(false);
                }}
                className="w-9 h-9 rounded-xl hover:bg-white/20 flex items-center justify-center text-xl hover:scale-125 transition-transform"
                title={`Send ${emoji} reaction`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Mic Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 flex items-center justify-center min-w-[44px] min-h-[44px] ${
            audioEnabled
              ? 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-100 hover:text-white'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
          }`}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {audioEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleVideo}
          className={`p-2.5 sm:p-3 rounded-xl transition-all duration-200 flex items-center justify-center min-w-[44px] min-h-[44px] ${
            videoEnabled
              ? 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-100 hover:text-white'
              : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
          }`}
          title={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
        >
          {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        <div className="w-px h-6 bg-slate-700/80 mx-0.5 sm:mx-1" />

        {/* Quick Reaction Button */}
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-2.5 sm:p-3 rounded-xl transition-all flex items-center justify-center ${
            showEmojiPicker
              ? 'bg-brand-500 text-white shadow-glow-sm'
              : 'bg-charcoal-750 hover:bg-charcoal-700 text-amber-300 hover:text-amber-200'
          }`}
          title="Send Real-Time Emoji Reaction"
        >
          <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Share Screen Toggle */}
        {isScreenSharing ? (
          <button
            onClick={onStopScreenShare}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs shadow-glow-sm transition-all"
            title="Stop sharing your screen"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Stop Share</span>
          </button>
        ) : (
          <button
            onClick={onStartScreenShare}
            disabled={isSomeoneElseSharing}
            className={`flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl font-medium text-xs transition-all ${
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
            <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Share Screen</span>
          </button>
        )}

        {/* Layout View Switcher (Cinema vs Video Call Grid) */}
        {onToggleViewMode && (
          <button
            onClick={() => onToggleViewMode(viewMode === 'cinema' ? 'grid' : 'cinema')}
            className={`flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-brand-600 text-white shadow-glow'
                : 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-300 hover:text-white'
            }`}
            title={
              viewMode === 'cinema'
                ? 'Switch to Video Call Grid View (Full Camera Meeting)'
                : 'Switch to Cinema View (Movie Player Focus)'
            }
          >
            {viewMode === 'cinema' ? (
              <>
                <Video className="w-4 h-4 text-emerald-400" />
                <span className="hidden md:inline">Video Call</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4 text-brand-400" />
                <span className="hidden md:inline">Cinema View</span>
              </>
            )}
          </button>
        )}

        {/* Movie Focus Mode Toggle */}
        <button
          onClick={onToggleFocusMode}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl text-xs font-medium transition-all ${
            isFocusMode
              ? 'bg-brand-500 text-white shadow-glow'
              : 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-300 hover:text-white'
          }`}
          title="Movie Focus Mode (Distraction-free theater)"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="hidden md:inline">Focus</span>
        </button>

        {/* Share Room Link / QR Modal Button */}
        {onOpenShareModal && (
          <button
            onClick={onOpenShareModal}
            className="p-2.5 sm:p-3 rounded-xl bg-charcoal-750 hover:bg-charcoal-700 text-slate-200 hover:text-white transition-all"
            title="Share Room / QR Code"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
          </button>
        )}

        {/* Chat Toggle with unread badge */}
        <button
          onClick={onToggleChat}
          className={`relative p-2.5 sm:p-3 rounded-xl transition-all ${
            isChatOpen
              ? 'bg-brand-600 text-white shadow-glow-sm'
              : 'bg-charcoal-750 hover:bg-charcoal-700 text-slate-200 hover:text-white'
          }`}
          title="Toggle Room Chat"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          {!isChatOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <div className="w-px h-6 bg-slate-700/80 mx-0.5 sm:mx-1" />

        {/* Leave Room Button */}
        <button
          onClick={onLeaveRoom}
          className="p-2.5 sm:p-3 rounded-xl bg-red-500/20 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/30 transition-all flex items-center justify-center"
          title="Leave Watch Party"
        >
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
};
