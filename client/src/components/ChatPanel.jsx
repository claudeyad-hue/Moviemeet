import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';

export const ChatPanel = ({
  messages,
  selfParticipant,
  onSendMessage,
  isOpen,
  onClose
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="md:relative fixed right-3 top-16 bottom-24 md:top-auto md:bottom-auto z-40 flex flex-col h-full w-80 max-w-[calc(100vw-24px)] cinematic-glass-dark rounded-xl border border-slate-700/60 shadow-cinematic overflow-hidden">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-700/50 bg-charcoal-900/60">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-slate-100">Room Chat</h3>
          <span className="text-xs text-slate-400">({messages.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          title="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-10">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-brand-400" />
            <p className="text-xs font-medium">No messages yet.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Say hi to your watch party group!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === selfParticipant?.userId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-baseline gap-1.5 mb-1 text-[11px]">
                  <span
                    className={`font-semibold ${
                      isMe ? 'text-brand-300' : 'text-slate-300'
                    }`}
                  >
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-brand-600 text-white rounded-tr-none shadow-glow-sm'
                      : 'bg-charcoal-750 text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-slate-700/50 bg-charcoal-900/80 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          maxLength={1000}
          className="flex-1 bg-charcoal-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white rounded-lg transition-colors flex-shrink-0"
          title="Send"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
