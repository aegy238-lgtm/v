import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Send, ChevronRight, Search, Bell, MessageSquare } from 'lucide-react';

interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  isMe: boolean;
}

const DM_STORAGE_KEY = 'auravoice_dm_messages_v1';

export const ChatInboxScreen: React.FC = () => {
  const { users, currentUser, transactions, setViewingProfileUser, setActiveModal } = useApp();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [replyInput, setReplyInput] = useState('');

  const [messagesByPeer, setMessagesByPeer] = useState<Record<string, DirectMessage[]>>(() => {
    try {
      const saved = localStorage.getItem(DM_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(DM_STORAGE_KEY, JSON.stringify(messagesByPeer));
    } catch {
      // ignore
    }
  }, [messagesByPeer]);

  // Real users in app excluding current user
  const realPeers = users.filter((u) => u.id !== currentUser.id);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPeers = realPeers.filter(
    (u) =>
      !normalizedSearch ||
      u.displayName.toLowerCase().includes(normalizedSearch) ||
      u.userCode.includes(normalizedSearch)
  );

  // Real system notifications derived from currentUser's transactions
  const mySystemAlerts = transactions
    .filter((tx) => tx.userId === currentUser.id)
    .slice(0, 20);

  const selectedPeer =
    selectedUserId && selectedUserId !== 'system'
      ? realPeers.find((u) => u.id === selectedUserId) || null
      : null;

  const activeConversationMessages = selectedUserId ? messagesByPeer[selectedUserId] || [] : [];

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedUserId || selectedUserId === 'system') return;

    const newMsg: DirectMessage = {
      id: `dm_${Date.now()}`,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      text: replyInput.trim(),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
    };

    setMessagesByPeer((prev) => ({
      ...prev,
      [selectedUserId]: [...(prev[selectedUserId] || []), newMsg],
    }));
    setReplyInput('');
  };

  return (
    <div className="min-h-dvh max-w-md mx-auto bg-[#0b101d] text-white pb-24 font-tajawal select-none shadow-2xl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0b101d]/95 backdrop-blur-md border-b border-white/8 px-4 py-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-white">المحادثات والرسائل</h1>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            {realPeers.length + 1} محادثة
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو رقم ID..."
            className="w-full h-9 bg-white/6 border border-white/10 rounded-xl pr-9 pl-3 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>
      </header>

      {/* Thread List */}
      <div className="divide-y divide-white/6">
        {/* Official System & Wallet Activity Thread (100% Real Data) */}
        <button
          onClick={() => setSelectedUserId('system')}
          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors text-right"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white">إشعارات النظام والمحفظة</h3>
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] font-bold">
                  رسمي
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {mySystemAlerts[0]?.details || 'لا توجد إشعارات جديدة حالياً'}
              </p>
            </div>
          </div>

          <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
            {mySystemAlerts[0]?.timestamp?.slice(11, 16) || 'الآن'}
          </span>
        </button>

        {/* Real Users Direct Messaging Threads */}
        {filteredPeers.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2 text-slate-400 text-xs">
            <MessageSquare className="w-7 h-7 mx-auto opacity-50" />
            <p>لا يوجد مستخدمون مطابقون للبحث.</p>
          </div>
        ) : (
          filteredPeers.map((peer) => {
            const peerMsgs = messagesByPeer[peer.id] || [];
            const lastMsg = peerMsgs[peerMsgs.length - 1];

            return (
              <button
                key={peer.id}
                onClick={() => setSelectedUserId(peer.id)}
                className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.04] transition-colors text-right"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={peer.avatar}
                    alt={peer.displayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white truncate">{peer.displayName}</h3>
                      {peer.vipLevel > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] font-mono font-bold shrink-0">
                          VIP{peer.vipLevel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {lastMsg ? lastMsg.text : `ID: ${peer.userCode} · اضغط لبدء المحادثة`}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-slate-400 font-mono tabular-nums shrink-0">
                  {lastMsg ? lastMsg.time : ''}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Direct Chat or System Notifications Modal */}
      {selectedUserId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
          <div className="w-full max-w-md h-[82dvh] sm:h-[600px] bg-[#111522] border border-white/12 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
            {/* Chat Header */}
            <div className="px-4 py-3 bg-[#151b2d] border-b border-white/10 flex items-center justify-between shrink-0">
              <button
                onClick={() => setSelectedUserId(null)}
                className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center text-slate-200"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              {selectedUserId === 'system' ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">إشعارات النظام والمحفظة</span>
                  <Bell className="w-4 h-4 text-amber-400" />
                </div>
              ) : selectedPeer ? (
                <button
                  onClick={() => {
                    setViewingProfileUser(selectedPeer);
                    setActiveModal('profile');
                  }}
                  className="flex items-center gap-2 hover:opacity-90"
                >
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{selectedPeer.displayName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {selectedPeer.userCode}
                    </div>
                  </div>
                  <img
                    src={selectedPeer.avatar}
                    alt={selectedPeer.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-amber-400/50"
                  />
                </button>
              ) : null}

              <div className="w-9" />
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {selectedUserId === 'system' ? (
                mySystemAlerts.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    لا توجد إشعارات أو عمليات مسجلة بعد.
                  </div>
                ) : (
                  mySystemAlerts.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-white/[0.04] border border-white/8 text-right space-y-1"
                    >
                      <div className="text-xs font-semibold text-white">{tx.details}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                        <span>{tx.timestamp}</span>
                        {tx.coinsDelta !== 0 && (
                          <span className={tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.coinsDelta > 0 ? `+${tx.coinsDelta.toLocaleString()}` : tx.coinsDelta.toLocaleString()} 🪙
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : activeConversationMessages.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">
                  ابدأ المحادثة مع {selectedPeer?.displayName} الآن.
                </div>
              ) : (
                activeConversationMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.isMe ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        m.isMe
                          ? 'bg-amber-400 text-slate-950 font-semibold rounded-tl-none'
                          : 'bg-white/10 text-white rounded-tr-none'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono mt-1">{m.time}</span>
                  </div>
                ))
              )}
            </div>

            {/* Reply Bar (Only for Peer DMs) */}
            {selectedUserId !== 'system' && (
              <form
                onSubmit={handleSendReply}
                className="p-3 bg-[#151b2d] border-t border-white/10 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="اكتب رسالة خاصة..."
                  className="flex-1 h-10 bg-white/6 border border-white/12 rounded-xl px-3.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="w-10 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
