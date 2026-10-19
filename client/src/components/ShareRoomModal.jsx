import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  QrCode,
  Share2,
  Smartphone,
  ExternalLink
} from 'lucide-react';

export const ShareRoomModal = ({
  isOpen,
  onClose,
  roomCode,
  roomName
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const inviteLink = `${window.location.origin}/room/${roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareText = encodeURIComponent(
    `Join my movie watch party on MovieMeet! Click to watch together: ${inviteLink}`
  );

  // SVG QR Code generator (clean inline QR matrix representation)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}&bgcolor=11-15-23&color=165-180-252`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none">
      <div className="relative w-full max-w-md bg-charcoal-900 border border-slate-700/80 rounded-2xl shadow-cinematic overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-charcoal-850">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-100">Share Watch Party</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Room Code Card */}
          <div className="p-3.5 rounded-xl bg-charcoal-800 border border-slate-700/70 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                Room Code
              </span>
              <span className="text-xl font-mono font-extrabold text-brand-300 tracking-wider">
                {roomCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg bg-charcoal-700 hover:bg-charcoal-600 text-xs text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Shareable Link Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Direct Invitation Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 bg-charcoal-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-glow-sm"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Instant QR Code for Mobile Friends */}
          <div className="p-4 rounded-xl cinematic-glass flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-700 bg-charcoal-950 flex items-center justify-center p-1 flex-shrink-0">
              <img
                src={qrUrl}
                alt="Room QR Code"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-semibold text-slate-200 mb-1">
                <Smartphone className="w-3.5 h-3.5 text-brand-400" />
                <span>Scan with Phone or Tablet</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Friends can scan this QR code with their mobile camera to enter the room immediately.
              </p>
            </div>
          </div>

          {/* Quick Share Buttons */}
          <div className="pt-2">
            <span className="text-[11px] text-slate-400 font-medium block mb-2 text-center">
              Share directly to:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`https://api.whatsapp.com/send?text=${shareText}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Join my movie watch party!')}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Telegram</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={`mailto:?subject=${encodeURIComponent(`Watch movie with me on MovieMeet (${roomName || roomCode})`)}&body=${shareText}`}
                className="py-2 px-3 rounded-lg bg-charcoal-750 hover:bg-charcoal-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Email</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
