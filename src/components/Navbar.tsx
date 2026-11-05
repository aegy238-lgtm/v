import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Coins,
  Gem,
  Plus,
  Crown,
  Bell,
  MessageCircle,
  Globe,
  Shield,
  CreditCard,
  Radio,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { sound } from '../utils/audio';
import { Language } from '../types';

export const Navbar: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    currentUser,
    users,
    switchUserIdentity,
    currentView,
    setCurrentView,
    setActiveModal,
    setViewingProfileUser,
  } = useApp();

  const [isAudioMuted, setIsAudioMuted] = useState(sound.getIsMuted());
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsAudioMuted(muted);
  };

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'ar', label: 'العربية (RTL)', flag: '🇸🇦' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
    { code: 'hi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
    { code: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'fil', label: 'Filipino (Tagalog)', flag: '🇵🇭' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left: Brand & View Mode Switcher */}
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setCurrentView('user_app')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-amber-400 via-rose-300 to-amber-200 bg-clip-text text-transparent">
                  {t.appName}
                </span>
                <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  VIP LIVE
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Tabs (User App / Recharge Agent / Admin Dashboard) */}
          <div className="hidden lg:flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setCurrentView('user_app')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'user_app'
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{t.userApp}</span>
            </button>

            <button
              onClick={() => setCurrentView('agent_portal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'agent_portal'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t.rechargeAgent}</span>
            </button>

            <button
              onClick={() => setCurrentView('admin_dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'admin_dashboard'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t.adminDashboard}</span>
            </button>
          </div>
        </div>

        {/* Center: Currency Pills (Coins & Diamonds) */}
        <div className="flex items-center gap-2">
          {/* Coins */}
          <div 
            onClick={() => setActiveModal('wallet')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-amber-500/30 cursor-pointer transition-colors group"
            title="شحن العملات الذهبية"
          >
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1 text-right">
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-amber-300">
                {currentUser.coins.toLocaleString()}
              </span>
              <span className="text-[10px] text-amber-400/80 hidden sm:inline">{t.coins}</span>
            </div>
            <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold group-hover:scale-110 transition-transform">
              <Plus className="w-3 h-3" />
            </div>
          </div>

          {/* Diamonds */}
          <div 
            onClick={() => setActiveModal('wallet')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-800 border border-cyan-500/30 cursor-pointer transition-colors group"
            title="رصيد الألماس القابل للسحب"
          >
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Gem className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-baseline gap-1 text-right">
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-cyan-300">
                {currentUser.diamonds.toLocaleString()}
              </span>
              <span className="text-[10px] text-cyan-400/80 hidden sm:inline">{t.diamonds}</span>
            </div>
          </div>
        </div>

        {/* Right: Sound toggle, Language, Messages, Profile & Switch Identity */}
        <div className="flex items-center gap-2">
          {/* Sound Mute/Unmute */}
          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-colors ${
              isAudioMuted
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-amber-400'
            }`}
            title={isAudioMuted ? 'تفعيل الصوت' : 'كتم المؤثرات الصوتية'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors text-xs"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="uppercase font-mono">{lang}</span>
            </button>

            {showLangMenu && (
              <div className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1 z-50">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      setShowLangMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-right transition-colors ${
                      lang === l.code ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{l.label}</span>
                    <span>{l.flag}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Messages Drawer */}
          <button
            onClick={() => setActiveModal('messages')}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition-colors relative"
            title={t.messages}
          >
            <MessageCircle className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
          </button>

          {/* VIP Center Trigger */}
          <button
            onClick={() => setActiveModal('vip')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-600/20 border border-amber-500/40 text-amber-300 hover:border-amber-400 transition-all text-xs font-bold"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>VIP {currentUser.vipLevel}</span>
          </button>

          {/* User Profile Avatar & Switch User Dropdown */}
          <div className="relative">
            <div
              onClick={() => setShowIdentityMenu(!showIdentityMenu)}
              className="flex items-center gap-2 p-1 pl-2 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all"
            >
              <div className="relative">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.displayName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400"
                />
                <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] leading-tight">
                  Lv{currentUser.level}
                </span>
              </div>
              <div className="hidden md:block text-right">
                <div className="text-xs font-semibold text-slate-200 truncate max-w-[100px]">
                  {currentUser.displayName}
                </div>
                <div className="text-[10px] text-amber-400 font-mono">
                  ID: {currentUser.userCode}
                </div>
              </div>
            </div>

            {/* Switch User / Quick Actions Menu */}
            {showIdentityMenu && (
              <div className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50">
                <div className="p-2 border-b border-slate-800 mb-2">
                  <div className="text-xs text-slate-400 mb-1">المستخدم الحالي:</div>
                  <div className="font-bold text-sm text-slate-100 flex items-center justify-between">
                    <span>{currentUser.displayName}</span>
                    <span className="text-xs text-amber-400">VIP {currentUser.vipLevel}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {currentUser.userCode}</div>
                </div>

                <div className="space-y-1 mb-2">
                  <button
                    onClick={() => {
                      setViewingProfileUser(currentUser);
                      setActiveModal('profile');
                      setShowIdentityMenu(false);
                    }}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>عرض وتعديل ملفي الشخصي</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveModal('wallet');
                      setShowIdentityMenu(false);
                    }}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>المحفظة وسجل المعاملات</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveModal('backpack');
                      setShowIdentityMenu(false);
                    }}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                  >
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    <span>الحقيبة والإطارات المملوكة</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400 px-2 mb-1">تبديل الحساب التجريبي:</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {users.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUserIdentity(u.id);
                          setShowIdentityMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-right text-xs transition-colors ${
                          u.id === currentUser.id ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <img src={u.avatar} alt={u.displayName} className="w-6 h-6 rounded-full object-cover" />
                        <div className="truncate flex-1">
                          <div>{u.displayName}</div>
                          <div className="text-[9px] text-slate-400">VIP {u.vipLevel} · Lv{u.level}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile View Switches */}
                <div className="pt-2 border-t border-slate-800 lg:hidden flex flex-col gap-1 mt-2">
                  <button
                    onClick={() => {
                      setCurrentView('agent_portal');
                      setShowIdentityMenu(false);
                    }}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs bg-teal-500/10 text-teal-300"
                  >
                    بوابة وكيل الشحن
                  </button>
                  <button
                    onClick={() => {
                      setCurrentView('admin_dashboard');
                      setShowIdentityMenu(false);
                    }}
                    className="w-full text-right px-3 py-1.5 rounded-lg text-xs bg-indigo-500/10 text-indigo-300"
                  >
                    لوحة تحكم الإدارة Super Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </header>
  );
};
