import React, { useState, useEffect } from 'react';
import {
  X,
  Film,
  Link,
  Upload,
  Check,
  AlertCircle,
  Clock,
  Lock,
  Unlock,
  Subtitles
} from 'lucide-react';
import { api } from '../utils/api';

export const VideoSourceModal = ({
  isOpen,
  onClose,
  currentVideoUrl,
  subtitlesUrl,
  isHost,
  hostControlsOnly,
  onSelectVideo,
  onUpdateSubtitles,
  onToggleHostControls
}) => {
  const [samples, setSamples] = useState([]);
  const [customUrl, setCustomUrl] = useState('');
  const [customSubtitlesUrl, setCustomSubtitlesUrl] = useState(subtitlesUrl || '');
  const [selectedTab, setSelectedTab] = useState('samples'); // 'samples' | 'url' | 'upload'
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      api.getSamples().then((res) => {
        if (res.samples) setSamples(res.samples);
      });
      setCustomSubtitlesUrl(subtitlesUrl || '');
    }
  }, [isOpen, subtitlesUrl]);

  if (!isOpen) return null;

  const handleApplyCustomUrl = (e) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    // Check for streaming service URLs and guide the user
    const lower = customUrl.toLowerCase();
    if (
      lower.includes('netflix.com') ||
      lower.includes('primevideo.com') ||
      lower.includes('disneyplus.com') ||
      lower.includes('hulu.com') ||
      lower.includes('hbomax.com')
    ) {
      setError(
        'Commercial streaming services (Netflix, Prime, Disney+) cannot be embedded directly due to DRM security protections. Please use the "Share Screen" button in the bottom toolbar to watch them with your room!'
      );
      return;
    }

    onSelectVideo(customUrl.trim());
    if (customSubtitlesUrl.trim()) {
      onUpdateSubtitles(customSubtitlesUrl.trim());
    }
    onClose();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress('Uploading video to watch party server...');
    setError(null);

    try {
      const data = await api.uploadVideo(file);
      if (data.url) {
        onSelectVideo(data.url);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Video upload failed');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-charcoal-900 border border-slate-700/70 rounded-2xl shadow-cinematic overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-charcoal-850">
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-slate-100">Select Movie / Video Source</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-700/50 bg-charcoal-950/40 px-4 pt-2 gap-2">
          <button
            onClick={() => setSelectedTab('samples')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              selectedTab === 'samples'
                ? 'border-brand-500 text-brand-300 bg-charcoal-850'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Authorized Samples
          </button>
          <button
            onClick={() => setSelectedTab('url')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              selectedTab === 'url'
                ? 'border-brand-500 text-brand-300 bg-charcoal-850'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Direct Video URL
          </button>
          <button
            onClick={() => setSelectedTab('upload')}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              selectedTab === 'upload'
                ? 'border-brand-500 text-brand-300 bg-charcoal-850'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Local Video
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {selectedTab === 'samples' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {samples.map((s) => {
                const isSelected = currentVideoUrl === s.url;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectVideo(s.url);
                      onClose();
                    }}
                    className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 shadow-glow-sm'
                        : 'border-slate-700/60 bg-charcoal-800/80 hover:border-slate-500 hover:bg-charcoal-750'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-100 group-hover:text-brand-300 transition-colors">
                          {s.title}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal line-clamp-2">
                        {s.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{s.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedTab === 'url' && (
            <form onSubmit={handleApplyCustomUrl} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Direct Video URL (MP4, WebM, HLS)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/movie.mp4"
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value);
                    setError(null);
                  }}
                  required
                  className="w-full bg-charcoal-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Subtitles className="w-3.5 h-3.5 text-brand-400" />
                  Subtitles WebVTT URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/subtitles.vtt"
                  value={customSubtitlesUrl}
                  onChange={(e) => setCustomSubtitlesUrl(e.target.value)}
                  className="w-full bg-charcoal-800 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="p-3 rounded-lg bg-charcoal-800/60 border border-slate-700/40 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
                <span>
                  Provide a direct, CORS-accessible video link. Note that arbitrary streaming subscription sites (Netflix, Hulu, Prime) cannot be loaded via direct URL due to browser security and DRM restrictions.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs rounded-lg transition-colors shadow-glow-sm"
              >
                Apply Video URL
              </button>
            </form>
          )}

          {selectedTab === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-charcoal-800/40 hover:bg-charcoal-800/70 transition-all text-center">
                <Upload className="w-10 h-10 text-brand-400 mb-3" />
                <span className="text-xs font-semibold text-slate-200 mb-1">
                  Click to select an authorized video file
                </span>
                <span className="text-[11px] text-slate-400">
                  Supports MP4, WebM, and MKV (up to 500 MB)
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {uploading && (
                <div className="p-3 rounded-lg bg-brand-500/20 text-brand-300 text-xs text-center font-medium animate-pulse">
                  {uploadProgress}
                </div>
              )}
            </div>
          )}

          {/* Host Settings Section */}
          {isHost && (
            <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Playback Controls Permission</h4>
                <p className="text-[11px] text-slate-400">
                  {hostControlsOnly
                    ? 'Only the host can play, pause, or seek.'
                    : 'Any participant in the room can control playback.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleHostControls(!hostControlsOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hostControlsOnly
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                }`}
              >
                {hostControlsOnly ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> Host Only
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" /> Shared
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
