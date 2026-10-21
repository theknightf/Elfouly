import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { MessageSquare, Send, Sparkles, X } from 'lucide-react';

export default function TauntChat() {
  const { roomState, sendTaunt } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const messages = roomState?.messages || [];

  const EGYPTIAN_PRESETS = [
    'يا عيني على الروقان والهدوء! 😎',
    'أمّن يا عم في الخزنة قبل ما تطير! 🔒',
    'الفولي كودها والبارسا في القلب! ⚡',
    'البربخ مسيطر.. مفيش شوتة بتعدي! 🛡️',
    'بيلا فيتا يا باشا والجيلاتي ساقع! 🍦',
    'خدمة 5 نجوم وبرايم تايم دراما! 🛎️',
    'سيرفراتنا مشفرة والتأمين حديدي! 🦁',
    'رد فعل 240Hz.. البزر بتاعي! 🕹️',
    'توربو شغال على أعلى RPM! 🏎️',
    'جون يا لعيب على الرايق! ⚽',
    'وقعت في الفخ يا نجم! ❌'
  ];

  const handleSendCustom = (e) => {
    e?.preventDefault();
    if (!customText.trim()) return;
    sendTaunt(customText.trim());
    setCustomText('');
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-xs sm:max-w-sm w-full">
      {/* Floating Toggle Button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="btn-arcade-cyan px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shadow-2xl cursor-pointer hover:scale-105 transition-all"
        >
          <MessageSquare className="w-4 h-4 fill-current" />
          <span>إفيهات وقفشات الساحة ({messages.length})</span>
          {messages.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-arena-red animate-ping" />
          )}
        </button>
      ) : (
        <div className="bg-arena-card/95 backdrop-blur-md border-2 border-arena-cyan/40 rounded-3xl p-4 shadow-2xl space-y-3 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-arena-cyan">
              <Sparkles className="w-3.5 h-3.5" />
              <span>شات القفشات والمناكفة</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 pr-1">
            {EGYPTIAN_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => sendTaunt(preset)}
                className="text-[10px] bg-arena-darker hover:bg-arena-cyan/20 px-2 py-1 rounded-lg border border-white/10 text-gray-300 hover:text-arena-cyan font-semibold transition-all text-right"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-right">
            {messages.length === 0 ? (
              <div className="text-[11px] text-gray-500 text-center py-2">
                لسه مفيش حد رمى إفيه.. ابدأ أنت يا بطل!
              </div>
            ) : (
              messages.slice(-8).map((msg) => (
                <div key={msg.id} className="bg-arena-darker/80 p-2 rounded-xl border border-white/5 text-xs">
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
                    <span className="font-mono">{msg.time}</span>
                    <span className="font-bold flex items-center gap-1">
                      <span>{msg.characterAvatar}</span>
                      <span className={msg.team === 'team_a' ? 'text-arena-cyan' : 'text-arena-red'}>
                        {msg.senderName}
                      </span>
                    </span>
                  </div>
                  <div className="text-white font-bold">{msg.text}</div>
                </div>
              ))
            )}
          </div>

          {/* Custom Input */}
          <form onSubmit={handleSendCustom} className="flex gap-2">
            <input
              type="text"
              placeholder="اكتب إفيه أو نكشة..."
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="flex-1 bg-arena-darker border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-arena-cyan text-right"
            />
            <button
              type="submit"
              className="btn-arcade-cyan px-3 py-1.5 rounded-xl text-xs font-black"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
