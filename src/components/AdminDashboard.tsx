import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Users,
  Radio,
  Coins,
  Gift,
  Briefcase,
  CreditCard,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  History,
  Video,
  Image as ImageIcon,
  Sliders,
  Sparkles,
  Edit3,
  X,
  ArrowRight,
  Play,
  Database,
  RefreshCw,
  LogIn,
  LogOut,
  Wifi,
  ShoppingBag,
  Volume2,
  Square,
  ShieldCheck,
  UserPlus,
  Link2,
} from 'lucide-react';
import { GiftCategory, GiftItem, SoundEffectType, StoreItem } from '../types';
import { SmartMediaView } from './SmartMediaView';
import {
  clampEffectDurationSec,
  getMediaFormatLabel,
  resolveEntranceStageMedia,
} from '../utils/mediaFormats';
import { ApngInfo, inspectApngUrl } from '../utils/apngEngine';
import { sound } from '../utils/audio';

function parseOptionalDurationSec(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 1) return undefined;
  return clampEffectDurationSec(num, 5);
}

export const AdminDashboard: React.FC = () => {
  const {
    users,
    rooms,
    roomBackgrounds,
    gifts,
    agencies,
    agents,
    staff,
    transactions,
    storeItems,
    luckyConfig,
    updateLuckyConfig,
    triggerGlobalJackpotBanner,
    currentUser,
    adminAddBalance,
    adminToggleBan,
    adminToggleMute,
    adminSetVipLevel,
    adminCloseRoom,
    adminCreateRoomBackground,
    adminDeleteRoomBackground,
    adminToggleRoomModerator,
    adminCreateGift,
    adminUpdateGift,
    adminDeleteGift,
    adminCreateStoreItem,
    adminUpdateStoreItem,
    adminDeleteStoreItem,
    equipInventoryItem,
    triggerEntranceEffect,
    adminCreateAgent,
    adminTopupAgent,
    adminUpdateAgencyStatus,
    setCurrentView,
    firebaseUser,
    firebaseStatus,
    isCloudSyncing,
    cloudMessage,
    signInWithGoogleCloud,
    signOutCloud,
    testCloudConnection,
    syncAllDataToCloud,
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'kpi' | 'users' | 'rooms' | 'gifts' | 'store' | 'agents' | 'agencies' | 'staff' | 'ledger' | 'firebase'
  >('kpi');

  // Full Store Management State (Frames, Entrances, Badges, Bubbles)
  const [storeFilter, setStoreFilter] = useState<'all' | StoreItem['type']>('all');
  const [newStoreType, setNewStoreType] = useState<StoreItem['type']>('entrance');
  const [newStoreName, setNewStoreName] = useState('');
  const [newStorePrice, setNewStorePrice] = useState(50000);
  const [newStoreDays, setNewStoreDays] = useState(30);
  const [newStoreIcon, setNewStoreIcon] = useState('🚘');
  const [newStorePreviewUrl, setNewStorePreviewUrl] = useState('');
  const [newStoreVideoUrl, setNewStoreVideoUrl] = useState('');
  const [newStoreEffectSec, setNewStoreEffectSec] = useState('');
  const [newStoreDesc, setNewStoreDesc] = useState('');
  const [previewingEntrance, setPreviewingEntrance] = useState<StoreItem | null>(null);

  type StoreDraft = {
    nameAr: string;
    previewUrl: string;
    videoUrl: string;
    priceCoins: number;
    durationDays: number;
    effectDurationSec: string;
  };
  const [storeDrafts, setStoreDrafts] = useState<Record<string, StoreDraft>>({});

  const getStoreDraft = (item: StoreItem): StoreDraft =>
    storeDrafts[item.id] || {
      nameAr: item.nameAr,
      previewUrl: item.previewUrl || '',
      videoUrl: item.videoUrl || '',
      priceCoins: item.priceCoins,
      durationDays: item.durationDays,
      effectDurationSec:
        typeof item.effectDurationSec === 'number' ? String(item.effectDurationSec) : '',
    };

  const setStoreField = (item: StoreItem, patch: Partial<StoreDraft>) => {
    setStoreDrafts((prev) => ({
      ...prev,
      [item.id]: {
        ...(prev[item.id] || {
          nameAr: item.nameAr,
          previewUrl: item.previewUrl || '',
          videoUrl: item.videoUrl || '',
          priceCoins: item.priceCoins,
          durationDays: item.durationDays,
          effectDurationSec:
            typeof item.effectDurationSec === 'number' ? String(item.effectDurationSec) : '',
        }),
        ...patch,
      },
    }));
  };

  // User Search & Balance Adjustment
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [adjustCoins, setAdjustCoins] = useState<number>(100000);
  const [adjustDiamonds, setAdjustDiamonds] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState('مكافأة داعم / تعويض إداري');

  // New Gift Creation Form (supports ANY Image/APNG/GIF/WebP/MP4/WebM URL + Custom Sound URL + Auto/Manual Duration)
  const [newGiftName, setNewGiftName] = useState('');
  const [newGiftPrice, setNewGiftPrice] = useState(1000);
  const [newGiftDiamonds, setNewGiftDiamonds] = useState(500);
  const [newGiftIcon, setNewGiftIcon] = useState('🌟');
  const [newGiftImageUrl, setNewGiftImageUrl] = useState('');
  const [newGiftVideoUrl, setNewGiftVideoUrl] = useState('');
  const [newGiftSoundUrl, setNewGiftSoundUrl] = useState('');
  const [newGiftDurationSec, setNewGiftDurationSec] = useState('');
  const [newGiftIsLucky, setNewGiftIsLucky] = useState(false);
  const [newGiftCat, setNewGiftCat] = useState<GiftCategory>('luxury');
  const [newGiftSound, setNewGiftSound] = useState<SoundEffectType>('fanfare');
  const [previewingAudioTarget, setPreviewingAudioTarget] = useState<'new' | 'edit' | null>(null);

  // Live APNG natural duration detection for pasted URLs
  const [newGiftApngInfo, setNewGiftApngInfo] = useState<ApngInfo | null>(null);
  const [editGiftApngInfo, setEditGiftApngInfo] = useState<ApngInfo | null>(null);
  const [newStoreApngInfo, setNewStoreApngInfo] = useState<ApngInfo | null>(null);

  // Edit Existing Gift Modal
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editVideoUrl, setEditVideoUrl] = useState('');
  const [editSoundUrl, setEditSoundUrl] = useState('');
  const [editDurationSec, setEditDurationSec] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editIsLucky, setEditIsLucky] = useState(false);

  // New Agent Form
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentBalance, setNewAgentBalance] = useState(2000000);
  const [newAgentRate, setNewAgentRate] = useState(5);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  // Room Backgrounds URL Uploader & Room Moderator Controls
  const [newBgName, setNewBgName] = useState('');
  const [newBgUrl, setNewBgUrl] = useState('');
  const [roomModTargetUserByRoom, setRoomModTargetUserByRoom] = useState<Record<string, string>>({});

  useEffect(() => {
    const probeUrl = (newGiftVideoUrl || newGiftImageUrl).trim();
    if (!probeUrl) {
      setNewGiftApngInfo(null);
      return;
    }
    let cancelled = false;
    void inspectApngUrl(probeUrl).then((info) => {
      if (!cancelled) setNewGiftApngInfo(info?.isApng ? info : null);
    });
    return () => {
      cancelled = true;
    };
  }, [newGiftVideoUrl, newGiftImageUrl]);

  useEffect(() => {
    const probeUrl = (editVideoUrl || editImageUrl).trim();
    if (!probeUrl) {
      setEditGiftApngInfo(null);
      return;
    }
    let cancelled = false;
    void inspectApngUrl(probeUrl).then((info) => {
      if (!cancelled) setEditGiftApngInfo(info?.isApng ? info : null);
    });
    return () => {
      cancelled = true;
    };
  }, [editVideoUrl, editImageUrl]);

  useEffect(() => {
    const probeUrl = (newStoreVideoUrl || newStorePreviewUrl).trim();
    if (!probeUrl) {
      setNewStoreApngInfo(null);
      return;
    }
    let cancelled = false;
    void inspectApngUrl(probeUrl).then((info) => {
      if (!cancelled) setNewStoreApngInfo(info?.isApng ? info : null);
    });
    return () => {
      cancelled = true;
    };
  }, [newStoreVideoUrl, newStorePreviewUrl]);

  const showAdminNotice = (msg: string) => {
    setAdminNotice(msg);
    setTimeout(() => setAdminNotice(null), 3500);
  };

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];

  const filteredUsers = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.userCode.includes(userSearch) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleAdjustBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    adminAddBalance(selectedUser.id, adjustCoins, adjustDiamonds, adjustNote);
    showAdminNotice(`تم تعديل رصيد ${selectedUser.displayName} بنجاح.`);
  };

  const handleCreateGift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGiftName.trim()) return;

    const cleanImg = newGiftImageUrl.trim();
    const cleanVid = newGiftVideoUrl.trim();
    const cleanSnd = newGiftSoundUrl.trim();
    const isLucky = newGiftIsLucky || newGiftCat === 'lucky';

    const gift: GiftItem = {
      id: `gift_custom_${Date.now()}`,
      name: newGiftName.trim(),
      nameAr: newGiftName.trim(),
      category: newGiftCat,
      coinPrice: Math.max(1, newGiftPrice),
      diamondReward: Math.max(0, newGiftDiamonds),
      icon: newGiftIcon.trim() || '🎁',
      imageUrl: cleanImg || undefined,
      videoUrl: cleanVid || undefined,
      soundUrl: cleanSnd || undefined,
      effectDurationSec: parseOptionalDurationSec(newGiftDurationSec),
      accentColor: isLucky ? '#ec4899' : '#f59e0b',
      animationType: isLucky
        ? 'lollipop_matrix'
        : newGiftCat === 'magic'
        ? 'explosion'
        : 'luxury_banner',
      soundEffect: newGiftSound,
      isLucky,
      descriptionAr: cleanVid || cleanImg
        ? 'هدية عرض كامل الغرفة بمؤثرات مخصصة من لوحة التحكم'
        : 'هدية حصرية مضافة حديثاً عبر لوحة التحكم',
    };

    adminCreateGift(gift);
    sound.stopPreviewAudio();
    setPreviewingAudioTarget(null);
    showAdminNotice('تمت إضافة الهدية إلى المتجر والغرف فوراً.');
    setNewGiftName('');
    setNewGiftImageUrl('');
    setNewGiftVideoUrl('');
    setNewGiftSoundUrl('');
    setNewGiftDurationSec('');
    setNewGiftIsLucky(false);
  };

  const openEditGiftModal = (g: GiftItem) => {
    setEditingGift(g);
    setEditImageUrl(g.imageUrl || '');
    setEditVideoUrl(g.videoUrl || '');
    setEditSoundUrl(g.soundUrl || '');
    setEditDurationSec(typeof g.effectDurationSec === 'number' ? String(g.effectDurationSec) : '');
    setEditPrice(g.coinPrice);
    setEditIsLucky(Boolean(g.isLucky || g.category === 'lucky'));
  };

  const handleSaveGiftEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGift) return;
    adminUpdateGift(editingGift.id, {
      imageUrl: editImageUrl.trim() || undefined,
      videoUrl: editVideoUrl.trim() || undefined,
      soundUrl: editSoundUrl.trim() || undefined,
      effectDurationSec: parseOptionalDurationSec(editDurationSec),
      coinPrice: Math.max(1, editPrice),
      isLucky: editIsLucky,
    });
    sound.stopPreviewAudio();
    setPreviewingAudioTarget(null);
    showAdminNotice(`تم تحديث بيانات الهدية (${editingGift.nameAr}) بنجاح.`);
    setEditingGift(null);
  };

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    adminCreateAgent({
      name: newAgentName,
      balanceCoins: newAgentBalance,
      commissionRate: newAgentRate,
    });

    showAdminNotice('تم إنشاء حساب وكيل الشحن وتخصيص رصيده بنجاح.');
    setNewAgentName('');
  };

  const handleCreateStoreItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;

    const gradientByType: Record<StoreItem['type'], string> = {
      frame: 'from-amber-400 via-yellow-300 to-amber-600',
      entrance: 'from-cyan-500 via-indigo-500 to-purple-600',
      badge: 'from-yellow-400 via-amber-500 to-orange-600',
      bubble: 'from-fuchsia-500 via-purple-500 to-indigo-600',
    };

    const defaultIconByType: Record<StoreItem['type'], string> = {
      frame: '🪽',
      entrance: '🚘',
      badge: '🎖️',
      bubble: '💬',
    };

    const newItem: StoreItem = {
      id: `${newStoreType}_custom_${Date.now()}`,
      type: newStoreType,
      nameAr: newStoreName.trim(),
      nameEn: newStoreName.trim(),
      priceCoins: Math.max(0, newStorePrice),
      durationDays: Math.max(1, newStoreDays || 30),
      previewUrl: newStorePreviewUrl.trim(),
      videoUrl: newStoreType === 'entrance' && newStoreVideoUrl.trim() ? newStoreVideoUrl.trim() : undefined,
      effectDurationSec:
        newStoreType === 'entrance' ? parseOptionalDurationSec(newStoreEffectSec) : undefined,
      previewGradient: gradientByType[newStoreType],
      icon: newStoreIcon.trim() || defaultIconByType[newStoreType],
      descriptionAr:
        newStoreDesc.trim() ||
        (newStoreType === 'entrance'
          ? 'تأثير دخولية فاخر يظهر عند دخولك إلى الغرف الصوتية'
          : newStoreType === 'frame'
          ? 'إطار فاخر يحيط بصورتك على المايك وفي الملف الشخصي'
          : newStoreType === 'badge'
          ? 'وسام شرف مميز يظهر بجانب اسمك في المتجر والغرف'
          : 'فقاعة دردشة مخصصة لرسائلك داخل الغرف'),
    };

    adminCreateStoreItem(newItem);
    showAdminNotice(`تم رفع (${newItem.nameAr}) إلى المتجر بنجاح! يظهر الآن في المتجر والحقيبة.`);
    setNewStoreName('');
    setNewStorePreviewUrl('');
    setNewStoreVideoUrl('');
    setNewStoreEffectSec('');
    setNewStoreDesc('');
  };

  // Aggregated KPIs
  const totalCoinsInCirculation = users.reduce((acc, u) => acc + u.coins, 0);
  const totalRechargeVolume = agents.reduce((acc, a) => acc + a.totalRechargedCoins, 0);

  const navTabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: 'kpi', label: 'الإحصائيات والحظ', icon: <Sliders className="w-4 h-4" /> },
    { id: 'gifts', label: 'الهدايا و MP4', icon: <Gift className="w-4 h-4" /> },
    { id: 'store', label: 'المتجر والدخوليات والإطارات', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'users', label: 'المستخدمون', icon: <Users className="w-4 h-4" /> },
    { id: 'rooms', label: 'الغرف والخلفيات', icon: <Radio className="w-4 h-4" /> },
    { id: 'agents', label: 'وكلاء الشحن', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'agencies', label: 'الوكالات', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'staff', label: 'الصلاحيات', icon: <Shield className="w-4 h-4" /> },
    { id: 'ledger', label: 'السجل المالي', icon: <History className="w-4 h-4" /> },
    { id: 'firebase', label: 'قاعدة البيانات', icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 overflow-x-hidden pb-16">
      {/* Top Banner — Full Mobile Support */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-3xl bg-gradient-to-l from-[#14192c] via-[#101424] to-[#0b0e18] border border-white/10 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white truncate">
                لوحة التحكم الإدارية
              </h1>
              <span className="text-[11px] font-mono text-amber-300">Super Admin · 360°</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              إدارة شاملة للمستخدمين، الغرف، رفع هدايا MP4 والصور، ونسبة فوز هدايا الحظ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setCurrentView('agent_portal')}
            className="flex-1 sm:flex-none min-h-[42px] px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-slate-200 text-xs font-bold transition-colors"
          >
            بوابة الوكلاء
          </button>
          <button
            onClick={() => setCurrentView('user_app')}
            className="flex-1 sm:flex-none min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للتطبيق</span>
          </button>
        </div>
      </div>

      {adminNotice && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-bold text-right flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{adminNotice}</span>
        </div>
      )}

      {/* Mobile-First 2-col Grid / Desktop Horizontal Admin Nav */}
      <nav
        aria-label="أقسام لوحة التحكم"
        className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-2"
      >
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[44px] px-3 py-2 rounded-2xl text-xs font-bold flex items-center justify-center lg:justify-start gap-2 transition-all border ${
              activeTab === tab.id
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/15'
                : 'bg-[#101524] text-slate-300 border-white/8 hover:bg-white/[0.06]'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* TAB 1: KPI OVERVIEW + LIVE LUCKY GIFT WIN-RATE CONTROLLER */}
      {activeTab === 'kpi' && (
        <div className="space-y-5">
          {/* Top 4 Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-[#101524] border border-white/8">
              <span className="text-xs text-slate-400 font-medium">إجمالي المستخدمين</span>
              <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white mt-1">
                {users.length.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-400 font-semibold">حسابات نشطة</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#101524] border border-white/8">
              <span className="text-xs text-slate-400 font-medium">الغرف الصوتية</span>
              <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-300 mt-1">
                {rooms.length}
              </div>
              <span className="text-[11px] text-slate-400">بث مباشر 8 مايكات</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#101524] border border-white/8">
              <span className="text-xs text-slate-400 font-medium">العملات المتداولة</span>
              <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-cyan-300 mt-1">
                {(totalCoinsInCirculation / 1000000).toFixed(2)}M
              </div>
              <span className="text-[11px] text-slate-400">في محافظ الأعضاء</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#101524] border border-white/8">
              <span className="text-xs text-slate-400 font-medium">شحن الوكلاء</span>
              <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-rose-300 mt-1">
                {(totalRechargeVolume / 1000000).toFixed(1)}M
              </div>
              <span className="text-[11px] text-slate-400">عمليات معتمدة</span>
            </div>
          </div>

          {/* LIVE LUCKY GIFT WIN-RATE & MULTIPLIERS CONTROL CENTER */}
          <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-br from-[#1b1427] via-[#121728] to-[#1a130b] border border-amber-400/35 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
                  🍭
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-amber-300">
                    التحكم المباشر في نسبة هدايا الحظ والمضاعفات
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    يُطبّق فوراً على جميع هدايا الحظ في الغرف والحقيبة، ويطلق الشريط العام وصوت الطشة عند تجاوز المليون
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerGlobalJackpotBanner({
                    winnerName: currentUser.displayName,
                    winnerAvatar: currentUser.avatar,
                    roomTitle: rooms[0]?.title || 'بيت العائلة 👑',
                    giftName: 'مصاصة الحظ السحرية',
                    giftIcon: '🍭',
                    amountWon: 1250000,
                    comboTotalCoins: 1250000,
                    multiplier: 188,
                  });
                  showAdminNotice('تم إطلاق تجربة الشريط العام وصوت الطشة لمدة 3 ثوانٍ!');
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>تجربة الشريط + صوت الطشة (3ث)</span>
              </button>
            </div>

            {/* Primary Win Rate Slider */}
            <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs sm:text-sm font-bold text-white">
                  نسبة احتمالية الفوز في هدايا الحظ (Win Rate %)
                </label>
                <span className="font-mono tabular-nums text-lg font-black text-emerald-400">
                  {luckyConfig.winRatePercent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={luckyConfig.winRatePercent}
                onChange={(e) => {
                  updateLuckyConfig({ winRatePercent: Number(e.target.value) });
                }}
                className="w-full accent-amber-400 h-2.5 cursor-pointer"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>0% (بدون ربح)</span>
                <span>50% (متوازن)</span>
                <span>100% (ربح مضمون كل رمية)</span>
              </div>
            </div>

            {/* Multiplier Weights & Jackpot Threshold */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">وزن 8X – 25X</span>
                  <span className="font-mono tabular-nums font-black text-amber-300">
                    {luckyConfig.lowMultiplierWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={luckyConfig.lowMultiplierWeight}
                  onChange={(e) =>
                    updateLuckyConfig({ lowMultiplierWeight: Number(e.target.value) })
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">وزن 66X – 88X</span>
                  <span className="font-mono tabular-nums font-black text-pink-400">
                    {luckyConfig.midMultiplierWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={luckyConfig.midMultiplierWeight}
                  onChange={(e) =>
                    updateLuckyConfig({ midMultiplierWeight: Number(e.target.value) })
                  }
                  className="w-full accent-pink-400"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">وزن 188X – 250X</span>
                  <span className="font-mono tabular-nums font-black text-cyan-300">
                    {luckyConfig.highMultiplierWeight}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={luckyConfig.highMultiplierWeight}
                  onChange={(e) =>
                    updateLuckyConfig({ highMultiplierWeight: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-black/35 border border-white/10 space-y-1.5">
                <label className="block text-xs text-slate-300 font-semibold">
                  حد الشريط العام وصوت الطشة (عملة)
                </label>
                <input
                  type="number"
                  min={100000}
                  step={100000}
                  value={luckyConfig.megaComboThreshold}
                  onChange={(e) =>
                    updateLuckyConfig({
                      megaComboThreshold: Math.max(100000, Number(e.target.value) || 1000000),
                    })
                  }
                  className="w-full min-h-[38px] rounded-xl bg-slate-950 border border-white/15 px-3 text-xs font-mono tabular-nums font-bold text-emerald-300 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#101524] border border-white/8 space-y-2">
              <h3 className="font-bold text-sm text-white">كتالوج الهدايا وروابط MP4</h3>
              <p className="text-xs text-slate-400">
                {gifts.length} هدية نشطة — يمكنك رفع صورة الهدية وفيديو MP4 عبر الرابط مباشرة.
              </p>
              <button
                onClick={() => setActiveTab('gifts')}
                className="text-xs font-bold text-amber-400 hover:underline"
              >
                إدارة الهدايا والروابط ←
              </button>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101524] border border-amber-400/20 space-y-2">
              <h3 className="font-bold text-sm text-white">قسم المتجر والدخوليات والإطارات</h3>
              <p className="text-xs text-slate-400">
                {storeItems.length} عنصر بالمتجر — ارفع إطارات الصور، تأثيرات الدخول (رابط/MP4)، الأوسمة والفقاعات.
              </p>
              <button
                onClick={() => setActiveTab('store')}
                className="text-xs font-bold text-amber-300 hover:underline"
              >
                إدارة المتجر والدخوليات ←
              </button>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101524] border border-white/8 space-y-2">
              <h3 className="font-bold text-sm text-white">الوكالات والمضيفين</h3>
              <p className="text-xs text-slate-400">
                {agencies.length} وكالات معتمدة تتابع أداء المضيفين والأرباح اليومية.
              </p>
              <button
                onClick={() => setActiveTab('agencies')}
                className="text-xs font-bold text-sky-400 hover:underline"
              >
                إدارة الوكالات ←
              </button>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#101524] border border-white/8 space-y-2">
              <h3 className="font-bold text-sm text-white">السجل المالي والمراقبة</h3>
              <p className="text-xs text-slate-400">
                {transactions.length} معاملة مسجلة تشمل الشحن، الهدايا، وأرباح الحظ.
              </p>
              <button
                onClick={() => setActiveTab('ledger')}
                className="text-xs font-bold text-emerald-400 hover:underline"
              >
                عرض السجل المالي ←
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GIFTS & STORE MANAGEMENT (MP4 URL + IMAGE URL + LUCKY TOGGLE) */}
      {activeTab === 'gifts' && (
        <div className="space-y-5">
          {/* Quick Lucky Rate Strip inside Gifts Tab too */}
          <div className="p-4 rounded-2xl bg-[#101524] border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-white">نسبة فوز هدايا الحظ الحالية: </span>
                <span className="font-mono tabular-nums font-black text-emerald-400">
                  {luckyConfig.winRatePercent}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input
                type="range"
                min={0}
                max={100}
                value={luckyConfig.winRatePercent}
                onChange={(e) => updateLuckyConfig({ winRatePercent: Number(e.target.value) })}
                className="flex-1 accent-amber-400 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setActiveTab('kpi')}
                className="text-[11px] font-bold text-amber-300 hover:underline shrink-0"
              >
                ضبط متقدم
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Create Gift Form with Image URL + MP4 Video URL */}
            <div className="lg:col-span-5 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>إضافة هدية جديدة (جميع الصيغ + صوت مخصص)</span>
              </h3>

              <form onSubmit={handleCreateGift} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">اسم الهدية:</label>
                  <input
                    type="text"
                    required
                    value={newGiftName}
                    onChange={(e) => setNewGiftName(e.target.value)}
                    placeholder="مثال: أسد الذهب الملكي"
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Any Image / GIF / WebP / PNG URL Input */}
                <div>
                  <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>رابط صورة أو APNG / GIF / WebP الهدية:</span>
                    </span>
                    {newGiftImageUrl.trim() && (
                      <span className="font-mono text-[10px] text-sky-300">
                        {newGiftApngInfo && !newGiftVideoUrl.trim()
                          ? `APNG • ${(newGiftApngInfo.totalDurationMs / 1000).toFixed(1)}ث (${newGiftApngInfo.numFrames} إطار)`
                          : getMediaFormatLabel(newGiftImageUrl)}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={newGiftImageUrl}
                    onChange={(e) => setNewGiftImageUrl(e.target.value)}
                    placeholder="https://example.com/gift.png أو .apng أو .gif أو .webp"
                    dir="ltr"
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-sky-300 font-mono text-left focus:outline-none focus:border-sky-400"
                  />
                </div>

                {/* Animation / Video URL Input (MP4, WebM, APNG, GIF, WebP, or Direct CDN URL) */}
                <div>
                  <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-rose-400" />
                      <span>رابط حركة الهدية (MP4 / WebM / APNG / GIF / WebP):</span>
                    </span>
                    {newGiftVideoUrl.trim() && (
                      <span className="font-mono text-[10px] text-rose-300">
                        {newGiftApngInfo
                          ? `APNG • ${(newGiftApngInfo.totalDurationMs / 1000).toFixed(1)}ث (${newGiftApngInfo.numFrames} إطار)`
                          : getMediaFormatLabel(newGiftVideoUrl)}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={newGiftVideoUrl}
                    onChange={(e) => setNewGiftVideoUrl(e.target.value)}
                    placeholder="https://example.com/luxury-gift.mp4 أو .apng أو .gif"
                    dir="ltr"
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-rose-300 font-mono text-left focus:outline-none focus:border-rose-400"
                  />
                </div>

                {/* Custom Gift Hit Sound URL + Live Test Button */}
                <div>
                  <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>رابط صوت الهدية عند الرمي (MP3 / WAV / OGG / M4A):</span>
                    </span>
                    {newGiftSoundUrl.trim() && (
                      <span className="font-mono text-[10px] text-emerald-300">
                        {getMediaFormatLabel(newGiftSoundUrl)}
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newGiftSoundUrl}
                      onChange={(e) => setNewGiftSoundUrl(e.target.value)}
                      placeholder="https://example.com/gift-sound.mp3"
                      dir="ltr"
                      className="flex-1 min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-emerald-300 font-mono text-left focus:outline-none focus:border-emerald-400"
                    />
                    {newGiftSoundUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          if (previewingAudioTarget === 'new') {
                            sound.stopPreviewAudio();
                            setPreviewingAudioTarget(null);
                          } else {
                            setPreviewingAudioTarget('new');
                            sound.previewAudioUrl(newGiftSoundUrl, () =>
                              setPreviewingAudioTarget(null)
                            );
                          }
                        }}
                        className="min-h-[42px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold flex items-center gap-1 shrink-0"
                        title="تجربة الصوت"
                      >
                        {previewingAudioTarget === 'new' ? (
                          <Square className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        <span>{previewingAudioTarget === 'new' ? 'إيقاف' : 'تجربة'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Preview for uploaded Image / GIF / WebP / Video URL */}
                {(newGiftImageUrl.trim() || newGiftVideoUrl.trim()) && (
                  <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 flex items-center gap-3">
                    {newGiftImageUrl.trim() && (
                      <SmartMediaView
                        mode="thumbnail"
                        url={newGiftImageUrl.trim()}
                        alt="معاينة الصورة"
                        className="w-14 h-14 rounded-xl object-contain bg-black border border-white/15 shrink-0"
                      />
                    )}
                    {newGiftVideoUrl.trim() && (
                      <SmartMediaView
                        mode="thumbnail"
                        url={newGiftVideoUrl.trim()}
                        preferVideo
                        alt="معاينة الحركة"
                        className="w-24 h-14 rounded-xl object-contain bg-black border border-rose-400/40 shrink-0"
                      />
                    )}
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      معاينة مباشرة — تُعرض الهدية بمقاس الغرفة بالكامل عند الرمي
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">الأيقونة البديلة:</label>
                    <input
                      type="text"
                      required
                      value={newGiftIcon}
                      onChange={(e) => setNewGiftIcon(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-center text-lg focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">التصنيف:</label>
                    <select
                      value={newGiftCat}
                      onChange={(e) => {
                        const val = e.target.value as GiftCategory;
                        setNewGiftCat(val);
                        if (val === 'lucky') setNewGiftIsLucky(true);
                      }}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="luxury">فاخرة 🏎️</option>
                      <option value="lucky">هدايا الحظ 🍭</option>
                      <option value="classic">كلاسيكية 🌹</option>
                      <option value="romantic">رومانسية 💖</option>
                      <option value="magic">سحرية SVGA 🏰</option>
                      <option value="vip">VIP حصري 👑</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">سعر العملات:</label>
                    <input
                      type="number"
                      min={1}
                      step={50}
                      value={newGiftPrice}
                      onChange={(e) => setNewGiftPrice(Number(e.target.value))}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-amber-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">عائد الألماس:</label>
                    <input
                      type="number"
                      min={0}
                      step={25}
                      value={newGiftDiamonds}
                      onChange={(e) => setNewGiftDiamonds(Number(e.target.value))}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      المؤثر الصوتي البديل:
                    </label>
                    <select
                      value={newGiftSound}
                      onChange={(e) => setNewGiftSound(e.target.value as SoundEffectType)}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                    >
                      <option value="fanfare">أبواق النصر الملكية</option>
                      <option value="roar">زئير التنين الأسطوري</option>
                      <option value="magic">سحر الفضاء والنجوم</option>
                      <option value="chime">رنين الأجراس الذهبية</option>
                      <option value="laser">صاروخ المجرة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold">
                      مدة العرض (ث - اتركه فارغاً للتلقائي):
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={newGiftDurationSec}
                      onChange={(e) => setNewGiftDurationSec(e.target.value)}
                      placeholder="تلقائي (كامل APNG/الفيديو)"
                      title="عند ترك الحقل فارغاً يعمل الفيديو و APNG بكامل مدتهما الطبيعية تلقائياً"
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-cyan-400 placeholder:text-[11px] placeholder:font-sans placeholder:text-slate-500"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-white/10 cursor-pointer">
                  <span className="font-semibold text-pink-300">
                    تفعيل كهدية حظ (تربح مضاعفات عشوائية داخل الغرفة)
                  </span>
                  <input
                    type="checkbox"
                    checked={newGiftIsLucky || newGiftCat === 'lucky'}
                    onChange={(e) => setNewGiftIsLucky(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-colors"
                >
                  نشر الهدية في المتجر والغرف فوراً
                </button>
              </form>
            </div>

            {/* Active Gifts Catalog */}
            <div className="lg:col-span-7 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">
                  الهدايا المفعلة ({gifts.length})
                </h3>
                <span className="text-[11px] text-slate-400">اضغط تعديل لإضافة رابط MP4 أو صورة</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[540px] overflow-y-auto pr-0.5">
                {gifts.map((g) => (
                  <div
                    key={g.id}
                    className="p-3 rounded-2xl bg-slate-950/90 border border-white/8 flex flex-col items-center justify-between text-center text-xs space-y-2"
                  >
                    <div className="w-full flex items-center justify-between text-[10px]">
                      <span className="font-mono text-pink-300">
                        {g.isLucky || g.category === 'lucky' ? 'حظ 🍭' : ''}
                      </span>
                      <span className="font-mono text-rose-300 flex items-center gap-1">
                        {g.soundUrl && <span className="text-emerald-300">🔊</span>}
                        {g.videoUrl || g.imageUrl
                          ? getMediaFormatLabel(g.videoUrl || g.imageUrl)
                          : ''}
                      </span>
                    </div>

                    {g.imageUrl || g.videoUrl ? (
                      <SmartMediaView
                        mode="thumbnail"
                        url={g.imageUrl || g.videoUrl}
                        preferVideo={!g.imageUrl && Boolean(g.videoUrl)}
                        alt={g.nameAr}
                        className="w-12 h-12 rounded-xl object-contain bg-black border border-white/15"
                        fallback={<span className="text-3xl leading-none my-1">{g.icon}</span>}
                      />
                    ) : (
                      <span className="text-3xl leading-none my-1">{g.icon}</span>
                    )}

                    <div className="w-full">
                      <div className="font-bold text-white truncate">{g.nameAr}</div>
                      <div className="font-mono tabular-nums text-amber-300 font-bold mt-0.5">
                        {g.coinPrice.toLocaleString()} عملة
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 w-full pt-1">
                      <button
                        type="button"
                        onClick={() => openEditGiftModal(g)}
                        className="flex-1 min-h-[34px] rounded-lg bg-white/8 hover:bg-white/14 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>روابط/تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          adminDeleteGift(g.id);
                          showAdminNotice(`تم حذف الهدية (${g.nameAr}).`);
                        }}
                        className="w-8 min-h-[34px] rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 flex items-center justify-center"
                        title="حذف الهدية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2B: COMPREHENSIVE STORE MANAGEMENT (FRAMES, ENTRANCES, BADGES, BUBBLES) */}
      {activeTab === 'store' && (
        <div className="space-y-5">
          {/* Upload / Create New Store Item Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={handleCreateStoreItem}
              className="lg:col-span-5 bg-[#101524] border border-amber-400/25 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black text-sm sm:text-base text-amber-300 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span>رفع عنصر جديد للمتجر بالرابط</span>
                </h2>
                <span className="text-[11px] text-emerald-300 font-bold">يظهر فوراً بالمتجر</span>
              </div>

              {/* Type Selector Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                {[
                  { id: 'entrance', label: 'تأثير دخولية', emoji: '🚘' },
                  { id: 'frame', label: 'إطار صورة/مايك', emoji: '🪽' },
                  { id: 'badge', label: 'وسام / شارة', emoji: '🎖️' },
                  { id: 'bubble', label: 'فقاعة دردشة', emoji: '💬' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const nextType = opt.id as StoreItem['type'];
                      setNewStoreType(nextType);
                      setNewStoreIcon(opt.emoji);
                    }}
                    className={`min-h-[38px] px-2 rounded-xl border font-bold flex items-center justify-center gap-1 transition-all ${
                      newStoreType === opt.id
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-950 text-slate-300 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 mb-1 font-semibold">اسم العنصر:</label>
                  <input
                    type="text"
                    required
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    placeholder={
                      newStoreType === 'entrance'
                        ? 'مثال: دخولية الأسد الذهبي VIP'
                        : newStoreType === 'frame'
                        ? 'مثال: إطار التاج الإمبراطوري'
                        : 'اسم العنصر في المتجر'
                    }
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">الأيقونة:</label>
                  <input
                    type="text"
                    value={newStoreIcon}
                    onChange={(e) => setNewStoreIcon(e.target.value)}
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-2 text-center text-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">السعر (عملة):</label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={newStorePrice}
                    onChange={(e) => setNewStorePrice(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-amber-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">المدة (بالأيام):</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={newStoreDays}
                    onChange={(e) => setNewStoreDays(Math.max(1, Number(e.target.value) || 30))}
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        {newStoreType === 'frame'
                          ? 'رابط صورة الإطار (PNG / GIF / WebP / أي رابط):'
                          : newStoreType === 'entrance'
                          ? 'رابط صورة أو GIF / WebP الدخولية:'
                          : 'رابط صورة العنصر (PNG / GIF / WebP):'}
                      </span>
                    </span>
                    {newStorePreviewUrl.trim() && (
                      <span className="font-mono text-[10px] text-sky-300">
                        {getMediaFormatLabel(newStorePreviewUrl)}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={newStorePreviewUrl}
                    onChange={(e) => setNewStorePreviewUrl(e.target.value)}
                    placeholder="https://example.com/item.png أو .gif أو .webp"
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-sky-300 font-mono text-left focus:outline-none focus:border-sky-400"
                  />
                </div>

                {newStoreType === 'entrance' && (
                  <>
                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between gap-1.5">
                        <span className="flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-purple-400" />
                          <span>رابط حركة الدخولية (MP4 / WebM / GIF / WebP — أي رابط):</span>
                        </span>
                        {newStoreType === 'entrance' && (
                          <span className="font-mono text-[10px] text-purple-300">
                            {newStoreApngInfo && newStoreVideoUrl.trim()
                              ? `APNG • ${(newStoreApngInfo.totalDurationMs / 1000).toFixed(1)}ث`
                              : newStoreVideoUrl.trim()
                              ? getMediaFormatLabel(newStoreVideoUrl)
                              : ''}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newStoreVideoUrl}
                        onChange={(e) => setNewStoreVideoUrl(e.target.value)}
                        placeholder="https://example.com/entrance.mp4 أو .apng أو .gif"
                        className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-purple-300 font-mono text-left focus:outline-none focus:border-purple-400"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-semibold">
                        مدة التشغيل بالثواني (اتركه فارغاً لكامل APNG/الفيديو):
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={newStoreEffectSec}
                        onChange={(e) => setNewStoreEffectSec(e.target.value)}
                        placeholder="تلقائي (كامل APNG/الفيديو)"
                        className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-cyan-400 placeholder:text-[11px] placeholder:font-sans placeholder:text-slate-500"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">الوصف:</label>
                  <input
                    type="text"
                    value={newStoreDesc}
                    onChange={(e) => setNewStoreDesc(e.target.value)}
                    placeholder="وصف مختصر يظهر في المتجر..."
                    className="w-full min-h-[38px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Live Visual Preview */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex items-center justify-center min-h-[112px]">
                {newStoreType === 'frame' ? (
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <img
                      src={currentUser.avatar}
                      alt="معاينة الإطار"
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    {newStorePreviewUrl.trim() ? (
                      <img
                        src={newStorePreviewUrl.trim()}
                        alt="الإطار"
                        referrerPolicy="no-referrer"
                        className="pointer-events-none absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] object-contain z-20"
                      />
                    ) : (
                      <span className="text-xs text-slate-400 mr-3">معاينة الإطار</span>
                    )}
                  </div>
                ) : newStoreType === 'entrance' && (newStoreVideoUrl.trim() || newStorePreviewUrl.trim()) ? (
                  <SmartMediaView
                    mode="thumbnail"
                    url={newStoreVideoUrl.trim() || newStorePreviewUrl.trim()}
                    preferVideo={Boolean(newStoreVideoUrl.trim())}
                    alt="معاينة الدخولية"
                    className="w-full max-h-32 rounded-xl object-contain"
                    fallback={<span className="text-3xl">{newStoreIcon}</span>}
                  />
                ) : newStorePreviewUrl.trim() ? (
                  <SmartMediaView
                    mode="thumbnail"
                    url={newStorePreviewUrl.trim()}
                    alt="معاينة"
                    className="max-h-24 object-contain rounded-xl"
                    fallback={<span className="text-3xl">{newStoreIcon}</span>}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400 text-xs">
                    <span className="text-3xl">{newStoreIcon}</span>
                    <span>معاينة حية للعنصر عند إضافة الرابط</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors shadow-lg shadow-amber-500/15"
              >
                رفع وإضافة إلى المتجر فوراً
              </button>
            </form>

            {/* Existing Store Items Catalog */}
            <div className="lg:col-span-7 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-bold text-sm text-white">
                  كتالوج المتجر الشامل ({storeItems.length} عنصر)
                </h2>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
                  {[
                    { id: 'all', label: `الكل (${storeItems.length})` },
                    { id: 'frame', label: `الإطارات (${storeItems.filter((i) => i.type === 'frame').length})` },
                    { id: 'entrance', label: `الدخوليات (${storeItems.filter((i) => i.type === 'entrance').length})` },
                    { id: 'badge', label: `الأوسمة (${storeItems.filter((i) => i.type === 'badge').length})` },
                    { id: 'bubble', label: `الفقاعات (${storeItems.filter((i) => i.type === 'bubble').length})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStoreFilter(tab.id as typeof storeFilter)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                        storeFilter === tab.id
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-950 text-slate-300 border border-white/10 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[700px] overflow-y-auto pr-1">
                {storeItems
                  .filter((item) => storeFilter === 'all' || item.type === storeFilter)
                  .map((item) => {
                    const draft = getStoreDraft(item);
                    const isEquipped =
                      (item.type === 'frame' && currentUser.activeFrameId === item.id) ||
                      (item.type === 'entrance' && currentUser.activeEntranceId === item.id) ||
                      (item.type === 'badge' && currentUser.activeBadgeId === item.id) ||
                      (item.type === 'bubble' && currentUser.activeBubbleId === item.id);
                    const typeLabel: Record<StoreItem['type'], string> = {
                      frame: 'إطار',
                      entrance: 'دخولية',
                      badge: 'وسام',
                      bubble: 'فقاعة',
                    };

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border flex flex-col justify-between space-y-3 ${
                          isEquipped
                            ? 'bg-[#141b30] border-amber-400/60 shadow-lg'
                            : 'bg-slate-950/75 border-white/10'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="px-2 py-0.5 rounded-lg bg-white/8 text-amber-300 font-bold">
                              {typeLabel[item.type]}
                            </span>
                            {isEquipped && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">
                                مفعل على حسابك
                              </span>
                            )}
                          </div>

                          {/* Preview */}
                          <div className="flex items-center justify-center py-2.5 bg-[#0a0e1a] rounded-xl border border-white/8 min-h-[96px]">
                            {item.type === 'frame' ? (
                              <div className="relative w-20 h-20 flex items-center justify-center">
                                <img
                                  src={currentUser.avatar}
                                  alt={draft.nameAr}
                                  referrerPolicy="no-referrer"
                                  className="w-14 h-14 rounded-full object-cover"
                                />
                                {draft.previewUrl.trim() ? (
                                  <img
                                    src={draft.previewUrl.trim()}
                                    alt={draft.nameAr}
                                    referrerPolicy="no-referrer"
                                    className="pointer-events-none absolute -inset-1.5 w-[calc(100%+12px)] h-[calc(100%+12px)] object-contain z-20"
                                  />
                                ) : (
                                  <span className="absolute -top-2 -left-1 text-2xl">{item.icon}</span>
                                )}
                              </div>
                            ) : item.type === 'entrance' && (draft.videoUrl.trim() || draft.previewUrl.trim()) ? (
                              <SmartMediaView
                                mode="thumbnail"
                                url={draft.videoUrl.trim() || draft.previewUrl.trim()}
                                preferVideo={Boolean(draft.videoUrl.trim())}
                                alt={draft.nameAr}
                                className="w-full h-24 rounded-lg object-contain"
                                fallback={<span className="text-4xl">{item.icon}</span>}
                              />
                            ) : draft.previewUrl.trim() ? (
                              <SmartMediaView
                                mode="thumbnail"
                                url={draft.previewUrl.trim()}
                                alt={draft.nameAr}
                                className="h-20 object-contain rounded-lg"
                                fallback={<span className="text-4xl">{item.icon}</span>}
                              />
                            ) : (
                              <span className="text-4xl">{item.icon}</span>
                            )}
                          </div>

                          <div className="space-y-2 text-xs">
                            <input
                              type="text"
                              value={draft.nameAr}
                              onChange={(e) => setStoreField(item, { nameAr: e.target.value })}
                              className="w-full min-h-[36px] bg-slate-900 border border-white/10 rounded-xl px-2.5 text-white font-bold focus:outline-none focus:border-amber-400"
                            />
                            <input
                              type="text"
                              dir="ltr"
                              value={draft.previewUrl}
                              onChange={(e) => setStoreField(item, { previewUrl: e.target.value })}
                              placeholder="رابط الصورة / GIF / WebP / PNG"
                              className="w-full min-h-[36px] bg-slate-900 border border-white/10 rounded-xl px-2.5 text-sky-300 font-mono text-left text-[11px] focus:outline-none focus:border-sky-400"
                            />
                            {item.type === 'entrance' && (
                              <>
                                <input
                                  type="text"
                                  dir="ltr"
                                  value={draft.videoUrl}
                                  onChange={(e) => setStoreField(item, { videoUrl: e.target.value })}
                                  placeholder="رابط الدخولية (MP4 / WebM / GIF / WebP)"
                                  className="w-full min-h-[36px] bg-slate-900 border border-white/10 rounded-xl px-2.5 text-purple-300 font-mono text-left text-[11px] focus:outline-none focus:border-purple-400"
                                />
                                <div className="flex items-center justify-between gap-2 bg-slate-900 border border-white/10 rounded-xl px-2.5 min-h-[34px]">
                                  <span className="text-[10px] text-slate-400">
                                    المدة (ث / تلقائي):
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={draft.effectDurationSec}
                                    onChange={(e) =>
                                      setStoreField(item, {
                                        effectDurationSec: e.target.value,
                                      })
                                    }
                                    placeholder="تلقائي"
                                    title="اتركه فارغاً لتعمل الدخولية (APNG / فيديو) بكامل مدتها"
                                    className="w-16 bg-transparent text-left text-cyan-300 font-mono tabular-nums font-bold focus:outline-none placeholder:text-[10px] placeholder:font-sans placeholder:text-slate-500"
                                  />
                                </div>
                              </>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min={0}
                                step={500}
                                value={draft.priceCoins}
                                onChange={(e) =>
                                  setStoreField(item, {
                                    priceCoins: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                title="السعر"
                                className="w-full min-h-[36px] bg-slate-900 border border-white/10 rounded-xl px-2.5 text-amber-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                              />
                              <input
                                type="number"
                                min={1}
                                value={draft.durationDays}
                                onChange={(e) =>
                                  setStoreField(item, {
                                    durationDays: Math.max(1, Number(e.target.value) || 30),
                                  })
                                }
                                title="المدة بالأيام"
                                className="w-full min-h-[36px] bg-slate-900 border border-white/10 rounded-xl px-2.5 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-white/10">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                adminUpdateStoreItem(item.id, {
                                  nameAr: draft.nameAr.trim() || item.nameAr,
                                  previewUrl: draft.previewUrl.trim(),
                                  videoUrl:
                                    item.type === 'entrance'
                                      ? draft.videoUrl.trim() || undefined
                                      : undefined,
                                  effectDurationSec:
                                    item.type === 'entrance'
                                      ? parseOptionalDurationSec(draft.effectDurationSec)
                                      : undefined,
                                  priceCoins: Math.max(0, draft.priceCoins),
                                  durationDays: Math.max(1, draft.durationDays),
                                });
                                showAdminNotice(`تم حفظ (${draft.nameAr}) وتحديثه في المتجر فوراً.`);
                              }}
                              className="flex-1 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/16 text-white font-bold text-[11px] transition-colors"
                            >
                              حفظ
                            </button>
                            {item.type === 'entrance' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const previewItem: StoreItem = {
                                    ...item,
                                    nameAr: draft.nameAr.trim() || item.nameAr,
                                    previewUrl: draft.previewUrl.trim(),
                                    videoUrl: draft.videoUrl.trim() || undefined,
                                    effectDurationSec: parseOptionalDurationSec(
                                      draft.effectDurationSec
                                    ),
                                  };
                                  setPreviewingEntrance(previewItem);
                                  triggerEntranceEffect(previewItem);
                                }}
                                className="min-h-[36px] px-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/40 text-purple-200 font-bold text-[11px] flex items-center gap-1"
                              >
                                <Play className="w-3 h-3" />
                                <span>معاينة</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                adminDeleteStoreItem(item.id);
                                showAdminNotice(`تم حذف (${item.nameAr}) من المتجر.`);
                              }}
                              className="w-9 min-h-[36px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 flex items-center justify-center shrink-0"
                              title="حذف من المتجر"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const updatedPayload: Partial<StoreItem> = {
                                nameAr: draft.nameAr.trim() || item.nameAr,
                                previewUrl: draft.previewUrl.trim(),
                                videoUrl:
                                  item.type === 'entrance'
                                    ? draft.videoUrl.trim() || undefined
                                    : undefined,
                                effectDurationSec:
                                  item.type === 'entrance'
                                    ? parseOptionalDurationSec(draft.effectDurationSec)
                                    : undefined,
                                priceCoins: Math.max(0, draft.priceCoins),
                                durationDays: Math.max(1, draft.durationDays),
                              };
                              adminUpdateStoreItem(item.id, updatedPayload);
                              equipInventoryItem(item.type, item.id);
                              showAdminNotice(`تم حفظ وتفعيل (${draft.nameAr}) على حسابك الآن!`);
                            }}
                            className="w-full min-h-[38px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition-colors"
                          >
                            حفظ وتفعيل الآن
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Live Entrance Preview Modal inside Admin */}
          {previewingEntrance && (
            <div
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setPreviewingEntrance(null)}
            >
              <div
                className="relative w-full max-w-md aspect-[9/16] max-h-[82dvh] rounded-3xl overflow-hidden bg-[#0a0e1a] border border-amber-400/40 shadow-2xl flex flex-col items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setPreviewingEntrance(null)}
                  className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
                {(() => {
                  const resolved = resolveEntranceStageMedia(previewingEntrance);
                  if (resolved.primaryUrl) {
                    return (
                      <SmartMediaView
                        mode="stage"
                        url={resolved.primaryUrl}
                        fallbackUrl={previewingEntrance.previewUrl}
                        preferVideo={resolved.preferVideo}
                        alt={previewingEntrance.nameAr}
                        loop
                      />
                    );
                  }
                  return <span className="text-7xl animate-bounce">{previewingEntrance.icon}</span>;
                })()}
                <div className="relative z-20 mt-auto mb-8 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#1d1408]/95 via-[#31210d]/95 to-[#1d1408]/95 border border-amber-400/60 flex items-center gap-3 shadow-2xl">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-full object-cover border border-amber-400"
                  />
                  <div className="text-right text-xs">
                    <div className="font-black text-amber-300">{currentUser.displayName}</div>
                    <div className="text-slate-200">دخل الغرفة بـ {previewingEntrance.nameAr}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* User List & Search */}
          <div className="lg:col-span-5 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 right-3" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="بحث برقم ID أو الاسم..."
                className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-2xl pr-9 pl-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs text-right transition-all ${
                      isSelected
                        ? 'bg-amber-400/15 border-amber-400/60 text-white'
                        : 'bg-slate-950/70 border-white/8 text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">
                          {u.displayName} · <span className="text-amber-300">VIP {u.vipLevel}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">ID: {u.userCode}</div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="font-mono tabular-nums font-bold text-amber-300">
                        {u.coins.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-slate-500">عملة</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Operations Panel */}
          <div className="lg:col-span-7 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-xl space-y-5">
            {selectedUser ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedUser.avatar}
                      alt={selectedUser.displayName}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400 shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="font-black text-base text-white truncate">
                        {selectedUser.displayName}
                      </h3>
                      <div className="text-xs text-amber-300 font-mono truncate">
                        ID: {selectedUser.userCode} · المستوى {selectedUser.level} · VIP{' '}
                        {selectedUser.vipLevel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adminToggleMute(selectedUser.id)}
                      className={`flex-1 sm:flex-none min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        selectedUser.isMuted
                          ? 'bg-rose-600 text-white'
                          : 'bg-white/8 text-slate-200 hover:bg-white/14'
                      }`}
                    >
                      {selectedUser.isMuted ? 'إلغاء الكتم' : 'كتم'}
                    </button>

                    <button
                      onClick={() => adminToggleBan(selectedUser.id)}
                      className={`flex-1 sm:flex-none min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        selectedUser.isBanned
                          ? 'bg-rose-600 text-white'
                          : 'bg-white/8 text-slate-200 hover:text-rose-300'
                      }`}
                    >
                      {selectedUser.isBanned ? 'فك الحظر' : 'حظر'}
                    </button>
                  </div>
                </div>

                {/* VIP Level Override */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    تعيين رتبة VIP فورياً:
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {[0, 1, 3, 5, 7, 10, 12, 15].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => adminSetVipLevel(selectedUser.id, lvl)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                          selectedUser.vipLevel === lvl
                            ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                            : 'bg-slate-950 border border-white/10 text-slate-300 hover:text-white'
                        }`}
                      >
                        VIP {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Balance Modification Form */}
                <form onSubmit={handleAdjustBalance} className="space-y-4 pt-3 border-t border-white/10">
                  <h4 className="font-bold text-xs text-white">تعديل رصيد المحفظة:</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        العملات الذهبية (+ أو -):
                      </label>
                      <input
                        type="number"
                        step="10000"
                        value={adjustCoins}
                        onChange={(e) => setAdjustCoins(Number(e.target.value))}
                        className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-amber-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        الألماس (+ أو -):
                      </label>
                      <input
                        type="number"
                        step="5000"
                        value={adjustDiamonds}
                        onChange={(e) => setAdjustDiamonds(Number(e.target.value))}
                        className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      سبب التعديل:
                    </label>
                    <input
                      type="text"
                      required
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[44px] py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg transition-colors"
                  >
                    تطبيق التعديل المالي في المحفظة
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                اختر مستخدماً من القائمة
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: ROOMS MANAGEMENT, MODERATORS & CUSTOM BACKGROUNDS BY URL */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          {/* Room Backgrounds URL Uploader + Gallery */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newBgUrl.trim()) return;
                const created = adminCreateRoomBackground({
                  nameAr: newBgName.trim() || `خلفية غرفة #${roomBackgrounds.length + 1}`,
                  imageUrl: newBgUrl.trim(),
                });
                setNewBgName('');
                setNewBgUrl('');
                showAdminNotice(`تم رفع الخلفية (${created.nameAr}) وتظهر الآن للمستخدمين داخل الغرف!`);
              }}
              className="lg:col-span-5 bg-[#101524] border border-amber-400/25 rounded-3xl p-4 sm:p-5 space-y-3.5 shadow-xl"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-sm sm:text-base text-amber-300 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>رفع خلفية غرفة جديدة بالرابط</span>
                </h3>
                <span className="text-[11px] text-emerald-300 font-bold">تظهر فوراً بالغرف</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">اسم الخلفية:</label>
                  <input
                    type="text"
                    required
                    value={newBgName}
                    onChange={(e) => setNewBgName(e.target.value)}
                    placeholder="مثال: قاعة القصر الذهبي / سهرة النيون"
                    className="w-full min-h-[40px] bg-slate-950 border border-white/12 rounded-xl px-3 text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>رابط صورة الخلفية (PNG / JPG / GIF / WebP):</span>
                    </span>
                  </label>
                  <input
                    type="url"
                    required
                    dir="ltr"
                    value={newBgUrl}
                    onChange={(e) => setNewBgUrl(e.target.value)}
                    placeholder="https://example.com/room-wallpaper.jpg"
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-sky-300 font-mono text-left focus:outline-none focus:border-sky-400"
                  />
                </div>

                {newBgUrl.trim() && (
                  <div className="relative h-32 rounded-2xl overflow-hidden border border-white/12 bg-slate-950">
                    <img
                      src={newBgUrl.trim()}
                      alt={newBgName || 'معاينة الخلفية'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 bg-black/70 text-[11px] font-bold text-white flex items-center justify-between">
                      <span className="truncate">{newBgName.trim() || 'معاينة مباشرة'}</span>
                      <span className="text-emerald-300 font-mono text-[10px]">PREVIEW</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة الخلفية للغرف فوراً</span>
                </button>
              </div>
            </form>

            {/* Uploaded Room Backgrounds Gallery */}
            <div className="lg:col-span-7 bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-white">
                  خلفيات الغرف المرفوعة بالروابط ({roomBackgrounds.length})
                </h3>
                <span className="text-[11px] text-slate-400">
                  تظهر للمالك والمشرفين في إعدادات الغرفة للاختيار منها
                </span>
              </div>

              {roomBackgrounds.length === 0 ? (
                <div className="py-10 rounded-2xl bg-slate-950/70 border border-white/8 text-center space-y-2">
                  <div className="text-3xl opacity-80">🖼️</div>
                  <p className="text-xs text-slate-400">
                    لم يتم رفع خلفيات مخصصة بعد — أضف رابط صورة من النموذج وسيظهر فوراً في جميع الغرف.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[340px] overflow-y-auto pr-0.5">
                  {roomBackgrounds.map((bg) => (
                    <div
                      key={bg.id}
                      className="group relative rounded-2xl overflow-hidden border border-white/12 bg-slate-950 flex flex-col"
                    >
                      <div className="relative h-28 w-full overflow-hidden">
                        <img
                          src={bg.imageUrl}
                          alt={bg.nameAr}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            adminDeleteRoomBackground(bg.id);
                            showAdminNotice(`تم حذف الخلفية (${bg.nameAr}).`);
                          }}
                          className="absolute top-2 left-2 w-8 h-8 rounded-xl bg-rose-600/85 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-colors"
                          title="حذف الخلفية"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-2.5 text-right space-y-0.5">
                        <div className="text-xs font-bold text-white truncate">{bg.nameAr}</div>
                        <div className="text-[10px] font-mono text-sky-300/80 truncate" dir="ltr">
                          {bg.imageUrl}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Rooms + Room Moderator Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => {
              const roomMods = (room.moderators || []).filter((id) => id !== room.ownerId);
              const candidateUsers = users.filter((u) => u.id !== room.ownerId);
              const selectedTargetId =
                roomModTargetUserByRoom[room.id] || candidateUsers[0]?.id || '';

              return (
                <div
                  key={room.id}
                  className="p-4 sm:p-5 rounded-3xl bg-[#101524] border border-white/10 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-mono text-amber-300">ID: {room.roomNo}</span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          room.isLocked
                            ? 'bg-rose-500/20 text-rose-300'
                            : room.type === 'password'
                            ? 'bg-amber-500/20 text-amber-300'
                            : room.type === 'vip'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {room.isLocked
                          ? '🔒 مقفلة'
                          : room.type === 'password'
                          ? '🔑 برمز مرور'
                          : room.type === 'vip'
                          ? '👑 VIP'
                          : 'عامة'}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-white">{room.title}</h4>
                    <div className="text-xs text-slate-400">المالك: {room.ownerName}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-cyan-300 font-mono">
                        المتواجدين: {room.onlineViewersCount}
                      </span>
                      <span className="text-amber-300/90 font-semibold">
                        المشرفون: {roomMods.length}
                      </span>
                    </div>

                    {/* Assign / Remove Room Moderator from Admin Dashboard */}
                    <div className="pt-2 border-t border-white/8 space-y-2">
                      <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>منح / سحب إشراف الغرفة:</span>
                      </div>

                      {candidateUsers.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedTargetId}
                            onChange={(e) =>
                              setRoomModTargetUserByRoom((prev) => ({
                                ...prev,
                                [room.id]: e.target.value,
                              }))
                            }
                            className="flex-1 min-w-0 h-9 rounded-xl bg-slate-950 border border-white/12 px-2 text-[11px] text-white focus:outline-none focus:border-amber-400"
                          >
                            {candidateUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.displayName} ({u.userCode})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              if (!selectedTargetId) return;
                              const res = adminToggleRoomModerator(room.id, selectedTargetId);
                              showAdminNotice(res.message);
                            }}
                            className="h-9 px-2.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-[11px] font-bold shrink-0 flex items-center gap-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>
                              {roomMods.includes(selectedTargetId) ? 'سحب' : 'منح إشراف'}
                            </span>
                          </button>
                        </div>
                      )}

                      {roomMods.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {roomMods.map((modId) => {
                            const modUser = users.find((u) => u.id === modId);
                            return (
                              <button
                                key={modId}
                                type="button"
                                onClick={() => {
                                  const res = adminToggleRoomModerator(room.id, modId);
                                  showAdminNotice(res.message);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-rose-500/25 border border-indigo-400/30 text-[10px] text-indigo-200 flex items-center gap-1"
                                title="اضغط لسحب الإشراف"
                              >
                                <span>🛡️ {modUser?.displayName || modId}</span>
                                <X className="w-2.5 h-2.5" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono tabular-nums text-slate-400">
                      الألماس: {(room.totalDiamondsEarned / 1000).toFixed(0)}K
                    </span>
                    <button
                      onClick={() => {
                        adminCloseRoom(room.id);
                        showAdminNotice(`تم إغلاق الغرفة (${room.title}).`);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold"
                    >
                      إغلاق الغرفة
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: RECHARGE AGENTS MANAGEMENT */}
      {activeTab === 'agents' && (
        <div className="space-y-5">
          <div className="p-4 sm:p-5 rounded-3xl bg-[#101524] border border-white/10">
            <h3 className="font-bold text-sm text-white mb-3">
              تأسيس وكيل شحن جديد وتخصيص رصيده:
            </h3>
            <form onSubmit={handleCreateAgent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="اسم الوكيل / المكتب"
                className="min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-teal-400"
              />
              <input
                type="number"
                step="500000"
                value={newAgentBalance}
                onChange={(e) => setNewAgentBalance(Number(e.target.value))}
                placeholder="الرصيد المبدئي"
                className="min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-amber-300 font-mono focus:outline-none focus:border-teal-400"
              />
              <input
                type="number"
                step="0.5"
                value={newAgentRate}
                onChange={(e) => setNewAgentRate(Number(e.target.value))}
                placeholder="نسبة العمولة %"
                className="min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-xs text-emerald-300 font-mono focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="min-h-[42px] py-2 px-4 rounded-xl bg-teal-400 hover:bg-teal-300 text-slate-950 font-black text-xs shadow-md transition-colors"
              >
                إنشاء واعتماد الوكيل
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="p-4 sm:p-5 rounded-3xl bg-[#101524] border border-white/10 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white truncate">{ag.name}</span>
                    <span className="text-xs font-mono text-teal-400 shrink-0">{ag.agentCode}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 my-3 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400 block">الرصيد المتاح</span>
                      <div className="font-mono tabular-nums font-bold text-amber-300 mt-0.5 truncate">
                        {ag.balanceCoins.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400 block">إجمالي الشحن</span>
                      <div className="font-mono tabular-nums font-bold text-slate-200 mt-0.5 truncate">
                        {ag.totalRechargedCoins.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950">
                      <span className="text-[10px] text-slate-400 block">العمولة</span>
                      <div className="font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                        {ag.commissionRate}%
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    adminTopupAgent(ag.id, 1000000);
                    showAdminNotice(`تمت إضافة 1,000,000 عملة لرصيد الوكيل ${ag.name}.`);
                  }}
                  className="w-full min-h-[42px] py-2 rounded-xl bg-white/8 hover:bg-white/14 text-teal-300 text-xs font-bold transition-colors"
                >
                  + شحن 1,000,000 عملة إضافية للوكيل
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AGENCIES MANAGEMENT */}
      {activeTab === 'agencies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agencies.map((agency) => (
            <div
              key={agency.id}
              className="p-4 sm:p-5 rounded-3xl bg-[#101524] border border-white/10 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{agency.logo}</span>
                    <h4 className="font-bold text-sm text-white truncate">{agency.name}</h4>
                  </div>
                  <span
                    className={`text-xs font-bold shrink-0 ${
                      agency.status === 'active' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {agency.status === 'active' ? 'نشطة' : 'معلقة'}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  المالك: {agency.ownerName} · العمولة:{' '}
                  <span className="text-amber-300 font-mono">{agency.commissionRate}%</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-mono">المضيفين: {agency.hostCount}</span>
                <button
                  onClick={() => {
                    const nextStatus = agency.status === 'active' ? 'suspended' : 'active';
                    adminUpdateAgencyStatus(agency.id, nextStatus);
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/14 text-slate-200 font-bold"
                >
                  {agency.status === 'active' ? 'إيقاف مؤقت' : 'تفعيل الوكالة'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 7: STAFF ROLES & PERMISSIONS */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-400/25 text-xs text-indigo-200">
            نظام الصلاحيات الموزعة (RBAC): لكل مشرف وموظف صلاحيات واضحة ومستقلة.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {staff.map((member) => (
              <div
                key={member.id}
                className="p-4 rounded-2xl bg-[#101524] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center font-bold text-amber-400 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{member.name}</div>
                    <div className="text-slate-400 truncate">
                      @{member.username} · {member.lastActive}
                    </div>
                  </div>
                </div>

                <span className="text-xs font-bold text-indigo-300 shrink-0">{member.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: FINANCIAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-[#101524] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>السجل المالي العام للعمليات ({transactions.length})</span>
          </h3>

          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3 rounded-2xl bg-slate-950/90 border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-white break-words">{tx.details}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {tx.userName} · {tx.timestamp}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0.5 shrink-0">
                  {tx.coinsDelta !== 0 && (
                    <div
                      className={`font-mono tabular-nums font-bold ${
                        tx.coinsDelta > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.coinsDelta > 0
                        ? `+${tx.coinsDelta.toLocaleString()}`
                        : tx.coinsDelta.toLocaleString()}{' '}
                      عملة
                    </div>
                  )}
                  {tx.diamondsDelta !== 0 && (
                    <div className="font-mono tabular-nums font-bold text-cyan-300">
                      {tx.diamondsDelta > 0
                        ? `+${tx.diamondsDelta.toLocaleString()}`
                        : tx.diamondsDelta.toLocaleString()}{' '}
                      ألماس
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: FIREBASE CLOUD DATABASE & REAL-TIME SYNC */}
      {activeTab === 'firebase' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#10192b] via-[#0e1524] to-[#0b101d] border border-emerald-500/30 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-white">قاعدة بيانات Firebase المتصلة</h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        firebaseStatus.isConnected
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                      }`}
                    >
                      {firebaseStatus.isConnected ? '● متصل بنجاح' : '● جاري التحقق'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono" dir="ltr">
                    Project: {firebaseStatus.projectId} · DB: {firebaseStatus.databaseId}
                    {firebaseStatus.latencyMs !== undefined ? ` · ${firebaseStatus.latencyMs}ms` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void testCloudConnection()}
                  disabled={firebaseStatus.isTesting}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wifi className="w-4 h-4" />
                  <span>{firebaseStatus.isTesting ? 'جاري الفحص...' : 'اختبار الاتصال المباشر'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void syncAllDataToCloud()}
                  disabled={isCloudSyncing}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isCloudSyncing ? 'animate-spin' : ''}`} />
                  <span>{isCloudSyncing ? 'جاري المزامنة...' : 'مزامنة البيانات إلى Firestore'}</span>
                </button>
              </div>
            </div>

            {cloudMessage && (
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 text-xs text-emerald-300 font-semibold">
                {cloudMessage}
              </div>
            )}

            {/* Google Authentication Gate for Cloud Writes */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-white">
                  حالة المصادقة السحابية (Google Auth)
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {firebaseUser
                    ? `متصل بالحساب: ${firebaseUser.email || firebaseUser.displayName}`
                    : 'سجّل الدخول بحساب Google لتفعيل الكتابة والمزامنة السحابية التلقائية عبر الأجهزة'}
                </div>
              </div>

              {firebaseUser ? (
                <button
                  type="button"
                  onClick={() => void signOutCloud()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogleCloud()}
                  disabled={isCloudSyncing}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <LogIn className="w-4 h-4" />
                  <span>ربط بحساب Google</span>
                </button>
              )}
            </div>

            {/* Active Collections Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/8">
                <div className="text-slate-400 font-mono text-[11px]">auravoice_users</div>
                <div className="text-white font-black text-base mt-1">{users.length}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/8">
                <div className="text-slate-400 font-mono text-[11px]">auravoice_rooms</div>
                <div className="text-amber-300 font-black text-base mt-1">{rooms.length}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/8">
                <div className="text-slate-400 font-mono text-[11px]">auravoice_gifts</div>
                <div className="text-pink-300 font-black text-base mt-1">{gifts.length}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/8">
                <div className="text-slate-400 font-mono text-[11px]">auravoice_transactions</div>
                <div className="text-cyan-300 font-black text-base mt-1">{transactions.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EXISTING GIFT MODAL (Attach Any Media URL + Custom Sound URL + Duration) */}
      {editingGift && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            sound.stopPreviewAudio();
            setPreviewingAudioTarget(null);
            setEditingGift(null);
          }}
        >
          <div
            className="w-full max-w-md bg-[#111626] border border-white/12 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">
                تعديل روابط وصوت الهدية: {editingGift.nameAr}
              </h3>
              <button
                onClick={() => {
                  sound.stopPreviewAudio();
                  setPreviewingAudioTarget(null);
                  setEditingGift(null);
                }}
                className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGiftEdit} className="space-y-3 text-xs">
              <div>
                <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                  <span>رابط صورة أو APNG / GIF / WebP الهدية:</span>
                  {editImageUrl.trim() && (
                    <span className="font-mono text-[10px] text-sky-300">
                      {editGiftApngInfo && !editVideoUrl.trim()
                        ? `APNG • ${(editGiftApngInfo.totalDurationMs / 1000).toFixed(1)}ث (${editGiftApngInfo.numFrames} إطار)`
                        : getMediaFormatLabel(editImageUrl)}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://example.com/gift.png أو .apng أو .gif"
                  className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-sky-300 font-mono text-left focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                  <span>رابط حركة الهدية (MP4 / WebM / APNG / GIF / WebP):</span>
                  {editVideoUrl.trim() && (
                    <span className="font-mono text-[10px] text-rose-300">
                      {editGiftApngInfo
                        ? `APNG • ${(editGiftApngInfo.totalDurationMs / 1000).toFixed(1)}ث (${editGiftApngInfo.numFrames} إطار)`
                        : getMediaFormatLabel(editVideoUrl)}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editVideoUrl}
                  onChange={(e) => setEditVideoUrl(e.target.value)}
                  placeholder="https://example.com/gift-animation.mp4 أو .apng أو .gif"
                  className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-rose-300 font-mono text-left focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-slate-300 mb-1 font-semibold">
                  <span>رابط صوت الهدية (MP3 / WAV / OGG / M4A):</span>
                  {editSoundUrl.trim() && (
                    <span className="font-mono text-[10px] text-emerald-300">
                      {getMediaFormatLabel(editSoundUrl)}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={editSoundUrl}
                    onChange={(e) => setEditSoundUrl(e.target.value)}
                    placeholder="https://example.com/gift-sound.mp3"
                    className="flex-1 min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-emerald-300 font-mono text-left focus:outline-none focus:border-emerald-400"
                  />
                  {editSoundUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        if (previewingAudioTarget === 'edit') {
                          sound.stopPreviewAudio();
                          setPreviewingAudioTarget(null);
                        } else {
                          setPreviewingAudioTarget('edit');
                          sound.previewAudioUrl(editSoundUrl, () =>
                            setPreviewingAudioTarget(null)
                          );
                        }
                      }}
                      className="min-h-[42px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold flex items-center gap-1 shrink-0"
                    >
                      {previewingAudioTarget === 'edit' ? (
                        <Square className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{previewingAudioTarget === 'edit' ? 'إيقاف' : 'تجربة'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">السعر (عملة):</label>
                  <input
                    type="number"
                    min={1}
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-amber-300 font-mono tabular-nums font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    المدة (ث / فارغ = تلقائي):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={editDurationSec}
                    onChange={(e) => setEditDurationSec(e.target.value)}
                    placeholder="تلقائي (كامل APNG)"
                    className="w-full min-h-[42px] bg-slate-950 border border-white/12 rounded-xl px-3 text-cyan-300 font-mono tabular-nums font-bold focus:outline-none focus:border-cyan-400 placeholder:text-[11px] placeholder:font-sans placeholder:text-slate-500"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-white/10 cursor-pointer">
                <span className="font-semibold text-pink-300">هدية حظ بمضاعفات</span>
                <input
                  type="checkbox"
                  checked={editIsLucky}
                  onChange={(e) => setEditIsLucky(e.target.checked)}
                  className="w-4 h-4 accent-amber-400"
                />
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.stopPreviewAudio();
                    setPreviewingAudioTarget(null);
                    setEditingGift(null);
                  }}
                  className="flex-1 min-h-[42px] rounded-xl bg-white/8 text-slate-300 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[42px] rounded-xl bg-amber-400 text-slate-950 font-black"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
