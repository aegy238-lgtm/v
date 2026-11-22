import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Crown,
  Plus,
  Mic,
  Users,
  Trophy,
  X,
  ShieldAlert,
  CreditCard,
  Lock,
  KeyRound,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

import royalMajlisBg from '../assets/images/room_bg_royal_majlis_1795294234181.jpg';
import midnightLoungeBg from '../assets/images/room_bg_midnight_lounge_1795294231147.jpg';
import starlightSkyBg from '../assets/images/room_bg_starlight_sky_1795294232054.jpg';

const LOCAL_ROOM_COVERS = [
  royalMajlisBg,
  midnightLoungeBg,
  starlightSkyBg,
];

export const HomeScreen: React.FC = () => {
  const {
    rooms,
    roomBackgrounds,
    currentUser,
    isRoomModerator,
    joinRoom,
    setActiveModal,
    setCurrentView,
  } = useApp();
  const [activeTopTab, setActiveTopTab] = useState<'all' | 'mine' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [passwordModalRoomId, setPasswordModalRoomId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [joinFeedbackToast, setJoinFeedbackToast] = useState<string | null>(null);

  const triggerJoinToast = (msg: string) => {
    setJoinFeedbackToast(msg);
    window.setTimeout(() => {
      setJoinFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleAttemptJoinRoom = (roomId: string) => {
    const res = joinRoom(roomId);
    if (res.success) return;
    if (res.reason === 'password_required') {
      setPasswordModalRoomId(roomId);
      setPasswordInput('');
      setPasswordError(null);
      return;
    }
    if (res.message) {
      triggerJoinToast(res.message);
    }
  };

  const handleSubmitRoomPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalRoomId) return;
    const res = joinRoom(passwordModalRoomId, passwordInput);
    if (res.success) {
      setPasswordModalRoomId(null);
      setPasswordInput('');
      setPasswordError(null);
      return;
    }
    if (res.reason === 'wrong_password' || res.reason === 'password_required') {
      setPasswordError(res.message || 'رمز المرور غير صحيح.');
    } else {
      setPasswordModalRoomId(null);
      if (res.message) triggerJoinToast(res.message);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredRooms = rooms.filter((room) => {
    if (activeTopTab === 'mine' && room.ownerId !== currentUser.id) {
      return false;
    }
    if (activeTopTab === 'vip' && room.type !== 'vip' && room.totalDiamondsEarned < 500000) {
      return false;
    }
    if (!normalizedQuery) return true;
    return (
      room.title.toLowerCase().includes(normalizedQuery) ||
      room.roomNo.toLowerCase().includes(normalizedQuery) ||
      room.ownerName.toLowerCase().includes(normalizedQuery)
    );
  });

  const formatDiamonds = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  return (
    <div className="min-h-dvh w-full max-w-6xl mx-auto bg-[#070a12] text-white pb-28 font-tajawal select-none">
      {/* Sticky Luxury Header */}
      <header className="sticky top-0 z-30 bg-[#070a12]/90 backdrop-blur-xl border-b border-white/10 px-3.5 sm:px-6 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Right in RTL: Brand Identity + Filter Tabs */}
          <div className="flex items-center gap-3.5 sm:gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                <Crown className="w-4 h-4" />
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-amber-300 leading-tight">عيوني شات</div>
                <div className="text-[10px] text-slate-400 font-mono">ooyuni chat VIP</div>
              </div>
            </div>

            <div className="flex items-center gap-3.5 sm:gap-4 border-r border-white/10 pr-3 sm:pr-4">
              {[
                { id: 'all', label: 'الغرف النشطة' },
                { id: 'mine', label: 'غرفي' },
                { id: 'vip', label: 'VIP' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTopTab(tab.id as typeof activeTopTab)}
                  className={`relative pb-1 text-xs sm:text-sm whitespace-nowrap transition-colors ${
                    activeTopTab === tab.id
                      ? 'text-amber-300 font-bold after:content-[""] after:absolute after:bottom-[-4px] after:inset-x-0 after:h-[2px] after:bg-amber-400 after:rounded-full'
                      : 'text-slate-400 hover:text-slate-200 font-medium'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Left in RTL: Wallet Balance + Portals + Search + Create Room */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setActiveModal('wallet')}
              className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#111626] hover:bg-[#171d32] border border-amber-400/25 flex items-center gap-1.5 text-xs transition-colors"
              title="المحفظة"
            >
              <span className="text-amber-300 font-mono tabular-nums font-bold">
                {currentUser.coins.toLocaleString('en-US')} 🪙
              </span>
            </button>

            <button
              onClick={() => setCurrentView('agent_portal')}
              className="hidden sm:flex h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 items-center gap-1.5 text-xs text-teal-300 font-semibold transition-colors"
              title="بوابة وكيل الشحن"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>الوكيل</span>
            </button>

            <button
              onClick={() => setCurrentView('admin_dashboard')}
              className="hidden sm:flex h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 items-center gap-1.5 text-xs text-indigo-300 font-semibold transition-colors"
              title="لوحة الإدارة"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>الإدارة</span>
            </button>

            <button
              onClick={() => setShowSearch((prev) => !prev)}
              className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-200 transition-colors"
              title="بحث عن غرفة"
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setActiveModal('create_room')}
              className="h-9 px-3 sm:px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء غرفة</span>
            </button>
          </div>
        </div>

        {showSearch && (
          <div className="pt-0.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الغرفة أو رقم ID أو اسم المضيف..."
              className="w-full h-10 bg-[#0f1422] border border-white/12 rounded-xl px-3.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
              autoFocus
            />
          </div>
        )}
      </header>

      {/* Active Voice Rooms — 2 Side-by-Side Square Cards */}
      <div className="px-3.5 sm:px-6 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Mic className="w-4 h-4 text-amber-400" />
            <span>الغرف الصوتية المباشرة</span>
            <span className="text-xs font-mono tabular-nums text-amber-300">
              ({filteredRooms.length})
            </span>
          </h2>
          <span className="text-[11px] text-slate-400">اضغط على أي غرفة للدخول</span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="rounded-3xl bg-[#0e1320] border border-white/10 p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/6 mx-auto flex items-center justify-center text-slate-400">
              <Mic className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300">
              {normalizedQuery
                ? 'لا توجد غرف مطابقة للبحث الحالي.'
                : activeTopTab === 'mine'
                ? 'لم تقم بإنشاء غرفة بعد.'
                : 'لا توجد غرف متاحة في هذا القسم حالياً.'}
            </p>
            <button
              onClick={() => setActiveModal('create_room')}
              className="h-10 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors"
            >
              + إنشاء غرفة جديدة
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredRooms.map((room, index) => {
              const occupiedCount = room.seats.filter((s) => Boolean(s.userId)).length;
              const matchedAdminBg = room.backgroundId
                ? roomBackgrounds.find((b) => b.id === room.backgroundId)
                : undefined;
              const builtinBg =
                room.backgroundId === 'midnight'
                  ? midnightLoungeBg
                  : room.backgroundId === 'majlis'
                  ? royalMajlisBg
                  : room.backgroundId === 'starlight'
                  ? starlightSkyBg
                  : undefined;
              const coverSrc =
                room.backgroundUrl ||
                matchedAdminBg?.imageUrl ||
                builtinBg ||
                LOCAL_ROOM_COVERS[index % LOCAL_ROOM_COVERS.length];
              const userIsMod = isRoomModerator(room);

              return (
                <button
                  key={room.id}
                  onClick={() => handleAttemptJoinRoom(room.id)}
                  className="group relative w-full aspect-square rounded-2xl overflow-hidden border border-white/12 hover:border-amber-400/70 bg-[#0e1320] text-right transition-all active:scale-[0.98] shadow-xl flex flex-col justify-between p-3"
                >
                  <img
                    src={coverSrc}
                    alt={room.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/50 to-[#070a12]/35" />

                  {/* Top Row: Host Avatar + Mic Count / Privacy / Moderator */}
                  <div className="relative z-10 flex items-start justify-between gap-2 w-full">
                    <div className="relative shrink-0">
                      <img
                        src={room.ownerAvatar || currentUser.avatar}
                        alt={room.ownerName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover border border-amber-400/60 shadow-md"
                      />
                      {room.type === 'vip' && (
                        <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[8px] font-black shadow">
                          VIP
                        </span>
                      )}
                      {room.type === 'password' && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-md bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                          <KeyRound className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 text-[10px] font-mono tabular-nums">
                      <span className="px-2 py-0.5 rounded-lg bg-black/55 backdrop-blur-sm border border-white/10 text-emerald-300 font-bold flex items-center gap-1">
                        <Mic className="w-2.5 h-2.5" />
                        {occupiedCount}/8
                      </span>
                      <span className="text-[9px] text-slate-300/90 bg-black/45 px-1.5 py-0.5 rounded-md">
                        ID {room.roomNo}
                      </span>
                      {room.isLocked && (
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-600/80 text-white text-[9px] font-bold flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> مقفلة
                        </span>
                      )}
                      {userIsMod && (
                        <span className="px-1.5 py-0.5 rounded-md bg-sky-500/25 border border-sky-400/40 text-sky-300 text-[9px] font-bold flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> مشرف
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Row: Room Title, Host & Metrics */}
                  <div className="relative z-10 w-full space-y-1.5">
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-white line-clamp-1 leading-snug">
                        {room.title}
                      </h3>
                      <div className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                        {room.ownerName}
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-white/12 flex items-center justify-between text-[10px] font-mono tabular-nums">
                      <span className="flex items-center gap-1 text-slate-200">
                        <Users className="w-3 h-3 text-sky-300" />
                        {Math.max(1, room.onlineViewersCount)}
                      </span>
                      <span className="flex items-center gap-1 text-amber-300 font-bold">
                        <Trophy className="w-3 h-3" />
                        {formatDiamonds(room.totalDiamondsEarned)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Non-blocking Join Error Toast */}
      {joinFeedbackToast && (
        <div className="fixed top-16 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-md w-full rounded-2xl bg-rose-950/95 border border-rose-500/50 px-4 py-3 shadow-2xl flex items-center justify-between gap-3 text-xs text-rose-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{joinFeedbackToast}</span>
            </div>
            <button
              onClick={() => setJoinFeedbackToast(null)}
              className="text-rose-300 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Room Password Entry Modal */}
      {passwordModalRoomId && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPasswordModalRoomId(null)}
        >
          <form
            onSubmit={handleSubmitRoomPassword}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#111626] border border-amber-400/35 p-5 space-y-4 shadow-2xl text-right"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-amber-300">
                <KeyRound className="w-4 h-4" />
                <span>غرفة محمية برمز مرور</span>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalRoomId(null)}
                className="w-7 h-7 rounded-lg bg-white/8 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              أدخل رمز المرور الخاص بهذه الغرفة للدخول:
            </p>

            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="رمز مرور الغرفة..."
              autoFocus
              className="w-full h-11 rounded-xl bg-slate-950 border border-white/15 px-3.5 text-sm font-mono text-white focus:border-amber-400 focus:outline-none"
            />

            {passwordError && (
              <div className="text-xs text-rose-400 font-bold">{passwordError}</div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPasswordModalRoomId(null)}
                className="h-10 px-4 rounded-xl bg-white/8 text-slate-300 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors"
              >
                دخول الغرفة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
