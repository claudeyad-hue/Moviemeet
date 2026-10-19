import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Film,
  Users,
  Copy,
  Check,
  Wifi,
  WifiOff,
  User,
  Video
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({
  roomCode,
  roomName,
  participantCount,
  isConnected,
  onCopyInvite,
  viewMode = 'cinema',
  onToggleViewMode
}) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopyInvite();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full h-12 sm:h-14 border-b border-slate-800 bg-charcoal-900/90 backdrop-blur-md px-2 sm:px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-accent flex items-center justify-center text-white shadow-glow-sm group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">
            Movie<span className="text-brand-400">Meet</span>
          </span>
        </Link>

        {roomCode && (
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700/60">
            <span className="text-xs font-semibold text-slate-200 truncate max-w-[160px]">
              {roomName || 'Room'}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-charcoal-800 border border-slate-700 text-[11px] font-mono text-brand-300 font-bold">
              {roomCode}
            </span>
          </div>
        )}
      </div>

      {/* Center: Cinema vs Video Call View Switcher */}
      {roomCode && onToggleViewMode && (
        <div className="hidden sm:flex items-center bg-charcoal-950 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            onClick={() => onToggleViewMode('cinema')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'cinema'
                ? 'bg-brand-600 text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Cinema Mode (Watch Movie with friends)"
          >
            <Film className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cinema</span>
          </button>
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-brand-600 text-white shadow-glow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Video Call Mode (Full camera grid meeting)"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Video Call</span>
          </button>
        </div>
      )}

      {/* Right: Room details & Controls */}
      <div className="flex items-center gap-2.5">
        {roomCode && (
          <>
            {/* Copy Invite Link Button */}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal-800 hover:bg-charcoal-750 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-all shadow-sm"
              title="Copy shareable watch-party link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-brand-400" />
                  <span className="hidden sm:inline">Copy Invite</span>
                </>
              )}
            </button>

            {/* Participant Count Badge */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-charcoal-800/80 border border-slate-700/50 text-xs font-medium text-slate-300">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{participantCount || 1} / 4</span>
            </div>
          </>
        )}

        {/* Connection Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
          title={isConnected ? 'Connected to real-time server' : 'Reconnecting to server...'}
        >
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden md:inline">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="hidden md:inline">Disconnected</span>
            </>
          )}
        </div>

        {/* User Tag */}
        {user && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800 text-xs text-slate-300">
            <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center font-bold text-[10px]">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span className="hidden lg:inline truncate max-w-[100px]">{user.username}</span>
          </div>
        )}
      </div>
    </header>
  );
};
