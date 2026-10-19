import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Film,
  Users,
  Play,
  Lock,
  EyeOff,
  Monitor,
  Sparkles,
  ArrowRight,
  Shield,
  Video,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user, loginGuest, registerUser, loginUser } = useAuth();

  // Mode: 'create' | 'join'
  const [activeTab, setActiveTab] = useState('create');

  // Form states
  const [displayName, setDisplayName] = useState(user?.username || '');
  const [roomName, setRoomName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [hostControlsOnly, setHostControlsOnly] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ensure user is authenticated as guest or logged in before proceeding
  const ensureAuth = async () => {
    if (!user) {
      const name = displayName.trim() || `User_${Math.floor(1000 + Math.random() * 9000)}`;
      return await loginGuest(name);
    }
    return user;
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await ensureAuth();

      const res = await api.createRoom({
        name: roomName.trim() || `${displayName || 'Movie'} Watch Party`,
        password: roomPassword.trim() || undefined,
        hostControlsOnly,
        initialVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      });

      if (res.room?.roomCode) {
        navigate(`/room/${res.room.roomCode}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    setError(null);

    try {
      await ensureAuth();

      // Normalize room code (extract code if user pasted a full URL)
      let cleanCode = joinCode.trim();
      if (cleanCode.includes('/room/')) {
        cleanCode = cleanCode.split('/room/').pop();
      } else if (cleanCode.includes('/')) {
        cleanCode = cleanCode.split('/').pop();
      }
      cleanCode = cleanCode.split('?')[0].split('#')[0].toUpperCase().trim();

      if (!cleanCode) {
        setError('Please enter a valid room code or link');
        setLoading(false);
        return;
      }

      // Verify room access
      await api.joinRoom(cleanCode, joinPassword.trim() || undefined);

      navigate(`/room/${cleanCode}`);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-slate-100 flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-accent flex items-center justify-center text-white shadow-glow">
            <Film className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            Movie<span className="text-brand-400">Meet</span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>WebRTC P2P Ready</span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col lg:flex-row items-center justify-between gap-8 sm:gap-12">
        {/* Left: Branding & Pitch */}
        <div className="flex-1 max-w-xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5 text-brand-neon" />
            <span>Cinema Watch Parties & Group Video Calls</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight mb-5">
            Watch Movies Together & Video Call.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-accent to-brand-neon">
              In Perfect Sync.
            </span>
          </h1>

          <p className="text-base text-slate-300 leading-relaxed mb-8">
            Host live group video calls or cinema-grade movie nights from anywhere with real-time camera grid, voice, screen sharing, and synchronized movie playback. Switch seamlessly between Video Call and Cinema views.
          </p>

          {/* Quick Feature Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-3 rounded-xl cinematic-glass flex items-start gap-2.5">
              <Video className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Video Calls</h4>
                <p className="text-[11px] text-slate-400">Full camera grid</p>
              </div>
            </div>

            <div className="p-3 rounded-xl cinematic-glass flex items-start gap-2.5">
              <Tv className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Zero-Drift Sync</h4>
                <p className="text-[11px] text-slate-400">Sub-second movie lock</p>
              </div>
            </div>

            <div className="p-3 rounded-xl cinematic-glass flex items-start gap-2.5">
              <Monitor className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Screen Share</h4>
                <p className="text-[11px] text-slate-400">Stream any tab/app</p>
              </div>
            </div>

            <div className="p-3 rounded-xl cinematic-glass flex items-start gap-2.5">
              <EyeOff className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Hide Tiles</h4>
                <p className="text-[11px] text-slate-400">Audio stays playing</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Room Create/Join Card */}
        <div className="w-full max-w-md">
          <div className="cinematic-glass-dark rounded-2xl border border-slate-700/70 p-6 shadow-cinematic">
            {/* Tab Header */}
            <div className="flex bg-charcoal-900 rounded-xl p-1 mb-5 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'create'
                    ? 'bg-brand-600 text-white shadow-glow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('join');
                  setError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'join'
                    ? 'bg-brand-600 text-white shadow-glow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Join with Code
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300">
                {error}
              </div>
            )}

            {/* Create Room Form */}
            {activeTab === 'create' ? (
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CinemaLover"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Watch Party Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Movie Marathon Night"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Room Password (Optional)
                  </label>
                  <input
                    type="password"
                    placeholder="Leave empty for public join"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="hostControlCheck"
                    checked={hostControlsOnly}
                    onChange={(e) => setHostControlsOnly(e.target.checked)}
                    className="rounded bg-charcoal-800 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                  />
                  <label
                    htmlFor="hostControlCheck"
                    className="text-xs text-slate-300 cursor-pointer select-none"
                  >
                    Host-only playback controls (prevent guests from pausing)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-accent hover:from-brand-500 hover:to-brand-neon text-white font-semibold text-xs rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{loading ? 'Creating Room...' : 'Start Watch Party'}</span>
                </button>
              </form>
            ) : (
              /* Join Room Form */
              <form onSubmit={handleJoinRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GuestViewer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MOV-4821"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 uppercase tracking-wider font-mono focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Room Password (If Protected)
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password if host set one"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    className="w-full bg-charcoal-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !joinCode.trim()}
                  className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl shadow-glow transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-40"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>{loading ? 'Joining...' : 'Enter Watch Party'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-6 border-t border-slate-800/80 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span>© {new Date().getFullYear()} MovieMeet. All rights reserved.</span>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>WebRTC P2P Mesh</span>
          <span>•</span>
          <span>Socket.IO Sync</span>
          <span>•</span>
          <span>Screen Sharing & Audio</span>
        </div>
      </footer>
    </div>
  );
};
