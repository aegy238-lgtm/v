import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Copy,
  Check,
  Edit3,
  ChevronLeft,
  ShieldAlert,
  CreditCard,
  X,
  Sparkles,
  Award,
  Heart,
  Users,
  Gift,
  Volume2,
  Bell,
  Lock,
  Globe,
  Trash2,
  Home,
} from 'lucide-react';

type ProfileSubModal =
  | 'none'
  | 'edit_profile'
  | 'social_list'
  | 'levels'
  | 'badges'
  | 'cp_space'
  | 'special_id'
  | 'invite'
  | 'settings'
  | 'about';

export const ProfileScreen: React.FC = () => {
  const {
    currentUser,
    users,
    joinRoom,
    setActiveModal,
    setViewingProfileUser,
    setCurrentView,
    updateUserProfile,
    rechargeCoins,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [subModal, setSubModal] = useState<ProfileSubModal>('none');
  const [socialTab, setSocialTab] = useState<'friends' | 'following' | 'fans' | 'visitors'>('friends');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Edit profile form state
  const [editName, setEditName] = useState(currentUser.displayName || 'الدبلان');
  const [editBio, setEditBio] = useState(currentUser.bio || 'مرحباً بكم في عالمي الملكي 👑');
  const [editCountry, setEditCountry] = useState(currentUser.country || '🇩🇿 الجزائر');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editAge, setEditAge] = useState<number>(60);

  // Badges state
  const [equippedBadges, setEquippedBadges] = useState<string[]>(['badge_vip5', 'badge_wealth', 'badge_lucky']);

  // CP state
  const [cpPartnerId, setCpPartnerId] = useState<string>(users[1]?.id || 'user_2');
  const [cpLovePoints, setCpLovePoints] = useState<number>(15420);
  const [cpRingTier, setCpRingTier] = useState<string>('خاتم الألماس الأبدي 💍');

  // Settings state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [hideVisitorStatus, setHideVisitorStatus] = useState(false);

  // Claimed states
  const [claimedDailyLevelBonus, setClaimedDailyLevelBonus] = useState(false);
  const [claimedInviteBonus, setClaimedInviteBonus] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(currentUser.userCode || '6919142');
    setCopied(true);
    showToast(`تم نسخ الأيدي بنجاح: ${currentUser.userCode || '6919142'} ✅`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserProfile({
      displayName: editName.trim() || currentUser.displayName,
      bio: editBio.trim(),
      country: editCountry,
      avatar: editAvatar.trim() || currentUser.avatar,
    });
    setSubModal('none');
    showToast('تم حفظ تعديلات الملف الشخصي بنجاح ✨');
  };

  const avatarPresets = [
    currentUser.avatar,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
  ];

  const allBadgesCatalog = [
    { id: 'badge_vip5', name: 'إمبراطور VIP', icon: '👑', desc: 'وسام كبار الشخصيات الملكي', color: 'from-amber-400 to-yellow-600' },
    { id: 'badge_wealth', name: 'أسطورة الثروة', icon: '💎', desc: 'إرسال أكثر من 100K كوينز هدايا', color: 'from-purple-500 to-indigo-600' },
    { id: 'badge_lucky', name: 'صائد الحظ 500X', icon: '🍀', desc: 'الفوز بمضاعف الحظ الأسطوري', color: 'from-emerald-400 to-teal-600' },
    { id: 'badge_rocket', name: 'مفجر الصواريخ', icon: '🚀', desc: 'تفجير صاروخ الغرفة المستوى 5', color: 'from-rose-500 to-orange-500' },
    { id: 'badge_mic', name: 'نجم المايك الذهبي', icon: '🎙️', desc: 'التحدث على المايك لأكثر من 50 ساعة', color: 'from-cyan-400 to-blue-600' },
    { id: 'badge_cp', name: 'ثنائي العشق الملكي', icon: '💞', desc: 'شريك الروح CP المستوى الذهبي', color: 'from-pink-400 to-rose-600' },
  ];

  const specialIdsCatalog = [
    { code: '6919142', label: 'أيدي ملكي مميز', price: 0, tag: 'مملوك' },
    { code: '777777', label: 'سباعي ملكي نادر جداً', price: 25000, tag: 'نادر 🔥' },
    { code: '888888', label: 'ثماني الإمبراطور الذهبي', price: 35000, tag: 'VIP 👑' },
    { code: '100001', label: 'أيدي النخبة الأول', price: 15000, tag: 'مميز ✨' },
    { code: '555555', label: 'خماسي الماس الفاخر', price: 20000, tag: 'ملكي 💎' },
    { code: '999999', label: 'تساعي الأسطورة الخالدة', price: 50000, tag: 'أسطوري 🏆' },
  ];

  const cpPartner = users.find((u) => u.id === cpPartnerId) || users[1] || currentUser;

  return (
    <div className="relative min-h-screen max-w-md mx-auto bg-gradient-to-b from-[#d8f8f0] via-[#effbf7] to-[#f4f7f9] text-slate-900 pb-24 font-tajawal select-none shadow-2xl overflow-x-hidden">
      
      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 px-4 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-400 text-amber-300 text-xs font-black text-center shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
          {toastMsg}
        </div>
      )}

      {/* Decorative Soft Top Pattern */}
      <div className="absolute top-0 inset-x-0 h-56 bg-[radial-gradient(circle_at_75%_20%,rgba(45,212,191,0.22),transparent_60%)] pointer-events-none" />

      {/* ===================================================================== */}
      {/* 1. TOP HEADER BAR (Matches Screenshot #2: Edit on Left, ملكي on Right) */}
      {/* ===================================================================== */}
      <div className="relative z-10 px-4 pt-3.5 pb-1 flex items-center justify-between">
        {/* Left: Edit Profile Button */}
        <button
          onClick={() => {
            setEditName(currentUser.displayName);
            setEditBio(currentUser.bio || 'مرحباً بكم في عالمي الملكي 👑');
            setEditAvatar(currentUser.avatar);
            setSubModal('edit_profile');
          }}
          className="w-9 h-9 rounded-xl bg-white/80 border border-amber-500/40 flex items-center justify-center text-amber-700 shadow-xs hover:bg-white active:scale-95 transition-transform"
          title="تعديل الملف الشخصي"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        {/* Center Quick Admin & Agent Portals */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentView('agent_portal')}
            className="px-2.5 py-1 rounded-full bg-teal-600/15 border border-teal-600/30 text-teal-900 text-[10px] font-black flex items-center gap-1 hover:bg-teal-600/25 transition-colors"
          >
            <CreditCard className="w-3 h-3" />
            <span>وكيل الشحن</span>
          </button>
          <button
            onClick={() => setCurrentView('admin_dashboard')}
            className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-900 text-[10px] font-black flex items-center gap-1 hover:bg-amber-500/30 transition-colors"
          >
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            <span>الإدارة</span>
          </button>
        </div>

        {/* Right: "ملكي" Title */}
        <span className="text-lg font-black text-teal-800 tracking-wide">ملكي</span>
      </div>

      {/* ===================================================================== */}
      {/* 2. HERO PROFILE CARD WITH ORNATE GOLDEN VIP FRAME (Screenshot #2)     */}
      {/* ===================================================================== */}
      <div className="relative z-10 px-3.5 pt-10">
        <div className="relative bg-white/95 backdrop-blur-md rounded-3xl pt-14 pb-4 px-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] border border-white">
          
          {/* Overlapping Ornate 3D Golden Tiger/VIP5 Frame Avatar */}
          <div
            onClick={() => setSubModal('edit_profile')}
            className="absolute -top-11 left-1/2 -translate-x-1/2 cursor-pointer group"
          >
            <div className="relative w-24 h-24 rounded-2xl p-1 bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700 shadow-[0_6px_25px_rgba(245,158,11,0.55)] ring-2 ring-amber-200">
              {/* Ornate Corner Embellishments */}
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl drop-shadow">
                👑
              </span>
              <span className="absolute -bottom-1 -left-2 text-lg drop-shadow">🐆</span>
              <span className="absolute -bottom-1 -right-2 text-lg drop-shadow">🐆</span>

              <img
                src={currentUser.avatar}
                alt={currentUser.displayName}
                className="w-full h-full rounded-xl object-cover border-2 border-amber-100"
              />

              {/* Bottom VIP5 Golden Ribbon Plate */}
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700 border border-yellow-100 text-[10px] font-black text-slate-950 shadow-md whitespace-nowrap">
                VIP {currentUser.vipLevel || 5}
              </div>
            </div>
          </div>

          {/* Name & Blue Gender/Age Badge */}
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white font-black text-[10px] flex items-center gap-0.5 shadow-xs">
              <span>♂</span>
              <span>{editAge}</span>
            </span>
            <h1 className="text-base font-black text-amber-500 drop-shadow-xs">
              {currentUser.displayName || 'الدبلان'}
            </h1>
          </div>

          {/* ID Row with Copy Icon */}
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <button
              onClick={handleCopyId}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg hover:bg-slate-100 text-slate-600 font-mono font-black text-sm transition-colors"
            >
              <span>ID:{currentUser.userCode || '6919142'}</span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          {/* 4 Emblem Badges Row: Flame 7 | Shield 7 | Golden VIP5 | Flag */}
          <div className="flex items-center justify-center gap-2 mt-2 pb-3 border-b border-slate-100">
            <button
              onClick={() => setSubModal('levels')}
              className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 text-white font-black text-[10px] flex items-center gap-1 shadow-xs active:scale-95"
            >
              <span>🔥</span>
              <span>{currentUser.level || 7}</span>
            </button>

            <button
              onClick={() => setSubModal('levels')}
              className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-700 to-yellow-600 text-white font-black text-[10px] flex items-center gap-1 shadow-xs active:scale-95"
            >
              <span>🛡️</span>
              <span>7</span>
            </button>

            <button
              onClick={() => setActiveModal('vip')}
              className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 text-slate-950 font-black text-[10px] border border-amber-700/40 shadow-xs active:scale-95"
            >
              VIP {currentUser.vipLevel || 5}
            </button>

            <span className="text-base">{editCountry.split(' ')[0] || '🇩🇿'}</span>
          </div>

          {/* 4 Interactive Stats Columns: زائر | المعجبون | المتابعون | أصدقاء */}
          <div className="grid grid-cols-4 pt-3 text-center">
            <button
              onClick={() => {
                setSocialTab('visitors');
                setSubModal('social_list');
              }}
              className="relative flex flex-col items-center hover:bg-slate-50 rounded-xl py-1 transition-colors"
            >
              <span className="absolute -top-1 left-3 px-1.5 py-0.1 rounded-full bg-rose-500 text-white font-black text-[9px]">
                +3
              </span>
              <span className="text-base font-black text-slate-900">
                {currentUser.visitorsCount || 3}
              </span>
              <span className="text-[11px] font-bold text-slate-500">زائر</span>
            </button>

            <button
              onClick={() => {
                setSocialTab('fans');
                setSubModal('social_list');
              }}
              className="relative flex flex-col items-center hover:bg-slate-50 rounded-xl py-1 transition-colors"
            >
              <span className="absolute -top-1 left-3 px-1.5 py-0.1 rounded-full bg-rose-500 text-white font-black text-[9px]">
                +1
              </span>
              <span className="text-base font-black text-slate-900">
                {currentUser.followersCount || 2}
              </span>
              <span className="text-[11px] font-bold text-slate-500">المعجبون</span>
            </button>

            <button
              onClick={() => {
                setSocialTab('following');
                setSubModal('social_list');
              }}
              className="flex flex-col items-center hover:bg-slate-50 rounded-xl py-1 transition-colors"
            >
              <span className="text-base font-black text-slate-900">
                {currentUser.followingCount || 1}
              </span>
              <span className="text-[11px] font-bold text-slate-500">المتابعون</span>
            </button>

            <button
              onClick={() => {
                setSocialTab('friends');
                setSubModal('social_list');
              }}
              className="flex flex-col items-center hover:bg-slate-50 rounded-xl py-1 transition-colors"
            >
              <span className="text-base font-black text-slate-900">
                {Math.max(1, users.length - 1)}
              </span>
              <span className="text-[11px] font-bold text-slate-500">أصدقاء</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. MY WALLET SECTION: محفظتي + الكونزة + الماس (Exact Screenshot #2)   */}
      {/* ===================================================================== */}
      <div className="px-3.5 mt-3">
        <div className="rounded-3xl overflow-hidden bg-white shadow-[0_8px_25px_rgba(15,23,42,0.05)] border border-white">
          {/* Top Golden Brown Header Banner: < | محفظتي 👛 */}
          <button
            onClick={() => setActiveModal('wallet')}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-[#593a1e] via-[#85582c] to-[#634121] text-white flex items-center justify-between hover:opacity-95 transition-opacity"
          >
            <ChevronLeft className="w-4 h-4 text-amber-200" />
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white">محفظتي</span>
              <span className="text-xl drop-shadow">👛</span>
            </div>
          </button>

          {/* Two Side-by-Side 3D Balance Cards: الماس (Purple) & الكونزة (Gold) */}
          <div className="p-3 grid grid-cols-2 gap-2.5">
            {/* Left: الماس (Diamonds) */}
            <button
              onClick={() => setActiveModal('wallet')}
              className="relative h-20 rounded-2xl bg-gradient-to-r from-purple-200 via-fuchsia-100 to-purple-50 border border-purple-200/80 p-3 flex items-center justify-between overflow-hidden active:scale-95 transition-transform"
            >
              <div className="text-3xl drop-shadow-md">💎</div>
              <div className="text-right">
                <div className="text-xs font-black text-purple-800">الماس</div>
                <div className="text-sm font-mono font-black text-slate-900 mt-1">
                  {currentUser.diamonds.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </button>

            {/* Right: الكونزة (Coins) */}
            <button
              onClick={() => setActiveModal('wallet')}
              className="relative h-20 rounded-2xl bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-50 border border-amber-300/80 p-3 flex items-center justify-between overflow-hidden active:scale-95 transition-transform"
            >
              <div className="text-3xl drop-shadow-md">🪙</div>
              <div className="text-right">
                <div className="text-xs font-black text-amber-900">الكونزة</div>
                <div className="text-sm font-mono font-black text-slate-900 mt-1">
                  {currentUser.coins.toLocaleString('en-US')}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. THREE 3D GRAPHIC CARDS: VIP (Left) + مستوى & الشارة (Right)         */}
      {/* ===================================================================== */}
      <div className="px-3.5 mt-3 grid grid-cols-2 gap-2.5">
        {/* Left Tall Orange 3D Card: VIP */}
        <button
          onClick={() => setActiveModal('vip')}
          className="relative h-38 rounded-3xl bg-gradient-to-br from-amber-300 via-orange-400 to-amber-500 p-3.5 text-right flex flex-col justify-between overflow-hidden shadow-md border border-amber-200 active:scale-95 transition-transform"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-xs border border-white/40 flex items-center justify-center text-3xl shadow-inner">
              💎
            </div>
            <span className="text-2xl font-black italic text-white drop-shadow">VIP</span>
          </div>
          <div>
            <div className="text-xs font-black text-amber-950/80">شرف ملكي خاص</div>
            <div className="text-sm font-black text-amber-950 mt-0.5">
              المستوى: VIP{currentUser.vipLevel || 5}
            </div>
          </div>
        </button>

        {/* Right Stacked Cards: مستوى (Blue) & الشارة (Emerald Green) */}
        <div className="flex flex-col gap-2.5 h-38">
          {/* Top-Right: مستوى (Level) */}
          <button
            onClick={() => setSubModal('levels')}
            className="flex-1 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 px-3.5 py-2 flex items-center justify-between shadow-md border border-sky-200 active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-white/25 border border-white/40 flex items-center justify-center text-2xl shadow">
              🏆
            </div>
            <div className="text-right">
              <div className="text-base font-black text-white drop-shadow">مستوى</div>
              <div className="text-[10px] font-bold text-sky-100">
                Lv.{currentUser.level || 41} الثروة والجاذبية
              </div>
            </div>
          </button>

          {/* Bottom-Right: الشارة (Badges) */}
          <button
            onClick={() => setSubModal('badges')}
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 px-3.5 py-2 flex items-center justify-between shadow-md border border-emerald-400/50 active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-300/60 flex items-center justify-center text-2xl shadow">
              👑
            </div>
            <div className="text-right">
              <div className="text-base font-black text-white drop-shadow">الشارة</div>
              <div className="text-[10px] font-bold text-emerald-200">
                {equippedBadges.length} أوسمة مفعلة
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. SIX 3D ACTION GRID ICONS (المتجر | CP | حقيبة | ايدي مميز | دعوة | وكالة) */}
      {/* ===================================================================== */}
      <div className="px-3.5 mt-3">
        <div className="bg-white rounded-3xl p-4 shadow-[0_8px_25px_rgba(15,23,42,0.05)] border border-white grid grid-cols-4 gap-y-4 gap-x-2 text-center">
          {/* ايدي مميز */}
          <button
            onClick={() => setSubModal('special_id')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-purple-400 to-fuchsia-600 text-white flex items-center justify-center shadow-md border border-purple-200">
              <span className="text-xs font-black px-1.5 py-0.5 rounded bg-white/20">ID</span>
            </div>
            <span className="text-xs font-bold text-slate-700">ايدي مميز</span>
          </button>

          {/* حقيبة */}
          <button
            onClick={() => setActiveModal('backpack')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-indigo-400 to-purple-600 text-white flex items-center justify-center text-xl shadow-md border border-indigo-200">
              🎒
            </div>
            <span className="text-xs font-bold text-slate-700">حقيبة</span>
          </button>

          {/* CP */}
          <button
            onClick={() => setSubModal('cp_space')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-pink-400 to-rose-500 text-white flex items-center justify-center text-xl shadow-md border border-pink-200">
              💞
            </div>
            <span className="text-xs font-bold text-slate-700">CP</span>
          </button>

          {/* المتجر */}
          <button
            onClick={() => setActiveModal('store')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-sky-400 to-blue-600 text-white flex items-center justify-center text-xl shadow-md border border-sky-200">
              🏪
            </div>
            <span className="text-xs font-bold text-slate-700">المتجر</span>
          </button>

          {/* غرفتي الصوتية */}
          <button
            onClick={() => joinRoom('room_tyy')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md border border-amber-200">
              <Home className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-700">غرفتي</span>
          </button>

          {/* الرسائل */}
          <button
            onClick={() => setActiveModal('messages')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-cyan-400 to-teal-600 text-white flex items-center justify-center text-xl shadow-md border border-cyan-200">
              💬
            </div>
            <span className="text-xs font-bold text-slate-700">رسائلي</span>
          </button>

          {/* وكالة */}
          <button
            onClick={() => setActiveModal('agency')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-400 to-teal-600 text-white flex items-center justify-center text-xl shadow-md border border-emerald-200">
              🏛️
            </div>
            <span className="text-xs font-bold text-slate-700">وكالة</span>
          </button>

          {/* دعوة */}
          <button
            onClick={() => setSubModal('invite')}
            className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-orange-400 to-rose-500 text-white flex items-center justify-center text-xl shadow-md border border-orange-200">
              🎁
            </div>
            <span className="text-xs font-bold text-slate-700">دعوة</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 6. BOTTOM SETTINGS & ABOUT LIST (Matches Screenshot #2)               */}
      {/* ===================================================================== */}
      <div className="px-3.5 mt-3">
        <div className="bg-white rounded-3xl shadow-[0_8px_25px_rgba(15,23,42,0.05)] border border-white divide-y divide-slate-100 overflow-hidden">
          <button
            onClick={() => setSubModal('settings')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-slate-800">إعدادات</span>
              <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 flex items-center justify-center text-lg">
                ⚙️
              </div>
            </div>
          </button>

          <button
            onClick={() => setSubModal('about')}
            className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-3">
              <span className="text-sm font-black text-slate-800">حول ooyuni chat</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center text-lg">
                ℹ️
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* INTERACTIVE SUB-MODALS FOR EVERY FEATURE ON THE "أنا" SCREEN          */}
      {/* ===================================================================== */}
      {subModal !== 'none' && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSubModal('none')}
        >
          <div
            className="w-full max-w-md bg-slate-950 text-white border-t-2 border-amber-400 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <button
                onClick={() => setSubModal('none')}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-base font-black text-amber-300">
                {subModal === 'edit_profile' && '✏️ تعديل الملف الشخصي'}
                {subModal === 'social_list' && '👥 القائمة الاجتماعية'}
                {subModal === 'levels' && '🏆 مستوى الثروة والجاذبية'}
                {subModal === 'badges' && '👑 شاراتي وأوسمتي الملكية'}
                {subModal === 'cp_space' && '💞 مساحة CP وشريك الروح'}
                {subModal === 'special_id' && '🆔 متجر الأيدي المميز'}
                {subModal === 'invite' && '🎁 دعوة الأصدقاء ومكافآت الكوينز'}
                {subModal === 'settings' && '⚙️ إعدادات الحساب والتطبيق'}
                {subModal === 'about' && 'ℹ️ حول ooyuni chat والدعم الفني'}
              </h3>
            </div>

            {/* 1. EDIT PROFILE MODAL */}
            {subModal === 'edit_profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-3.5 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اختر صورة رمزية أو ضع رابط صورة:
                  </label>
                  <div className="flex items-center justify-end gap-2 pb-2">
                    {avatarPresets.map((av, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setEditAvatar(av)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-transform ${
                          editAvatar === av ? 'border-amber-400 scale-110' : 'border-white/20 opacity-70'
                        }`}
                      >
                        <img src={av} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الاسم المستعار:</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white text-right focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">العمر:</label>
                    <input
                      type="number"
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value) || 25)}
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white text-right focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">الدولة:</label>
                    <select
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white text-right focus:border-amber-400 focus:outline-none"
                    >
                      <option value="🇩🇿 الجزائر">🇩🇿 الجزائر</option>
                      <option value="🇪🇬 مصر">🇪🇬 مصر</option>
                      <option value="🇸🇦 السعودية">🇸🇦 السعودية</option>
                      <option value="🇦🇪 الإمارات">🇦🇪 الإمارات</option>
                      <option value="🇮🇶 العراق">🇮🇶 العراق</option>
                      <option value="🇲🇦 المغرب">🇲🇦 المغرب</option>
                      <option value="🇰🇼 الكويت">🇰🇼 الكويت</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">السيرة الذاتية (Bio):</label>
                  <textarea
                    rows={2}
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-xs text-white text-right focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-sm shadow-lg"
                >
                  حفظ التعديلات ✨
                </button>
              </form>
            )}

            {/* 2. SOCIAL LIST MODAL (Friends / Following / Fans / Visitors) */}
            {subModal === 'social_list' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1 rounded-2xl">
                  {[
                    { id: 'friends', label: 'أصدقاء' },
                    { id: 'following', label: 'المتابعون' },
                    { id: 'fans', label: 'المعجبون' },
                    { id: 'visitors', label: 'الزوار' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSocialTab(t.id as typeof socialTab)}
                      className={`py-1.5 rounded-xl text-xs font-black transition-all ${
                        socialTab === t.id
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSubModal('none');
                            setViewingProfileUser(u);
                            setActiveModal('profile');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/50 text-amber-300 font-black text-[11px]"
                        >
                          عرض الملف
                        </button>
                        <button
                          onClick={() => showToast(`تم إرسال تحية إلى ${u.displayName} 👋`)}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-black text-[11px]"
                        >
                          مراسلة 💬
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5 text-right">
                        <div>
                          <div className="text-xs font-black text-white">{u.displayName}</div>
                          <div className="text-[10px] text-amber-400 font-mono">
                            ID:{u.userCode} • VIP{u.vipLevel}
                          </div>
                        </div>
                        <img
                          src={u.avatar}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400/60"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. LEVELS (WEALTH & CHARM) MODAL */}
            {subModal === 'levels' && (
              <div className="space-y-4 text-right">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-900/60 to-indigo-900/60 border border-sky-400/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black text-sky-300">172,670 / 263,990 XP</span>
                    <span className="text-sm font-black text-white">
                      🏆 مستوى الثروة: Lv.{currentUser.level || 41}
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-sky-400/30">
                    <div className="h-full w-2/3 bg-gradient-to-r from-sky-400 to-cyan-300" />
                  </div>
                  <p className="text-[11px] text-slate-300">
                    كل كوينز ترسله في الهدايا داخل الغرف الصوتية يرفع مستوى الثروة الخاص بك ويفتح أيقونات دخول ملكية!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-pink-900/60 to-purple-900/60 border border-pink-400/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-black text-pink-300">84,500 / 120,000 XP</span>
                    <span className="text-sm font-black text-white">🔥 مستوى الجاذبية (السحر): Lv.7</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-pink-400/30">
                    <div className="h-full w-3/4 bg-gradient-to-r from-pink-500 to-amber-400" />
                  </div>
                  <p className="text-[11px] text-slate-300">
                    استلام الهدايا والقلوب على المايك يرفع مستوى الجاذبية الخاص بك!
                  </p>
                </div>

                <button
                  disabled={claimedDailyLevelBonus}
                  onClick={() => {
                    setClaimedDailyLevelBonus(true);
                    rechargeCoins(1500, 'مكافأة المستوى اليومية');
                    showToast('تم استلام +1,500 كوينز مكافأة المستوى اليومية! 🎉');
                  }}
                  className={`w-full py-3 rounded-2xl font-black text-xs shadow-lg ${
                    claimedDailyLevelBonus
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950'
                  }`}
                >
                  {claimedDailyLevelBonus
                    ? 'تم استلام مكافأة المستوى اليومية ✅'
                    : '🎁 استلام مكافأة المستوى اليومية (+1,500 كوينز)'}
                </button>
              </div>
            )}

            {/* 4. BADGES MODAL */}
            {subModal === 'badges' && (
              <div className="space-y-3 text-right">
                <p className="text-xs text-slate-300">
                  اضغط على أي شارة لتفعيلها أو إلغاء تفعيلها في ملفك الشخصي وداخل الغرف الصوتية:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {allBadgesCatalog.map((b) => {
                    const isEquipped = equippedBadges.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setEquippedBadges((prev) =>
                            prev.includes(b.id) ? prev.filter((x) => x !== b.id) : [...prev, b.id]
                          );
                          showToast(
                            isEquipped ? `تم إلغاء عرض شارة ${b.name}` : `تم تفعيل شارة ${b.name} ✅`
                          );
                        }}
                        className={`p-3 rounded-2xl border flex flex-col items-center text-center transition-all ${
                          isEquipped
                            ? 'bg-amber-500/20 border-amber-400 shadow-md'
                            : 'bg-white/5 border-white/10 opacity-70'
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${b.color} flex items-center justify-center text-2xl shadow`}
                        >
                          {b.icon}
                        </div>
                        <div className="text-xs font-black text-white mt-2">{b.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{b.desc}</div>
                        <span
                          className={`mt-2 px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                            isEquipped ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {isEquipped ? 'مفعلة ✅' : 'تفعيل'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. CP COUPLE SPACE MODAL */}
            {subModal === 'cp_space' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-3xl bg-gradient-to-b from-pink-900/50 via-rose-950/60 to-slate-950 border border-pink-400/50 space-y-3">
                  <div className="text-xs font-black text-pink-300">{cpRingTier}</div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.displayName}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-400"
                      />
                      <span className="text-xs font-black text-white mt-1">
                        {currentUser.displayName}
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-3xl animate-pulse">💞</span>
                      <span className="text-[10px] font-mono font-black text-pink-300 mt-1">
                        {cpLovePoints.toLocaleString()} نقطة حب
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <img
                        src={cpPartner.avatar}
                        alt={cpPartner.displayName}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-pink-400"
                      />
                      <span className="text-xs font-black text-white mt-1">
                        {cpPartner.displayName}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-[11px] text-pink-200 mb-1">تغيير شريك CP:</label>
                    <select
                      value={cpPartnerId}
                      onChange={(e) => setCpPartnerId(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-pink-400/40 px-3 py-1.5 text-xs text-white text-center"
                    >
                      {users
                        .filter((u) => u.id !== currentUser.id)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.displayName} (ID: {u.userCode})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      if (currentUser.coins < 500) {
                        setSubModal('none');
                        setActiveModal('wallet');
                        return;
                      }
                      rechargeCoins(-500, 'هدية خاتم CP');
                      setCpLovePoints((p) => p + 1200);
                      showToast('تم إرسال وردة وخاتم CP (+1,200 نقطة حب) 💍');
                    }}
                    className="py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black text-xs shadow-lg"
                  >
                    💍 إرسال خاتم حب (500 🪙)
                  </button>
                  <button
                    onClick={() => {
                      setCpRingTier('تاج العشق الإمبراطوري 👑💞');
                      showToast('تم ترقية جناح الـ CP إلى المستوى الإمبراطوري! ✨');
                    }}
                    className="py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400 text-amber-300 font-black text-xs"
                  >
                    ✨ ترقية مستوى CP
                  </button>
                </div>
              </div>
            )}

            {/* 6. SPECIAL ID STORE MODAL (ايدي مميز) */}
            {subModal === 'special_id' && (
              <div className="space-y-3 text-right">
                <p className="text-xs text-slate-300">
                  اقتنِ أيدي ملكي مميز يظهر فوراً في ملفك الشخصي وداخل جميع الغرف الصوتية:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {specialIdsCatalog.map((item) => {
                    const isCurrent = currentUser.userCode === item.code;
                    return (
                      <div
                        key={item.code}
                        className={`p-3 rounded-2xl border flex flex-col items-center justify-between text-center ${
                          isCurrent
                            ? 'bg-amber-500/20 border-amber-400'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black text-[9px]">
                          {item.tag}
                        </span>
                        <div className="my-2 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 text-slate-950 font-mono font-black text-sm shadow">
                          ID: {item.code}
                        </div>
                        <div className="text-[11px] font-bold text-slate-200">{item.label}</div>
                        <button
                          onClick={() => {
                            if (isCurrent) return;
                            if (item.price > 0 && currentUser.coins < item.price) {
                              setSubModal('none');
                              setActiveModal('wallet');
                              return;
                            }
                            if (item.price > 0) {
                              rechargeCoins(-item.price, `شراء أيدي مميز ${item.code}`);
                            }
                            updateUserProfile({ userCode: item.code });
                            showToast(`تم تفعيل الأيدي الملكي المميز ID:${item.code} بنجاح! 👑`);
                          }}
                          className={`mt-2 w-full py-1.5 rounded-xl font-black text-xs ${
                            isCurrent
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950'
                          }`}
                        >
                          {isCurrent
                            ? 'مفعل حالياً ✅'
                            : item.price === 0
                            ? 'تفعيل مجاني'
                            : `${item.price.toLocaleString()} 🪙`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. INVITE FRIENDS MODAL */}
            {subModal === 'invite' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-3xl bg-gradient-to-b from-amber-500/20 to-slate-900 border border-amber-400/50 space-y-2">
                  <div className="text-4xl">🎁</div>
                  <h4 className="text-sm font-black text-amber-300">
                    ادعُ أصدقاءك واربح 5,000 كوينز عن كل صديق!
                  </h4>
                  <p className="text-xs text-slate-300">
                    كود الدعوة الخاص بك: <span className="font-mono font-black text-white">OOYUNI-{currentUser.userCode}</span>
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `انضم إليّ في تطبيق ooyuni chat عبر كود الدعوة: OOYUNI-${currentUser.userCode}`
                      );
                      showToast('تم نسخ رابط وكود الدعوة بنجاح! 📋');
                    }}
                    className="px-5 py-2 rounded-xl bg-white/10 border border-amber-400/50 text-amber-300 font-black text-xs"
                  >
                    نسخ كود الدعوة 📋
                  </button>
                </div>

                <button
                  disabled={claimedInviteBonus}
                  onClick={() => {
                    setClaimedInviteBonus(true);
                    rechargeCoins(2500, 'مكافأة دعوة الأصدقاء');
                    showToast('تم استلام +2,500 كوينز مكافأة الدعوة! 🎉');
                  }}
                  className={`w-full py-3 rounded-2xl font-black text-xs ${
                    claimedInviteBonus
                      ? 'bg-slate-800 text-slate-500'
                      : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg'
                  }`}
                >
                  {claimedInviteBonus
                    ? 'تم استلام مكافأة الدعوة اليومية ✅'
                    : '🪙 استلام مكافأة الدعوة الفورية (+2,500 كوينز)'}
                </button>
              </div>
            )}

            {/* 8. SETTINGS MODAL */}
            {subModal === 'settings' && (
              <div className="space-y-3 text-right">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => {
                      setSoundEnabled(e.target.checked);
                      showToast('تم تحديث إعدادات الصوت 🔊');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>المؤثرات الصوتية داخل التطبيق</span>
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <input
                    type="checkbox"
                    checked={notifEnabled}
                    onChange={(e) => {
                      setNotifEnabled(e.target.checked);
                      showToast('تم تحديث إعدادات الإشعارات 🔔');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>إشعارات الهدايا والرسائل الخاصة</span>
                    <Bell className="w-4 h-4 text-teal-400" />
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <input
                    type="checkbox"
                    checked={hideVisitorStatus}
                    onChange={(e) => {
                      setHideVisitorStatus(e.target.checked);
                      showToast('تم تحديث خصوصية الزيارات 🔒');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>إخفاء هويتي عند زيارة ملفات الآخرين (ميزة VIP)</span>
                    <Lock className="w-4 h-4 text-purple-400" />
                  </div>
                </div>

                <button
                  onClick={() => {
                    showToast('تم تنظيف الذاكرة المؤقتة للتطبيق بنجاح (0 MB) ✨');
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10"
                >
                  <span className="text-xs text-emerald-400 font-mono">12.4 MB</span>
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                    <span>مسح التخزين المؤقت (Clear Cache)</span>
                    <Trash2 className="w-4 h-4" />
                  </div>
                </button>
              </div>
            )}

            {/* 9. ABOUT MODAL */}
            {subModal === 'about' && (
              <div className="space-y-3 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-600 flex items-center justify-center text-3xl shadow-lg">
                  🎙️
                </div>
                <h4 className="text-base font-black text-white">ooyuni chat • عيوني شات</h4>
                <p className="text-xs text-slate-400">الإصدار الملكي v4.8.0 (3D Pro Edition)</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  منصة الدردشة الصوتية الاجتماعية الأولى للغرف الصوتية التفاعلية، هدايا الحظ، الصواريخ، الألعاب الحية، ونظام الوكالات وVIP.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setSubModal('none');
                      setActiveModal('messages');
                    }}
                    className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-black text-xs"
                  >
                    التواصل مع خدمة العملاء 💬
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
