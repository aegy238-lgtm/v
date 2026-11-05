import React, { useState } from 'react';
import {
  Send,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

interface ChatThread {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  avatar: string;
  vipLevel?: number;
  charmLevel?: number;
  wealthLevel?: number;
  isOfficial?: boolean;
  frameColor?: string;
  messages: { sender: string; text: string; time: string; isMe: boolean }[];
}

export const ChatInboxScreen: React.FC = () => {
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);
  const [replyInput, setReplyInput] = useState('');

  const [threads, setThreads] = useState<ChatThread[]>([
    {
      id: 'uparty_helper',
      name: 'UParty Helper',
      lastMessage: '...You have successfully shippe',
      time: '٢٠:٢٢',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=150&q=80',
      isOfficial: true,
      frameColor: 'ring-amber-400',
      messages: [
        {
          sender: 'UParty Helper',
          text: 'You have successfully shipped 50,000 coins and activated Lucky Lollipop multipliers!',
          time: '٢٠:٢٢',
          isMe: false,
        },
      ],
    },
    {
      id: 'uparty_mail',
      name: 'UParty Mail Cat',
      lastMessage: '.مرحبا، انا مساعد البريد الرسمي لديك',
      time: 'أمس',
      avatar: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=150&q=80',
      isOfficial: true,
      frameColor: 'ring-teal-400',
      messages: [
        {
          sender: 'UParty Mail Cat',
          text: 'مرحبا، انا مساعد البريد الرسمي لديك. تهانينا على ترقية مستوى الغرفة واستلام جوائز الصندوق الملكي!',
          time: 'أمس',
          isMe: false,
        },
      ],
    },
    {
      id: 'ghazala',
      name: 'غزالة🌸 🍓',
      lastMessage: 'سلام عليكم ممكن',
      time: '٢١:٠٧',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
      charmLevel: 48,
      messages: [
        {
          sender: 'غزالة🌸 🍓',
          text: 'سلام عليكم ممكن انضم لوكالة بيت العائلة؟',
          time: '٢١:٠٧',
          isMe: false,
        },
      ],
    },
    {
      id: 'w3d',
      name: 'W3D 🎀 °',
      lastMessage: '~ Hi',
      time: '١٣:١٥',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      vipLevel: 5,
      charmLevel: 62,
      wealthLevel: 48,
      frameColor: 'ring-amber-400',
      messages: [
        {
          sender: 'W3D 🎀 °',
          text: '~ Hi ابو عدي! مبروك مضاعفات الحظ 188X',
          time: '١٣:١٥',
          isMe: false,
        },
      ],
    },
    {
      id: 'samaka',
      name: '👑سمكة👑',
      lastMessage: 'مين دي اصلا',
      time: 'أمس',
      avatar: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&q=80',
      vipLevel: 4,
      charmLevel: 59,
      wealthLevel: 38,
      frameColor: 'ring-yellow-400',
      messages: [
        {
          sender: '👑سمكة👑',
          text: 'مين دي اصلا؟ يلا نفتح مايك في الغرفة',
          time: 'أمس',
          isMe: false,
        },
      ],
    },
    {
      id: 'layal',
      name: 'ليال💜',
      lastMessage: 'هاي',
      time: 'أمس',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      vipLevel: 3,
      charmLevel: 45,
      wealthLevel: 1,
      messages: [
        {
          sender: 'ليال💜',
          text: 'هاي ابو عدي، الغرفة منورة بيكم',
          time: 'أمس',
          isMe: false,
        },
      ],
    },
    {
      id: 'lulu',
      name: 'لؤلؤه.. ✨',
      lastMessage: '[التذكير]',
      time: '٢٠/١٠/٢٠٢٦',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
      vipLevel: 3,
      charmLevel: 42,
      wealthLevel: 28,
      messages: [
        {
          sender: 'لؤلؤه.. ✨',
          text: '[التذكير] موعد مسابقة الوكالة الساعة 9 مساءً',
          time: '٢٠/١٠/٢٠٢٦',
          isMe: false,
        },
      ],
    },
    {
      id: 'habiba',
      name: '✨حبيـ♥ـبة آلمـ♥ـلَك✨',
      lastMessage: 'تمام',
      time: '١٨/١٠/٢٠٢٦',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
      vipLevel: 4,
      charmLevel: 65,
      wealthLevel: 51,
      messages: [
        {
          sender: '✨حبيـ♥ـبة آلمـ♥ـلَك✨',
          text: 'تمام جاهزين للحفلة الليلة',
          time: '١٨/١٠/٢٠٢٦',
          isMe: false,
        },
      ],
    },
    {
      id: 'folan',
      name: 'Folan',
      lastMessage: 'تمام',
      time: '١٧/١٠/٢٠٢٦',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      vipLevel: 6,
      charmLevel: 99,
      wealthLevel: 113,
      frameColor: 'ring-amber-500',
      messages: [
        {
          sender: 'Folan',
          text: 'تمام يا غالي تم إرسال الدعم',
          time: '١٧/١٠/٢٠٢٦',
          isMe: false,
        },
      ],
    },
  ]);

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedThread) return;

    const newMsg = {
      sender: '🔥 ابو عدي 🔥',
      text: replyInput.trim(),
      time: 'الآن',
      isMe: true,
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === selectedThread.id
          ? { ...t, lastMessage: newMsg.text, time: 'الآن', messages: [...t.messages, newMsg] }
          : t
      )
    );
    setSelectedThread((prev) =>
      prev ? { ...prev, messages: [...prev.messages, newMsg] } : null
    );
    setReplyInput('');
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-b from-[#e8fbf6] via-white to-white text-slate-900 pb-24 font-tajawal select-none shadow-2xl">
      
      {/* Top Header (00:37): محادثة on Right */}
      <div className="sticky top-0 z-30 bg-[#e8fbf6]/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-end border-b border-teal-100/60">
        <h1 className="text-xl font-black text-slate-900">محادثة</h1>
      </div>

      {/* Chat List Rows (Exact match to video 00:37) */}
      <div className="divide-y divide-slate-100">
        {threads.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedThread(item)}
            className="px-4 py-3 flex items-center justify-between hover:bg-teal-50/40 cursor-pointer transition-colors"
          >
            {/* Left: Timestamp */}
            <div className="text-[11px] text-slate-400 font-medium self-start pt-1">
              {item.time}
            </div>

            {/* Center: Name + Badges + Subtitle */}
            <div className="flex-1 px-3 text-right">
              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                {/* Wealth Badge */}
                {item.wealthLevel && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-black text-[9px] flex items-center gap-0.5">
                    <span>🪙</span>
                    <span>{item.wealthLevel}</span>
                  </span>
                )}

                {/* Charm Badge */}
                {item.charmLevel && (
                  <span className="px-1.5 py-0.2 rounded-full bg-pink-100 text-pink-700 font-black text-[9px] flex items-center gap-0.5">
                    <span>🌸</span>
                    <span>{item.charmLevel}</span>
                  </span>
                )}

                {/* VIP Badge */}
                {item.vipLevel && (
                  <span
                    className={`px-1.5 py-0.2 rounded font-black text-[9px] text-white ${
                      item.vipLevel >= 5
                        ? 'bg-gradient-to-r from-pink-500 to-rose-600'
                        : item.vipLevel === 4
                        ? 'bg-gradient-to-r from-sky-500 to-blue-600'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-600'
                    }`}
                  >
                    VIP{item.vipLevel}
                  </span>
                )}

                <h3 className="text-sm font-black text-slate-900">{item.name}</h3>
              </div>

              <p className="text-xs text-slate-400 truncate mt-0.5">{item.lastMessage}</p>
            </div>

            {/* Right: Circular Avatar with Frame */}
            <div className="relative shrink-0">
              <div
                className={`w-13 h-13 rounded-full p-0.5 ${
                  item.frameColor ? `ring-2 ${item.frameColor}` : 'ring-1 ring-slate-200'
                } overflow-hidden shadow-sm`}
              >
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
              {item.vipLevel && item.vipLevel >= 4 && (
                <span className="absolute -top-1.5 -right-1 text-sm drop-shadow">👑</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Direct Chat Modal */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="w-full max-w-md h-[540px] bg-white rounded-3xl shadow-2xl border border-teal-100 flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* Chat Header */}
            <div className="px-4 py-3 bg-[#e8fbf6] border-b border-teal-100 flex items-center justify-between">
              <button
                onClick={() => setSelectedThread(null)}
                className="p-1.5 rounded-full hover:bg-teal-100 text-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">{selectedThread.name}</span>
                <img
                  src={selectedThread.avatar}
                  alt={selectedThread.name}
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-400"
                />
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50">
              {selectedThread.messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.isMe ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xs ${
                      m.isMe
                        ? 'bg-teal-500 text-white rounded-tl-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tr-none'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1">{m.time}</span>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <form
              onSubmit={handleSendReply}
              className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
            >
              <button
                type="submit"
                className="p-2.5 rounded-full bg-teal-500 text-white hover:bg-teal-600 shadow"
              >
                <Send className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                placeholder="اكتب رسالة خاصة..."
                className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-xs text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
