import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Crown,
  Plus,
  Mic,
  Users,
  Wallet,
  Briefcase,
  Gamepad2,
  Trophy,
  X,
} from 'lucide-react';

const LOCAL_ROOM_COVERS = [
  '/src/assets/images/room_bg_midnight_lounge_1795294231147.jpg',
  '/src/assets/images/room_bg_royal_majlis_1795294234181.jpg',
  '/src/assets/images/room_bg_starlight_sky_1795294232054.jpg',
];

export const HomeScreen: React.FC = () => {
  const { rooms, currentUser, joinRoom, setActiveModal, setActiveTab } = useApp();
  const [activeTopTab, setActiveTopTab] = useState<'all' | 'mine' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

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
    <div className="min-h-dvh max-w-md mx-auto bg-[#0b101d] text-white pb-24 font-tajawal select-none shadow-2xl">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#0b101d]/95 backdrop-blur-md border-b border-white/8 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-4">
            {[
              { id: 'all', label: 'الغرف النشطة' },
              { id: 'mine', label: 'غرفي' },
              { id: 'vip', label: 'VIP' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTopTab(tab.id as typeof activeTopTab)}
                className={`relative pb-1 text-sm transition-colors ${
                  activeTopTab === tab.id
                    ? 'text-amber-300 font-bold after:content-[""] after:absolute after:bottom-[-4px] after:inset-x-0 after:h-[2px] after:bg-amber-400 after:rounded-full'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Create Room Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSearch((prev) => !prev)}
              className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 flex items-center justify-center text-slate-200 transition-colors"
              title="بحث عن غرفة"
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setActiveModal('create_room')}
              className="h-9 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 transition-colors"
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
              className="w-full h-10 bg-white/6 border border-white/12 rounded-xl px-3.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
              autoFocus
            />
          </div>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Real Quick Shortcuts (Wallet, VIP, Agency, Games — All Working) */}
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => setActiveModal('wallet')}
            className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Wallet className="w-5 h-5 text-amber-400" />
            <span className="text-[11px] font-semibold text-slate-200">المحفظة</span>
          </button>

          <button
            onClick={() => setActiveModal('vip')}
            className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Crown className="w-5 h-5 text-amber-300" />
            <span className="text-[11px] font-semibold text-slate-200">VIP</span>
          </button>

          <button
            onClick={() => setActiveModal('agency')}
            className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Briefcase className="w-5 h-5 text-sky-400" />
            <span className="text-[11px] font-semibold text-slate-200">الوكالات</span>
          </button>

          <button
            onClick={() => setActiveTab('game')}
            className="p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 flex flex-col items-center gap-1.5 transition-colors"
          >
            <Gamepad2 className="w-5 h-5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-slate-200">الألعاب</span>
          </button>
        </div>

        {/* Real Active Voice Rooms List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-300">
              الغرف الصوتية المتاحة ({filteredRooms.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              الرصيد: {currentUser.coins.toLocaleString()} 🪙
            </span>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-8 text-center space-y-3">
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
                className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors"
              >
                + إنشاء غرفة جديدة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredRooms.map((room, index) => {
                const occupiedCount = room.seats.filter((s) => Boolean(s.userId)).length;
                const coverSrc = LOCAL_ROOM_COVERS[index % LOCAL_ROOM_COVERS.length];

                return (
                  <button
                    key={room.id}
                    onClick={() => joinRoom(room.id)}
                    className="relative w-full rounded-2xl overflow-hidden border border-white/10 hover:border-amber-400/50 bg-[#121829] text-right transition-all active:scale-[0.99] shadow-lg"
                  >
                    <img
                      src={coverSrc}
                      alt={room.title}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover opacity-35"
                    />
                    <div className="absolute inset-0 bg-gradient-to-l from-[#0b101d]/95 via-[#0b101d]/75 to-[#0b101d]/45" />

                    <div className="relative z-10 p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={room.ownerAvatar || currentUser.avatar}
                          alt={room.ownerName}
                          referrerPolicy="no-referrer"
                          className="w-14 h-14 rounded-2xl object-cover border border-amber-400/40 shrink-0"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-white truncate">{room.title}</h3>
                            {room.type === 'vip' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-bold shrink-0">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            المضيف: {room.ownerName} ·{' '}
                            <span className="font-mono tabular-nums text-slate-400">
                              ID {room.roomNo}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-300 font-mono tabular-nums">
                            <span className="flex items-center gap-1 text-emerald-300">
                              <Mic className="w-3 h-3" />
                              {occupiedCount}/8
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              {Math.max(1, room.onlineViewersCount)}
                            </span>
                            <span className="flex items-center gap-1 text-amber-300">
                              <Trophy className="w-3 h-3" />
                              {formatDiamonds(room.totalDiamondsEarned)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="h-9 px-3.5 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                        دخول
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
