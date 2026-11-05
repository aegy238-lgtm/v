import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Flame,
  Crown,
  Sparkles,
  Plus,
  ChevronLeft,
} from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const { rooms, joinRoom, setActiveModal } = useApp();
  const [activeTopTab, setActiveTopTab] = useState<'me' | 'active' | 'event'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-b from-[#f0fbf7] via-[#f8fdfb] to-white text-slate-900 pb-24 font-tajawal select-none shadow-2xl">
      
      {/* 1. Top Navigation Header (00:42 - 00:47): Search on Left, Tabs (حدث | نشيط | انا) + Emblem on Right */}
      <div className="sticky top-0 z-30 bg-[#f0fbf7]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        
        {/* Left: Search Icon */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 rounded-full hover:bg-teal-100/60 text-slate-600 transition-colors"
          title="بحث"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Right: Tabs (حدث | نشيط | انا) + Golden Crest Avatar */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTopTab('event')}
            className={`text-sm font-bold transition-all ${
              activeTopTab === 'event'
                ? 'text-slate-900 font-black scale-110'
                : 'text-slate-400'
            }`}
          >
            حدث
          </button>

          <button
            onClick={() => setActiveTopTab('active')}
            className={`relative text-lg font-black transition-all ${
              activeTopTab === 'active'
                ? 'text-slate-900 after:content-[""] after:absolute after:-bottom-1 after:inset-x-1 after:h-1 after:rounded-full after:bg-teal-500'
                : 'text-slate-400 text-sm font-bold'
            }`}
          >
            نشيط
          </button>

          <button
            onClick={() => setActiveTopTab('me')}
            className={`text-sm font-bold transition-all ${
              activeTopTab === 'me'
                ? 'text-slate-900 font-black scale-110'
                : 'text-slate-400'
            }`}
          >
            انا
          </button>

          {/* Right Golden Winged Crest */}
          <button
            onClick={() => joinRoom('room_tyy')}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 via-amber-900 to-amber-500 p-0.5 shadow-md flex items-center justify-center"
            title="غرفتي"
          >
            <div className="w-full h-full rounded-full bg-slate-950 flex flex-col items-center justify-center">
              <span className="text-sm leading-none">🦅</span>
              <span className="text-[6px] font-black text-amber-300 uppercase">EMPIRE</span>
            </div>
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {showSearch && (
        <div className="px-4 pb-2 animate-in slide-in-from-top-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن غرفة أو ID..."
            className="w-full bg-white border border-teal-200 rounded-2xl px-4 py-2 text-xs text-slate-800 shadow-inner focus:outline-none focus:border-teal-500"
            autoFocus
          />
        </div>
      )}

      {/* Main Content Container */}
      <div className="px-3 space-y-3 pt-1">
        
        {/* 2. Floating Golden Lucky Multiplier Banner (Exact match to video 00:43 - 00:45) */}
        <div
          onClick={() => joinRoom('room_tyy')}
          className="relative mx-auto w-full h-14 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 border-2 border-yellow-200 shadow-lg px-3 flex items-center justify-between cursor-pointer hover:scale-[1.01] transition-transform"
        >
          {/* Left: Golden Lollipop & Wings */}
          <div className="flex items-center gap-1.5">
            <div className="w-10 h-10 rounded-full bg-pink-500/30 border border-white flex items-center justify-center text-xl shadow">
              🍭
            </div>
          </div>

          {/* Center Text: سمو الامير VIP4 ربح 12250 من الكوينزات في */}
          <div className="flex-1 text-center px-1">
            <div className="flex items-center justify-center gap-1">
              <span className="px-1.5 py-0.2 rounded bg-sky-600 text-white font-black text-[9px]">
                VIP4
              </span>
              <span className="text-xs font-black text-slate-950 truncate">
                🦅 سمو الامير 🦅
              </span>
            </div>
            <div className="text-[11px] font-black text-red-900">
              ربح <span className="underline">12250</span> من الكوينزات في 🍭
            </div>
          </div>

          {/* Right: 250 مرات Multiplier Orb */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-b from-orange-400 via-amber-500 to-red-600 border-2 border-yellow-100 flex flex-col items-center justify-center text-white shadow-md shrink-0">
            <span className="text-xs font-black leading-none">250</span>
            <span className="text-[8px] font-bold leading-none">مرات</span>
          </div>
        </div>

        {/* 3. Three Ornate 3D Metallic Gold Ranking Plaques: FAMILY | CHARM | WEALTH (00:42 - 00:47) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          
          {/* FAMILY Plaque */}
          <div
            onClick={() => setActiveModal('agency')}
            className="relative rounded-2xl p-2 bg-gradient-to-b from-[#2a1b4e] via-[#1a1033] to-[#0f0820] border-2 border-amber-400 shadow-md flex flex-col items-center cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <div className="w-11 h-11 rounded-full ring-2 ring-amber-300 p-0.5 overflow-hidden bg-slate-900 -mt-1 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
                alt="Family Top"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="mt-1.5 w-full py-0.5 rounded bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 text-slate-950 font-black text-[9px] text-center tracking-wider uppercase shadow">
              FAMILY
            </div>
          </div>

          {/* CHARM Plaque */}
          <div
            onClick={() => setActiveModal('vip')}
            className="relative rounded-2xl p-2 bg-gradient-to-b from-[#4a153b] via-[#2e0c25] to-[#170512] border-2 border-amber-400 shadow-md flex flex-col items-center cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <div className="w-11 h-11 rounded-full ring-2 ring-amber-300 p-0.5 overflow-hidden bg-slate-900 -mt-1 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&q=80"
                alt="Charm Top"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="mt-1.5 w-full py-0.5 rounded bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 text-slate-950 font-black text-[9px] text-center tracking-wider uppercase shadow">
              CHARM
            </div>
          </div>

          {/* WEALTH Plaque */}
          <div
            onClick={() => setActiveModal('vip')}
            className="relative rounded-2xl p-2 bg-gradient-to-b from-[#3d260a] via-[#261705] to-[#140b02] border-2 border-amber-400 shadow-md flex flex-col items-center cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <div className="w-11 h-11 rounded-full ring-2 ring-amber-300 p-0.5 overflow-hidden bg-slate-900 -mt-1 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
                alt="Wealth Top"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="mt-1.5 w-full py-0.5 rounded bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600 text-slate-950 font-black text-[9px] text-center tracking-wider uppercase shadow">
              WEALTH
            </div>
          </div>

        </div>

        {/* 4. Featured Luxury Room Grid (Exact Match to Video 00:42 - 00:47) */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* Left Tall Card: بيت العائلة (38 Il.) */}
          <div
            onClick={() => joinRoom('room_tyy')}
            className="row-span-2 relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg border-2 border-amber-400 bg-slate-900 min-h-[250px] flex flex-col justify-end"
          >
            <img
              src="https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?auto=format&fit=crop&w=500&q=80"
              alt="بيت العائلة"
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

            {/* Top decorative red/gold corner */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] shadow">
              TOP 1 👑
            </div>

            <div className="relative z-10 p-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-1 bg-rose-600/90 px-2 py-0.5 rounded-full text-[10px] font-black">
                <span>📊</span>
                <span>38</span>
              </div>
              <span className="text-sm font-black text-amber-300 drop-shadow">
                بيت العائلة
              </span>
            </div>
          </div>

          {/* Right Top Card: عيد الحب (51 Il.) with Purple/Gold Wings */}
          <div
            onClick={() => joinRoom('room_tyy')}
            className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg border-2 border-purple-400 bg-gradient-to-b from-purple-900 via-indigo-950 to-slate-950 h-[120px] flex flex-col justify-between p-2.5"
          >
            <div className="flex items-center justify-center my-auto">
              <div className="relative w-14 h-14 rounded-full ring-2 ring-amber-300 p-0.5 bg-purple-950 shadow-[0_0_20px_rgba(168,85,247,0.8)]">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                  alt="عيد الحب"
                  className="w-full h-full rounded-full object-cover"
                />
                <span className="absolute -top-2 inset-x-0 text-center text-xs">👑</span>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-white">
              <div className="flex items-center gap-1 bg-purple-600/90 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                <span>📊</span>
                <span>51</span>
              </div>
              <span className="text-xs font-black text-amber-200 truncate">
                💜 عيد الحب 💜
              </span>
            </div>
          </div>

          {/* Right Bottom Card: مبروك افتتاح وكالة حفل افتتاح وتكاليف (35 Il.) */}
          <div
            onClick={() => joinRoom('room_tyy')}
            className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-lg border-2 border-amber-400 bg-gradient-to-r from-amber-950 via-stone-900 to-amber-900 h-[120px] flex flex-col justify-between p-2.5"
          >
            <div className="flex items-center justify-between my-auto">
              <div className="text-right">
                <div className="text-xs font-black text-amber-300 leading-tight">
                  مبروك
                </div>
                <div className="text-sm font-black text-white leading-tight">
                  افتتاح وكالة 🤍
                </div>
              </div>
              <img
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=150&q=80"
                alt="افتتاح وكالة"
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-amber-300"
              />
            </div>

            <div className="relative z-10 flex items-center justify-between text-white">
              <div className="flex items-center gap-1 bg-sky-600/90 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                <span>📊</span>
                <span>35</span>
              </div>
              <span className="text-[10px] font-bold text-amber-100 truncate">
                حفل افتتاح وتكاليف...
              </span>
            </div>
          </div>

        </div>

        {/* 5. Bottom Row Cards: الفرحة فرحتنا (الأصدقاء النشطون) + LIONS EMPIRE (00:42 - 00:47) */}
        <div className="grid grid-cols-2 gap-2.5">
          
          {/* Left Card: الفرحة فرحتنا + الأصدقاء النشطون pill */}
          <div
            onClick={() => joinRoom('room_amir')}
            className="relative rounded-2xl overflow-hidden cursor-pointer shadow-md border border-amber-300 bg-amber-50 h-28 p-2.5 flex flex-col justify-between"
          >
            <div className="text-right">
              <span className="text-xs font-black text-amber-900 block">
                الفرحة فرحتنا 🎉
              </span>
              <span className="text-[10px] text-amber-700 font-bold">
                تهنينا ياجدعان خطوبة احلي عروسة
              </span>
            </div>

            {/* Active Friends Pill Overlay */}
            <div className="flex items-center justify-between bg-slate-900/85 text-white px-2.5 py-1.5 rounded-full text-[10px] font-bold shadow">
              <ChevronLeft className="w-3.5 h-3.5 text-amber-300" />
              <span>الأصدقاء النشطون</span>
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                alt="Friend"
                className="w-5 h-5 rounded-full object-cover"
              />
            </div>
          </div>

          {/* Right Card: THE LIONS EMPIRE */}
          <div
            onClick={() => joinRoom('room_aseer')}
            className="relative rounded-2xl overflow-hidden cursor-pointer shadow-md border border-amber-500/60 bg-slate-950 h-28 p-2.5 flex flex-col justify-end text-white"
          >
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
              alt="Lions Empire"
              className="absolute inset-0 w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="relative z-10 text-center">
              <div className="text-xs font-black text-amber-400 tracking-wider uppercase">
                THE LIONS EMPIRE
              </div>
              <div className="text-[9px] text-stone-300 font-bold">
                إمبراطورية الأسود الملكية
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
