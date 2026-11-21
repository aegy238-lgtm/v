import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Send,
  ChevronRight,
  Search,
  Bell,
  MessageSquare,
  FileText,
  Sparkles,
} from 'lucide-react';

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>('system');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [activeSubMode, setActiveSubMode] = useState<'chats' | 'records'>('chats');
  const [recordsFilter, setRecordsFilter] = useState<'all' | 'lucky_win' | 'recharge' | 'gift'>('all');
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

  const realPeers = users.filter((u) => u.id !== currentUser.id);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPeers = realPeers.filter(
    (u) =>
      !normalizedSearch ||
      u.displayName.toLowerCase().includes(normalizedSearch) ||
      u.userCode.includes(normalizedSearch)
  );

  const mySystemAlerts = transactions.filter((tx) => tx.userId === currentUser.id);
  const filteredRecords = mySystemAlerts.filter((tx) => {
    if (recordsFilter === 'all') return true;
    return tx.type === recordsFilter;
  });

  const selectedPeer =
    selectedUserId && selectedUserId !== 'system'
      ? realPeers.find((u) => u.id === selectedUserId) || null
      : null;

  const activeConversationMessages = selectedUserId ? messagesByPeer[selectedUserId] || [] : [];

  const openThread = (id: string) => {
    setSelectedUserId(id);
    setMobileShowDetail(true);
  };

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
    <div className="min-h-dvh w-full max-w-6xl mx-auto bg-[#070a12] text-white pb-28 font-tajawal select-none">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#070a12]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <h1 className="text-base sm:text-lg font-black text-amber-300">المحادثات والسجلات</h1>
            <div className="flex items-center p-1 rounded-xl bg-[#0e1320] border border-white/10 text-xs">
              <button
                onClick={() => setActiveSubMode('chats')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  activeSubMode === 'chats'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>المحادثات ({realPeers.length + 1})</span>
              </button>
              <button
                onClick={() => setActiveSubMode('records')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  activeSubMode === 'records'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>السجلات ({mySystemAlerts.length})</span>
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو رقم ID..."
              className="w-full h-9 bg-[#0e1320] border border-white/12 rounded-xl pr-9 pl-3 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      {activeSubMode === 'records' ? (
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-[#0e1320] p-1 rounded-xl border border-white/10 text-xs">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'lucky_win', label: 'هدايا الحظ 🍀' },
                { id: 'recharge', label: 'الشحن 🪙' },
                { id: 'gift', label: 'الهدايا 🎁' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setRecordsFilter(f.id as typeof recordsFilter)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    recordsFilter === f.id
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              إجمالي السجلات: {filteredRecords.length}
            </span>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-3xl bg-[#0e1320] border border-white/10 p-12 text-center text-xs text-slate-400">
              لا توجد سجلات مطابقة حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredRecords.slice(0, 40).map((tx) => (
                <div
                  key={tx.id}
                  className="p-3.5 rounded-2xl bg-[#0e1320] border border-white/10 flex items-center justify-between gap-3"
                >
                  <div className="text-right min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      {tx.type === 'lucky_win' && (
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate">{tx.details}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {tx.timestamp}
                    </div>
                  </div>
                  <div className="text-left shrink-0 font-mono tabular-nums font-black text-xs">
                    {tx.coinsDelta !== 0 && (
                      <div className={tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {tx.coinsDelta > 0
                          ? `+${tx.coinsDelta.toLocaleString('en-US')}`
                          : tx.coinsDelta.toLocaleString('en-US')}{' '}
                        🪙
                      </div>
                    )}
                    {tx.diamondsDelta !== 0 && (
                      <div className="text-fuchsia-400">
                        {tx.diamondsDelta > 0
                          ? `+${tx.diamondsDelta.toLocaleString('en-US')}`
                          : tx.diamondsDelta.toLocaleString('en-US')}{' '}
                        💎
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Thread List (5 Cols on Desktop) */}
          <div className="md:col-span-5 rounded-3xl bg-[#0e1320] border border-white/10 divide-y divide-white/8 overflow-hidden shadow-xl">
            {/* Official System & Wallet Activity Thread */}
            <button
              onClick={() => openThread('system')}
              className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 transition-colors text-right ${
                selectedUserId === 'system'
                  ? 'bg-amber-400/12'
                  : 'hover:bg-white/[0.04]'
              }`}
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
                const isSelected = selectedUserId === peer.id;

                return (
                  <button
                    key={peer.id}
                    onClick={() => openThread(peer.id)}
                    className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 transition-colors text-right ${
                      isSelected ? 'bg-amber-400/12' : 'hover:bg-white/[0.04]'
                    }`}
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
                          <h3 className="text-sm font-bold text-white truncate">
                            {peer.displayName}
                          </h3>
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

          {/* Desktop Split Conversation / Alerts Pane (7 Cols) */}
          <div className="hidden md:flex md:col-span-7 flex-col h-[calc(100dvh-190px)] min-h-[460px] rounded-3xl bg-[#0e1320] border border-white/10 overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 bg-[#13192c] border-b border-white/10 flex items-center justify-between shrink-0">
              {selectedUserId === 'system' ? (
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold text-white">إشعارات النظام والمحفظة</span>
                </div>
              ) : selectedPeer ? (
                <button
                  onClick={() => {
                    setViewingProfileUser(selectedPeer);
                    setActiveModal('profile');
                  }}
                  className="flex items-center gap-2.5 hover:opacity-90"
                >
                  <img
                    src={selectedPeer.avatar}
                    alt={selectedPeer.displayName}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-amber-400/50"
                  />
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{selectedPeer.displayName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      ID: {selectedPeer.userCode}
                    </div>
                  </div>
                </button>
              ) : (
                <span className="text-sm text-slate-400">اختر محادثة للعرض</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
              {selectedUserId === 'system' ? (
                mySystemAlerts.length === 0 ? (
                  <div className="text-center py-14 text-xs text-slate-400">
                    لا توجد إشعارات أو عمليات مسجلة بعد.
                  </div>
                ) : (
                  mySystemAlerts.slice(0, 25).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8 text-right space-y-1"
                    >
                      <div className="text-xs font-semibold text-white">{tx.details}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                        <span>{tx.timestamp}</span>
                        {tx.coinsDelta !== 0 && (
                          <span className={tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.coinsDelta > 0
                              ? `+${tx.coinsDelta.toLocaleString('en-US')}`
                              : tx.coinsDelta.toLocaleString('en-US')}{' '}
                            🪙
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )
              ) : activeConversationMessages.length === 0 ? (
                <div className="text-center py-14 text-xs text-slate-400">
                  ابدأ المحادثة مع {selectedPeer?.displayName} الآن.
                </div>
              ) : (
                activeConversationMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.isMe ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
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

            {selectedUserId && selectedUserId !== 'system' && (
              <form
                onSubmit={handleSendReply}
                className="p-3.5 bg-[#13192c] border-t border-white/10 flex items-center gap-2 shrink-0"
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

      {/* Mobile Drill-Down Modal (< md) */}
      {mobileShowDetail && selectedUserId && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/75 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full h-[85dvh] bg-[#0e1320] border-t border-white/12 rounded-t-3xl flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-[#13192c] border-b border-white/10 flex items-center justify-between shrink-0">
              <button
                onClick={() => setMobileShowDetail(false)}
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

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {selectedUserId === 'system' ? (
                mySystemAlerts.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">
                    لا توجد إشعارات أو عمليات مسجلة بعد.
                  </div>
                ) : (
                  mySystemAlerts.slice(0, 20).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-2xl bg-white/[0.04] border border-white/8 text-right space-y-1"
                    >
                      <div className="text-xs font-semibold text-white">{tx.details}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                        <span>{tx.timestamp}</span>
                        {tx.coinsDelta !== 0 && (
                          <span className={tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {tx.coinsDelta > 0
                              ? `+${tx.coinsDelta.toLocaleString()}`
                              : tx.coinsDelta.toLocaleString()}{' '}
                            🪙
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

            {selectedUserId !== 'system' && (
              <form
                onSubmit={handleSendReply}
                className="p-3 bg-[#13192c] border-t border-white/10 flex items-center gap-2 shrink-0"
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
