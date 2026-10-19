import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Subtitles,
  Film,
  Lock,
  Unlock,
  AlertTriangle,
  Loader2,
  RefreshCw
} from 'lucide-react';

export const MoviePlayer = ({
  playbackState,
  selfParticipant,
  sendPlaybackAction,
  requestPlaybackSync,
  onOpenSourceModal,
  isFocusMode,
  subtitlesUrl
}) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressBarRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState(null);
  const [showControls, setShowControls] = useState(true);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState('In Sync'); // 'In Sync' | 'Resyncing'

  // Flag to prevent emitting socket events when updating video element in response to remote sync
  const isSyncingFromRemote = useRef(false);
  const controlsTimeoutRef = useRef(null);

  const isHost = !!selfParticipant?.isHost;
  const isControlDisabled = playbackState?.hostControlsOnly && !isHost;

  // React to remote playbackState updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackState) return;

    isSyncingFromRemote.current = true;

    // 1. Source check
    if (playbackState.videoUrl && video.src !== playbackState.videoUrl) {
      setPlaybackError(null);
      video.src = playbackState.videoUrl;
      video.load();
    }

    // 2. Calculate live authoritative time with drift tolerance
    let authoritativeTime = playbackState.currentTime || 0;
    if (playbackState.isPlaying && playbackState.lastUpdated) {
      const elapsed = (Date.now() - playbackState.lastUpdated) / 1000;
      authoritativeTime += elapsed * (playbackState.playbackRate || 1);
    }

    const drift = Math.abs(video.currentTime - authoritativeTime);
    if (drift > 1.2) {
      setSyncStatus('Resyncing');
      video.currentTime = Math.max(0, authoritativeTime);
      setTimeout(() => setSyncStatus('In Sync'), 800);
    }

    // 3. Play / Pause state
    if (playbackState.isPlaying) {
      if (video.paused) {
        video.play().catch((err) => {
          console.warn('Autoplay prevented by browser:', err.message);
          if (err.name === 'NotAllowedError') {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          }
        });
      }
    } else {
      if (!video.paused) {
        video.pause();
      }
    }

    setTimeout(() => {
      isSyncingFromRemote.current = false;
    }, 200);
  }, [playbackState]);

  // Periodic drift correction check (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !playbackState?.isPlaying || isSyncingFromRemote.current) return;

      const elapsed = (Date.now() - playbackState.lastUpdated) / 1000;
      const expectedTime = playbackState.currentTime + elapsed * (playbackState.playbackRate || 1);
      const drift = Math.abs(video.currentTime - expectedTime);

      if (drift > 1.5) {
        setSyncStatus('Resyncing');
        video.currentTime = expectedTime;
        setTimeout(() => setSyncStatus('In Sync'), 800);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playbackState]);

  // Handle Play/Pause toggle from user
  const handleTogglePlay = () => {
    if (isControlDisabled) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      sendPlaybackAction('play', { currentTime: video.currentTime });
    } else {
      sendPlaybackAction('pause', { currentTime: video.currentTime });
    }
  };

  // Handle Seek from user scrubber
  const handleSeek = (e) => {
    if (isControlDisabled) return;
    const video = videoRef.current;
    const progressBar = progressBarRef.current;
    if (!video || !progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clickPos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickPos / rect.width;
    const newTime = percentage * (video.duration || 0);

    video.currentTime = newTime;
    setCurrentTime(newTime);
    sendPlaybackAction('seek', { currentTime: newTime });
  };

  const handleSkip = (seconds) => {
    if (isControlDisabled) return;
    const video = videoRef.current;
    if (!video) return;

    const newTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    sendPlaybackAction('seek', { currentTime: newTime });
  };

  // Video element events
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setPlaybackError(null);
    }
  };

  const handleWaiting = () => setIsBuffering(true);
  const handlePlaying = () => {
    setIsBuffering(false);
    setIsPlaying(true);
  };
  const handlePause = () => {
    setIsBuffering(false);
    setIsPlaying(false);
  };

  const handleError = () => {
    setIsBuffering(false);
    setPlaybackError(
      'Unable to load or stream video. Supported formats include direct MP4, WebM, and authorized local video files. Note: Streaming services (e.g. Netflix, Disney+, Amazon) block direct embedding due to DRM — use Screen Share to watch those together.'
    );
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  // Volume control
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  // Autohide controls on inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none transition-all duration-300 rounded-xl shadow-cinematic ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={playbackState?.videoUrl}
        className="w-full h-full object-contain cursor-pointer"
        onClick={handleTogglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={handleWaiting}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onError={handleError}
        playsInline
      >
        {subtitlesUrl && subtitlesEnabled && (
          <track
            src={subtitlesUrl}
            kind="subtitles"
            srcLang="en"
            label="English"
            default
          />
        )}
      </video>

      {/* Buffering Indicator */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none z-20">
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl cinematic-glass">
            <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            <span className="text-sm font-medium text-slate-200">Buffering movie...</span>
          </div>
        </div>
      )}

      {/* Playback Error Warning Banner */}
      {playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 z-30">
          <div className="max-w-md text-center p-6 rounded-2xl cinematic-glass border border-red-500/30">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-100 mb-2">Video Playback Issue</h3>
            <p className="text-sm text-slate-300 mb-5 leading-relaxed">{playbackError}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onOpenSourceModal}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-glow-sm"
              >
                <Film className="w-4 h-4" />
                Change Movie / Video
              </button>
              <button
                onClick={requestPlaybackSync}
                className="px-3 py-2 bg-charcoal-800 hover:bg-charcoal-700 text-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Overlay Badge Bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-charcoal-900/80 border border-slate-700/60 text-xs font-medium text-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'In Sync' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-spin'
              }`}
            />
            <span>{syncStatus}</span>
          </div>

          {playbackState?.hostControlsOnly ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 font-medium">
              <Lock className="w-3.5 h-3.5" />
              <span>Host Only Controls</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-xs text-brand-300 font-medium">
              <Unlock className="w-3.5 h-3.5" />
              <span>Shared Controls</span>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSourceModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg cinematic-glass hover:bg-white/10 text-xs font-medium text-slate-200 transition-colors shadow-sm"
        >
          <Film className="w-3.5 h-3.5 text-brand-400" />
          <span>Switch Video / Subtitles</span>
        </button>
      </div>

      {/* Center Play/Pause Splash on Hover/Click */}
      {!isPlaying && !isBuffering && !playbackError && (
        <button
          onClick={handleTogglePlay}
          disabled={isControlDisabled}
          className={`absolute w-16 h-16 rounded-full flex items-center justify-center bg-brand-600/90 hover:bg-brand-500 text-white shadow-glow transition-transform hover:scale-110 z-20 ${
            isControlDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title={isControlDisabled ? 'Host has locked playback controls' : 'Play movie'}
        >
          <Play className="w-8 h-8 ml-1" />
        </button>
      )}

      {/* Bottom Cinematic Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 flex flex-col gap-2 transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className={`group relative w-full h-1.5 hover:h-3 bg-slate-700/60 rounded-full cursor-pointer transition-all ${
            isControlDisabled ? 'cursor-not-allowed opacity-75' : ''
          }`}
        >
          <div
            className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-brand-500 to-brand-accent rounded-full relative"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-glow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center justify-between text-slate-200 mt-1">
          {/* Left: Play/Pause, Skips, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTogglePlay}
              disabled={isControlDisabled}
              className={`p-2 rounded-lg hover:bg-white/10 text-slate-100 transition-colors ${
                isControlDisabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={() => handleSkip(-10)}
              disabled={isControlDisabled}
              className={`p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors ${
                isControlDisabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              title="Rewind 10s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSkip(10)}
              disabled={isControlDisabled}
              className={`p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors ${
                isControlDisabled ? 'opacity-40 cursor-not-allowed' : ''
              }`}
              title="Fast forward 10s"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Time display */}
            <div className="text-xs font-mono text-slate-300 ml-2 select-none">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span className="text-slate-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Volume, CC, Sync button, Fullscreen */}
          <div className="flex items-center gap-2.5">
            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={handleToggleMute}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 bg-slate-700 accent-brand-500 rounded-lg cursor-pointer"
                title="Volume"
              />
            </div>

            {/* Subtitles CC Toggle */}
            <button
              onClick={() => setSubtitlesEnabled(!subtitlesEnabled)}
              className={`p-1.5 rounded-lg transition-colors ${
                subtitlesEnabled ? 'bg-brand-500/30 text-brand-300' : 'hover:bg-white/10 text-slate-400'
              }`}
              title={subtitlesEnabled ? 'Subtitles On' : 'Subtitles Off'}
            >
              <Subtitles className="w-4 h-4" />
            </button>

            {/* Manual Resync button */}
            <button
              onClick={requestPlaybackSync}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Resync video with room"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
