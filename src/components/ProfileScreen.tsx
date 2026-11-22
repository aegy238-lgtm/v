import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Copy,
  Check,
  Edit3,
  ShieldAlert,
  CreditCard,
  X,
  Volume2,
  Bell,
  Lock,
  Trash2,
  Home,
  FileText,
  Sparkles,
  Crown,
  LogOut,
  LogIn,
  UserCheck,
} from 'lucide-react';
import { VOICE_COUNTRIES } from '../utils/voiceProfileOptions';
import { ProfileInstallButton } from './PWAInstallManager';

type ProfileSubModal =
  | 'none'
  | 'edit_profile'
  | 'social_list'
  | 'levels'
  | 'badges'
  | 'cp_space'
  | 'special_id'
  | 'invite'
  | 'records'
  | 'settings'
  | 'about';

export const ProfileScreen: React.FC = () => {
  const {
    currentUser,
    users,
    transactions,
    storeItems,
    joinRoom,
    setActiveModal,
    setViewingProfileUser,
    setCurrentView,
    isAdminAccount,
    updateUserProfile,
    rechargeCoins,
    bagGifts,
    firebaseUser,
    adminSession,
    signOutCloud,
    returnToAuthScreen,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [subModal, setSubModal] = useState<ProfileSubModal>('none');
  const [socialTab, setSocialTab] = useState<'friends' | 'following' | 'fans' | 'visitors'>('friends');
  const [recordsFilter, setRecordsFilter] = useState<'all' | 'lucky_win' | 'recharge' | 'gift'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  // Edit profile form state
  const [editName, setEditName] = useState(currentUser.displayName || 'الدبلان');
  const [editBio, setEditBio] = useState(currentUser.bio || 'مرحباً بكم في عالمي الملكي 👑');
  const [editCountry, setEditCountry] = useState(currentUser.country || 'السعودية');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);
  const [editAge, setEditAge] = useState<number>(currentUser.age || 24);
  const [editGender, setEditGender] = useState<'male' | 'female'>(currentUser.gender || 'male');

  // Badges state
  const [equippedBadges, setEquippedBadges] = useState<string[]>([
    'badge_vip5',
    'badge_wealth',
    'badge_lucky',
  ]);

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
    showToast(`تم نسخ الأيدي بنجاح: ${currentUser.userCode || '6919142'}`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedCountry = VOICE_COUNTRIES.find(
      (c) => c.name === editCountry || `${c.flag} ${c.name}` === editCountry
    );
    updateUserProfile({
      displayName: editName.trim() || currentUser.displayName,
      bio: editBio.trim(),
      country: matchedCountry?.name || editCountry,
      countryFlag: matchedCountry?.flag || currentUser.countryFlag || '🌍',
      age: Math.min(99, Math.max(13, Number(editAge) || 24)),
      gender: editGender,
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
  const totalBagCount = Object.values(bagGifts).reduce((s, c) => s + c, 0);
  const equippedFrame = storeItems.find(
    (i) => i.type === 'frame' && i.id === currentUser.activeFrameId
  );

  const myRecords = transactions.filter((tx) => {
    if (tx.userId !== currentUser.id) return false;
    if (recordsFilter === 'all') return true;
    return tx.type === recordsFilter;
  });

  return (
    <div className="relative min-h-dvh w-full max-w-5xl mx-auto bg-[#070a12] text-white pb-24 font-tajawal select-none overflow-x-hidden">
      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 inset-x-4 max-w-sm mx-auto z-50 px-4 py-2.5 rounded-2xl bg-[#141a2b]/95 border border-amber-400 text-amber-300 text-xs font-black text-center shadow-2xl">
          {toastMsg}
        </div>
      )}

      {/* Compact Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#070a12]/90 backdrop-blur-xl border-b border-white/10 px-3.5 sm:px-6 py-2 flex items-center justify-between gap-2">
        <span className="text-sm sm:text-base font-black text-amber-300 flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>ملفي</span>
        </span>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <ProfileInstallButton variant="header" />
          <button
            onClick={() => setCurrentView('agent_portal')}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-teal-500/15 border border-teal-400/35 text-teal-300 text-[11px] sm:text-xs font-bold flex items-center gap-1 hover:bg-teal-500/25 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>الوكيل</span>
          </button>
          {isAdminAccount && (
            <button
              onClick={() => setCurrentView('admin_dashboard')}
              className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-indigo-500/15 border border-indigo-400/35 text-indigo-300 text-[11px] sm:text-xs font-bold flex items-center gap-1 hover:bg-indigo-500/25 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>الإدارة</span>
            </button>
          )}
          <button
            onClick={() => {
              setEditName(currentUser.displayName);
              setEditBio(currentUser.bio || 'مرحباً بكم في عالمي الملكي 👑');
              setEditAvatar(currentUser.avatar);
              setEditCountry(currentUser.country || 'السعودية');
              setEditAge(currentUser.age || 24);
              setEditGender(currentUser.gender || 'male');
              setSubModal('edit_profile');
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-300 hover:bg-amber-400/25 transition-colors"
            title="تعديل الملف الشخصي"
          >
            <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            onClick={() => {
              if (firebaseUser || adminSession) {
                void signOutCloud();
              } else {
                returnToAuthScreen();
              }
            }}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-rose-500/15 border border-rose-400/35 text-rose-300 text-[11px] sm:text-xs font-bold flex items-center gap-1 hover:bg-rose-500/25 transition-colors"
            title={firebaseUser || adminSession ? 'تسجيل الخروج' : 'تسجيل الدخول'}
          >
            {firebaseUser || adminSession ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
            <span>{firebaseUser || adminSession ? 'خروج' : 'دخول'}</span>
          </button>
        </div>
      </header>

      {/* Main Layout: Fits cleanly on 1 mobile viewport without scrolling, expands cleanly to 2 cols on desktop */}
      <div className="px-3 sm:px-6 pt-2.5 lg:pt-5 grid grid-cols-1 lg:grid-cols-12 gap-2.5 lg:gap-5 items-start">
        {/* Column 1: Compact Horizontal Hero Identity + Slim 2-Col Wallet */}
        <div className="lg:col-span-5 space-y-2.5 lg:space-y-4">
          <ProfileInstallButton variant="card" />
          {/* Compact Hero Profile Card */}
          <div className="relative rounded-2xl lg:rounded-3xl overflow-visible bg-gradient-to-b from-[#13192c] to-[#0c101d] border border-amber-400/25 p-3 lg:p-5 shadow-xl">
            <div className="flex items-center gap-3.5 text-right">
              {/* Avatar + Uploaded Frame URL Overlay */}
              <div className="relative shrink-0">
                <div
                  onClick={() => setShowAvatarMenu((prev) => !prev)}
                  title="فتح البروفايل الخاص بي"
                  className="relative w-20 h-20 lg:w-22 lg:h-22 shrink-0 cursor-pointer flex items-center justify-center"
                >
                  <div
                    className={
                      equippedFrame?.previewUrl
                        ? 'w-12 h-12 lg:w-14 lg:h-14 rounded-full overflow-hidden'
                        : 'w-15 h-15 lg:w-18 lg:h-18 rounded-2xl p-[2px] bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-700 shadow-lg'
                    }
                  >
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.displayName}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full object-cover ${
                        equippedFrame?.previewUrl ? 'rounded-full' : 'rounded-[14px]'
                      }`}
                    />
                  </div>
                  {equippedFrame?.previewUrl && (
                    <img
                      src={equippedFrame.previewUrl}
                      alt={equippedFrame.nameAr}
                      referrerPolicy="no-referrer"
                      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84px] h-[84px] lg:w-[96px] lg:h-[96px] object-contain z-20"
                    />
                  )}
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 text-[9px] font-black text-slate-950 shadow whitespace-nowrap">
                    VIP {currentUser.vipLevel || 5}
                  </span>
                </div>

                {showAvatarMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 rounded-2xl bg-[#141a2d] border border-amber-400/35 shadow-2xl p-1.5 z-40 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setViewingProfileUser(currentUser);
                        setActiveModal('profile');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:bg-white/10 flex items-center gap-2 text-right transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>فتح البروفايل الخاص بي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setSubModal('edit_profile');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 flex items-center gap-2 text-right transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>تعديل الملف الشخصي</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Name, ID, Country, Bio */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h1 className="text-base lg:text-lg font-black text-white truncate">
                      {currentUser.displayName || 'الدبلان'}
                    </h1>
                    <span
                      className={`text-[11px] font-bold shrink-0 tabular-nums ${
                        currentUser.gender === 'female' ? 'text-rose-300' : 'text-sky-300'
                      }`}
                    >
                      {currentUser.gender === 'female' ? '♀' : '♂'} {currentUser.age ?? 24}
                    </span>
                    <span className="text-sm shrink-0" title={currentUser.country}>
                      {currentUser.countryFlag || '🇸🇦'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <button
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-amber-200 font-mono tabular-nums transition-colors"
                  >
                    <span>ID:{currentUser.userCode || '6919142'}</span>
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                  </button>

                  <button
                    onClick={() => setSubModal('levels')}
                    className="px-2 py-0.5 rounded-lg bg-orange-500/20 border border-orange-400/30 text-orange-200 font-mono tabular-nums font-bold"
                  >
                    🔥 Lv.{currentUser.level || 7}
                  </button>
                </div>

                {currentUser.bio && (
                  <p className="text-[11px] text-slate-400 truncate">{currentUser.bio}</p>
                )}
              </div>
            </div>

            {/* 4 Interactive Social Columns */}
            <div className="grid grid-cols-4 pt-2 mt-2.5 border-t border-white/10 w-full text-center gap-1">
              <button
                onClick={() => {
                  setSocialTab('visitors');
                  setSubModal('social_list');
                }}
                className="flex flex-col items-center hover:bg-white/[0.04] rounded-xl py-1 transition-colors"
              >
                <span className="text-sm font-black font-mono tabular-nums text-white">
                  {currentUser.visitorsCount || 3}
                </span>
                <span className="text-[10px] text-slate-400">زائر</span>
              </button>

              <button
                onClick={() => {
                  setSocialTab('fans');
                  setSubModal('social_list');
                }}
                className="flex flex-col items-center hover:bg-white/[0.04] rounded-xl py-1 transition-colors"
              >
                <span className="text-sm font-black font-mono tabular-nums text-white">
                  {currentUser.followersCount || 2}
                </span>
                <span className="text-[10px] text-slate-400">المعجبون</span>
              </button>

              <button
                onClick={() => {
                  setSocialTab('following');
                  setSubModal('social_list');
                }}
                className="flex flex-col items-center hover:bg-white/[0.04] rounded-xl py-1 transition-colors"
              >
                <span className="text-sm font-black font-mono tabular-nums text-white">
                  {currentUser.followingCount || 1}
                </span>
                <span className="text-[10px] text-slate-400">المتابعون</span>
              </button>

              <button
                onClick={() => {
                  setSocialTab('friends');
                  setSubModal('social_list');
                }}
                className="flex flex-col items-center hover:bg-white/[0.04] rounded-xl py-1 transition-colors"
              >
                <span className="text-sm font-black font-mono tabular-nums text-white">
                  {Math.max(1, users.length - 1)}
                </span>
                <span className="text-[10px] text-slate-400">أصدقاء</span>
              </button>
            </div>
          </div>

          {/* Slim 2-Column Wallet Card */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveModal('wallet')}
              className="rounded-2xl bg-gradient-to-br from-amber-500/18 to-[#0e1320] border border-amber-400/30 px-3 py-2.5 flex items-center justify-between hover:border-amber-400/60 transition-colors"
            >
              <div className="text-right min-w-0">
                <div className="text-[11px] font-bold text-amber-200">الكونزة</div>
                <div className="text-sm font-mono tabular-nums font-black text-white truncate">
                  {currentUser.coins.toLocaleString('en-US')}
                </div>
              </div>
              <span className="text-xl shrink-0">🪙</span>
            </button>

            <button
              onClick={() => setActiveModal('wallet')}
              className="rounded-2xl bg-gradient-to-br from-fuchsia-500/18 to-[#0e1320] border border-fuchsia-400/30 px-3 py-2.5 flex items-center justify-between hover:border-fuchsia-400/60 transition-colors"
            >
              <div className="text-right min-w-0">
                <div className="text-[11px] font-bold text-fuchsia-200">الماس</div>
                <div className="text-sm font-mono tabular-nums font-black text-white truncate">
                  {currentUser.diamonds.toLocaleString('en-US')}
                </div>
              </div>
              <span className="text-xl shrink-0">💎</span>
            </button>
          </div>
        </div>

        {/* Column 2: Compact 3-Col VIP/Level/Badges + 4×2 Bento Services + 3-Col Footer Strip */}
        <div className="lg:col-span-7 space-y-2.5 lg:space-y-4">
          {/* Compact 3-Column VIP, Wealth Level & Badges */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveModal('vip')}
              className="rounded-2xl bg-gradient-to-br from-[#2a1d0b] to-[#171109] border border-amber-400/40 p-2.5 text-right flex items-center justify-between gap-1 hover:border-amber-300 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-black text-amber-300">VIP {currentUser.vipLevel || 5}</div>
                <div className="text-[10px] text-amber-100/75 truncate">الامتيازات</div>
              </div>
              <span className="text-lg shrink-0">👑</span>
            </button>

            <button
              onClick={() => setSubModal('levels')}
              className="rounded-2xl bg-[#0e1320] hover:bg-[#141b2e] border border-sky-400/30 p-2.5 text-right flex items-center justify-between gap-1 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-black text-white">المستوى</div>
                <div className="text-[10px] text-sky-300 font-mono tabular-nums truncate">
                  Lv.{currentUser.level || 41}
                </div>
              </div>
              <span className="text-lg shrink-0">🏆</span>
            </button>

            <button
              onClick={() => setSubModal('badges')}
              className="rounded-2xl bg-[#0e1320] hover:bg-[#141b2e] border border-emerald-400/30 p-2.5 text-right flex items-center justify-between gap-1 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-black text-white">الأوسمة</div>
                <div className="text-[10px] text-emerald-300 truncate">
                  {equippedBadges.length} مفعلة
                </div>
              </div>
              <span className="text-lg shrink-0">🎖️</span>
            </button>
          </div>

          {/* Compact 4×2 Bento Services Grid (All 8 visible together without scroll) */}
          <div className="rounded-2xl lg:rounded-3xl bg-[#0e1320] border border-white/10 p-2.5 sm:p-4 grid grid-cols-4 gap-2 sm:gap-3 text-center shadow-xl">
            <button
              onClick={() => setSubModal('special_id')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-purple-500 to-fuchsia-600 text-white flex items-center justify-center shadow text-[11px] font-black">
                ID
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">ايدي مميز</span>
            </button>

            <button
              onClick={() => setActiveModal('backpack')}
              className="relative py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-indigo-500 to-purple-600 text-white flex items-center justify-center text-base shadow">
                🎒
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">الحقيبة</span>
              {totalBagCount > 0 && (
                <span className="absolute top-1 left-1 min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-slate-950 font-mono tabular-nums font-black text-[9px] flex items-center justify-center">
                  {totalBagCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setSubModal('cp_space')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-pink-500 to-rose-600 text-white flex items-center justify-center text-base shadow">
                💞
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">CP</span>
            </button>

            <button
              onClick={() => setActiveModal('store')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-sky-500 to-blue-600 text-white flex items-center justify-center text-base shadow">
                🏪
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">المتجر</span>
            </button>

            <button
              onClick={() => joinRoom('room_tyy')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow">
                <Home className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">غرفتي</span>
            </button>

            <button
              onClick={() => setActiveModal('messages')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-cyan-500 to-teal-600 text-white flex items-center justify-center text-base shadow">
                💬
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">رسائلي</span>
            </button>

            <button
              onClick={() => setActiveModal('agency')}
              className="py-2 px-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/6 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 text-white flex items-center justify-center text-base shadow">
                🏛️
              </div>
              <span className="text-[11px] font-bold text-slate-200 truncate w-full">وكالة</span>
            </button>

            <button
              onClick={() => setSubModal('records')}
              className="py-2 px-1 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 flex flex-col items-center gap-1 transition-colors"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-amber-500 to-yellow-600 text-slate-950 flex items-center justify-center shadow">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-bold text-amber-300 truncate w-full">السجلات</span>
            </button>
          </div>

          {/* Compact 3-Column Bottom Strip: Invite / Settings / About */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSubModal('invite')}
              className="min-h-[44px] px-2.5 rounded-2xl bg-[#0e1320] hover:bg-[#141b2e] border border-white/10 flex items-center justify-center gap-1.5 text-xs font-bold text-white transition-colors"
            >
              <span>🎁</span>
              <span>دعوة</span>
            </button>

            <button
              onClick={() => setSubModal('settings')}
              className="min-h-[44px] px-2.5 rounded-2xl bg-[#0e1320] hover:bg-[#141b2e] border border-white/10 flex items-center justify-center gap-1.5 text-xs font-bold text-white transition-colors"
            >
              <span>⚙️</span>
              <span>الإعدادات</span>
            </button>

            <button
              onClick={() => setSubModal('about')}
              className="min-h-[44px] px-2.5 rounded-2xl bg-[#0e1320] hover:bg-[#141b2e] border border-white/10 flex items-center justify-center gap-1.5 text-xs font-bold text-white transition-colors"
            >
              <span>ℹ️</span>
              <span>حول</span>
            </button>
          </div>
        </div>
      </div>

      {/* INTERACTIVE SUB-MODALS FOR EVERY FEATURE ON PROFILE SCREEN */}
      {subModal !== 'none' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSubModal('none')}
        >
          <div
            className="w-full max-w-lg bg-[#0d1220] text-white border-t-2 sm:border border-amber-400/40 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[86vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-amber-300">
                {subModal === 'edit_profile' && '✏️ تعديل الملف الشخصي'}
                {subModal === 'social_list' && '👥 القائمة الاجتماعية'}
                {subModal === 'levels' && '🏆 مستوى الثروة والجاذبية'}
                {subModal === 'badges' && '👑 شاراتي وأوسمتي الملكية'}
                {subModal === 'cp_space' && '💞 مساحة CP وشريك الروح'}
                {subModal === 'special_id' && '🆔 متجر الأيدي المميز'}
                {subModal === 'invite' && '🎁 دعوة الأصدقاء ومكافآت الكوينز'}
                {subModal === 'records' && '📋 سجلات الحساب والربح'}
                {subModal === 'settings' && '⚙️ إعدادات الحساب والتطبيق'}
                {subModal === 'about' && 'ℹ️ حول فوكاشات والدعم الفني'}
              </h3>
              <button
                onClick={() => setSubModal('none')}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. EDIT PROFILE */}
            {subModal === 'edit_profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-3.5 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    اختر صورة رمزية أو ضع رابط صورة:
                  </label>
                  <div className="flex items-center justify-start gap-2 pb-2">
                    {avatarPresets.map((av, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setEditAvatar(av)}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-transform ${
                          editAvatar === av ? 'border-amber-400 scale-110' : 'border-white/20 opacity-70'
                        }`}
                      >
                        <img
                          src={av}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
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
                      min={13}
                      max={99}
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value) || 24)}
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white text-right font-mono tabular-nums focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">البلد:</label>
                    <select
                      value={editCountry}
                      onChange={(e) => setEditCountry(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white text-right focus:border-amber-400 focus:outline-none"
                    >
                      {VOICE_COUNTRIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الجنس:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditGender('female')}
                      className={`py-2 rounded-xl border text-xs font-black transition-colors ${
                        editGender === 'female'
                          ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                          : 'bg-slate-900 border-white/15 text-slate-300'
                      }`}
                    >
                      ♀ أنثى
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGender('male')}
                      className={`py-2 rounded-xl border text-xs font-black transition-colors ${
                        editGender === 'male'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-900 border-white/15 text-slate-300'
                      }`}
                    >
                      ♂ ذكر
                    </button>
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

            {/* 2. SOCIAL LIST */}
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
                      <div className="flex items-center gap-2.5 text-right">
                        <img
                          src={u.avatar}
                          alt={u.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400/60"
                        />
                        <div>
                          <div className="text-xs font-black text-white">{u.displayName}</div>
                          <div className="text-[10px] text-amber-400 font-mono">
                            ID:{u.userCode} • VIP{u.vipLevel}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => showToast(`تم إرسال تحية إلى ${u.displayName} 👋`)}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 font-black text-[11px]"
                        >
                          مراسلة 💬
                        </button>
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. LEVELS */}
            {subModal === 'levels' && (
              <div className="space-y-4 text-right">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-900/60 to-indigo-900/60 border border-sky-400/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">
                      🏆 مستوى الثروة: Lv.{currentUser.level || 41}
                    </span>
                    <span className="text-xs font-mono font-black text-sky-300">
                      172,670 / 263,990 XP
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
                    <span className="text-sm font-black text-white">🔥 مستوى الجاذبية (السحر): Lv.7</span>
                    <span className="text-xs font-mono font-black text-pink-300">
                      84,500 / 120,000 XP
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-pink-400/30">
                    <div className="h-full w-3/4 bg-gradient-to-r from-pink-500 to-amber-400" />
                  </div>
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

            {/* 4. BADGES */}
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

            {/* 5. CP COUPLE SPACE */}
            {subModal === 'cp_space' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-3xl bg-gradient-to-b from-pink-900/50 via-rose-950/60 to-slate-950 border border-pink-400/50 space-y-3">
                  <div className="text-xs font-black text-pink-300">{cpRingTier}</div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex flex-col items-center">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.displayName}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-400"
                      />
                      <span className="text-xs font-black text-white mt-1">
                        {currentUser.displayName}
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-3xl">💞</span>
                      <span className="text-[10px] font-mono font-black text-pink-300 mt-1">
                        {cpLovePoints.toLocaleString()} نقطة حب
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <img
                        src={cpPartner.avatar}
                        alt={cpPartner.displayName}
                        referrerPolicy="no-referrer"
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

            {/* 6. SPECIAL ID STORE */}
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

            {/* 7. INVITE */}
            {subModal === 'invite' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-3xl bg-gradient-to-b from-amber-500/20 to-slate-900 border border-amber-400/50 space-y-2">
                  <div className="text-4xl">🎁</div>
                  <h4 className="text-sm font-black text-amber-300">
                    ادعُ أصدقاءك واربح 5,000 كوينز عن كل صديق!
                  </h4>
                  <p className="text-xs text-slate-300">
                    كود الدعوة الخاص بك:{' '}
                    <span className="font-mono font-black text-white">OOYUNI-{currentUser.userCode}</span>
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

            {/* 8. RECORDS & ACTIVITY */}
            {subModal === 'records' && (
              <div className="space-y-3 text-right">
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'lucky_win', label: 'هدايا الحظ 🍀' },
                    { id: 'recharge', label: 'الشحن 🪙' },
                    { id: 'gift', label: 'الهدايا 🎁' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setRecordsFilter(f.id as typeof recordsFilter)}
                      className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                        recordsFilter === f.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {myRecords.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      لا توجد سجلات مطابقة في هذا القسم حالياً.
                    </div>
                  ) : (
                    myRecords.slice(0, 30).map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="text-right min-w-0">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {tx.type === 'lucky_win' && (
                              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            )}
                            <span className="truncate">{tx.details}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {tx.timestamp}
                          </div>
                        </div>

                        <div className="text-left shrink-0 font-mono tabular-nums font-black">
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
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 9. SETTINGS */}
            {subModal === 'settings' && (
              <div className="space-y-3 text-right">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>المؤثرات الصوتية داخل التطبيق</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => {
                      setSoundEnabled(e.target.checked);
                      showToast('تم تحديث إعدادات الصوت 🔊');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Bell className="w-4 h-4 text-teal-400" />
                    <span>إشعارات الهدايا والرسائل الخاصة</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifEnabled}
                    onChange={(e) => {
                      setNotifEnabled(e.target.checked);
                      showToast('تم تحديث إعدادات الإشعارات 🔔');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <Lock className="w-4 h-4 text-purple-400" />
                    <span>إخفاء هويتي عند زيارة ملفات الآخرين (ميزة VIP)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hideVisitorStatus}
                    onChange={(e) => {
                      setHideVisitorStatus(e.target.checked);
                      showToast('تم تحديث خصوصية الزيارات 🔒');
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                </div>

                <button
                  onClick={() => {
                    showToast('تم تنظيف الذاكرة المؤقتة للتطبيق بنجاح (0 MB) ✨');
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between hover:bg-white/10"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
                    <Trash2 className="w-4 h-4" />
                    <span>مسح التخزين المؤقت (Clear Cache)</span>
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">12.4 MB</span>
                </button>

                <button
                  onClick={() => {
                    setSubModal('none');
                    if (firebaseUser || adminSession) {
                      void signOutCloud();
                    } else {
                      returnToAuthScreen();
                    }
                  }}
                  className="w-full p-3 rounded-2xl bg-rose-500/15 border border-rose-400/35 flex items-center justify-center gap-2 text-xs font-black text-rose-200 hover:bg-rose-500/25 transition-colors"
                >
                  {firebaseUser || adminSession ? <LogOut className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  <span>{firebaseUser || adminSession ? 'تسجيل الخروج والعودة لصفحة الدخول' : 'الانتقال لصفحة تسجيل الدخول'}</span>
                </button>
              </div>
            )}

            {/* 10. ABOUT */}
            {subModal === 'about' && (
              <div className="space-y-3 text-center">
                <img
                  src="/logo.png"
                  alt="فوكاشات"
                  referrerPolicy="no-referrer"
                  className="w-20 h-20 mx-auto rounded-2xl object-cover ring-1 ring-amber-400/50 shadow-lg"
                />
                <h4 className="text-base font-black text-white">فوكاشات • Fokashat VIP</h4>
                <p className="text-xs text-slate-400">الإصدار الملكي v4.8.0 VIP</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  منصة الدردشة الصوتية الاجتماعية الأولى للغرف الصوتية التفاعلية، هدايا الحظ، الصواريخ، الألعاب الحية، المتجر الملكي، ونظام الوكالات وVIP.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setSubModal('none');
                      setActiveModal('messages');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs"
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
