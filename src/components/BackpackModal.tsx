import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  ShoppingBag,
  Backpack,
  Check,
  Sparkles,
  Send,
  Radio,
  Video,
  Play,
  Coins,
  Plus,
  Search,
  Eye,
  ArrowUpDown,
  Clock,
  Shield,
  Trash2,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { StoreItem } from '../types';
import { SmartMediaView } from './SmartMediaView';
import { getMediaFormatLabel, resolveEntranceStageMedia } from '../utils/mediaFormats';
import { sound } from '../utils/audio';

interface BackpackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MasterSection = 'store' | 'backpack';
type BackpackCategory = 'frames' | 'entrances' | 'badges' | 'bubbles' | 'lucky_bag';
type SortMode = 'default' | 'price_asc' | 'price_desc';

const TYPE_LABELS: Record<StoreItem['type'], string> = {
  frame: 'إطار صورة',
  entrance: 'دخولية غرفة',
  badge: 'وسام ملكي',
  bubble: 'فقاعة دردشة',
};

const TYPE_TO_BAG_TAB: Record<StoreItem['type'], BackpackCategory> = {
  frame: 'frames',
  entrance: 'entrances',
  badge: 'badges',
  bubble: 'bubbles',
};

export const BackpackModal: React.FC<BackpackModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    storeItems,
    ownedStoreItems,
    isStoreItemOwned,
    gifts,
    bagGifts,
    luckyConfig,
    activeRoom,
    rooms,
    activeModal,
    isAdminAccount,
    setActiveModal,
    setCurrentView,
    joinRoom,
    consumeBagGift,
    evaluateLuckyGiftWin,
    equipInventoryItem,
    purchaseStoreItem,
    sendRoomMessage,
    triggerFlyingGift,
  } = useApp();

  const [section, setSection] = useState<MasterSection>(
    activeModal === 'store' ? 'store' : 'backpack'
  );
  const [storeCategory, setStoreCategory] = useState<'all' | StoreItem['type']>('all');
  const [backpackTab, setBackpackTab] = useState<BackpackCategory>('frames');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [previewEntrance, setPreviewEntrance] = useState<StoreItem | null>(null);
  const [tryOnFrame, setTryOnFrame] = useState<StoreItem | null>(null);
  const [selectedBagCount, setSelectedBagCount] = useState<number>(1);
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: 'success' | 'info' | 'warning';
    jumpToBagTab?: BackpackCategory;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSection(activeModal === 'store' ? 'store' : 'backpack');
      setTryOnFrame(null);
      setFeedback(null);
    }
  }, [isOpen, activeModal]);

  const showFeedback = (
    message: string,
    tone: 'success' | 'info' | 'warning' = 'success',
    jumpToBagTab?: BackpackCategory
  ) => {
    setFeedback({ message, tone, jumpToBagTab });
  };

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const frames = useMemo(() => storeItems.filter((i) => i.type === 'frame'), [storeItems]);
  const entrances = useMemo(() => storeItems.filter((i) => i.type === 'entrance'), [storeItems]);
  const badges = useMemo(() => storeItems.filter((i) => i.type === 'badge'), [storeItems]);
  const bubbles = useMemo(() => storeItems.filter((i) => i.type === 'bubble'), [storeItems]);

  // STRICT OWNERSHIP: Only purchased/owned items appear inside Backpack categories
  const ownedFrames = useMemo(
    () => frames.filter((i) => isStoreItemOwned(i.id)),
    [frames, ownedStoreItems]
  );
  const ownedEntrances = useMemo(
    () => entrances.filter((i) => isStoreItemOwned(i.id)),
    [entrances, ownedStoreItems]
  );
  const ownedBadges = useMemo(
    () => badges.filter((i) => isStoreItemOwned(i.id)),
    [badges, ownedStoreItems]
  );
  const ownedBubbles = useMemo(
    () => bubbles.filter((i) => isStoreItemOwned(i.id)),
    [bubbles, ownedStoreItems]
  );

  const ownedBagGiftEntries = useMemo(
    () =>
      Object.entries(bagGifts)
        .filter(([, count]) => count > 0)
        .map(([giftId, count]) => ({
          gift: gifts.find((g) => g.id === giftId),
          count,
        }))
        .filter((entry): entry is { gift: NonNullable<typeof entry.gift>; count: number } =>
          Boolean(entry.gift)
        ),
    [bagGifts, gifts]
  );

  const totalBagGiftsCount = useMemo(
    () => ownedBagGiftEntries.reduce((sum, entry) => sum + entry.count, 0),
    [ownedBagGiftEntries]
  );

  const totalOwnedWearablesCount =
    ownedFrames.length + ownedEntrances.length + ownedBadges.length + ownedBubbles.length;

  const equippedFrame = frames.find((f) => f.id === currentUser.activeFrameId);
  const equippedEntrance = entrances.find((e) => e.id === currentUser.activeEntranceId);
  const equippedBadge = badges.find((b) => b.id === currentUser.activeBadgeId);
  const equippedBubble = bubbles.find((b) => b.id === currentUser.activeBubbleId);

  const displayedShowcaseFrame = section === 'store' && tryOnFrame ? tryOnFrame : equippedFrame;

  const filteredStoreItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = storeItems.filter((item) => {
      if (storeCategory !== 'all' && item.type !== storeCategory) return false;
      if (!q) return true;
      return (
        item.nameAr.toLowerCase().includes(q) ||
        item.descriptionAr.toLowerCase().includes(q) ||
        TYPE_LABELS[item.type].toLowerCase().includes(q)
      );
    });

    if (sortMode === 'price_asc') {
      return [...list].sort((a, b) => a.priceCoins - b.priceCoins);
    }
    if (sortMode === 'price_desc') {
      return [...list].sort((a, b) => b.priceCoins - a.priceCoins);
    }
    return list;
  }, [storeItems, storeCategory, searchQuery, sortMode]);

  if (!isOpen) return null;

  const getRemainingDays = (itemId: string): number => {
    const rec = ownedStoreItems[itemId];
    if (!rec) return 0;
    const diffMs = new Date(rec.expiresAt).getTime() - Date.now();
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  };

  const isItemEquipped = (item: StoreItem): boolean => {
    if (item.type === 'frame') return currentUser.activeFrameId === item.id;
    if (item.type === 'entrance') return currentUser.activeEntranceId === item.id;
    if (item.type === 'badge') return currentUser.activeBadgeId === item.id;
    if (item.type === 'bubble') return currentUser.activeBubbleId === item.id;
    return false;
  };

  const handleBuyStoreItem = (item: StoreItem) => {
    const alreadyOwned = isStoreItemOwned(item.id);
    if (currentUser.coins < item.priceCoins) {
      showFeedback(
        `رصيدك غير كافٍ لشراء (${item.nameAr}) — تحتاج ${item.priceCoins.toLocaleString('en-US')} عملة. جاري فتح المحفظة للشحن...`,
        'warning'
      );
      purchaseStoreItem(item.id);
      return;
    }

    const ok = purchaseStoreItem(item.id);
    if (ok) {
      const targetTab = TYPE_TO_BAG_TAB[item.type];
      showFeedback(
        alreadyOwned
          ? `تم تمديد ملكية (${item.nameAr}) +${item.durationDays} يوم داخل حقيبتك بنجاح.`
          : `تم شراء (${item.nameAr}) بنجاح ونقله إلى حقيبتك! افتح الحقيبة للارتداء أو الإزالة وقتما تشاء.`,
        'success',
        targetTab
      );
    }
  };

  const handleEquipOwnedItem = (item: StoreItem) => {
    const ok = equipInventoryItem(item.type, item.id);
    if (!ok) {
      showFeedback('يجب شراء العنصر من المتجر أولاً قبل ارتدائه.', 'warning');
      return;
    }
    showFeedback(`تم ارتداء (${item.nameAr}) بنجاح — يظهر الآن على حسابك وفي الغرف.`, 'success');
  };

  const handleUnequipItem = (type: StoreItem['type'], label: string) => {
    equipInventoryItem(type, '');
    showFeedback(`تمت إزالة (${label}) بنجاح.`, 'info');
  };

  const jumpToStoreCategory = (cat: 'all' | StoreItem['type']) => {
    setStoreCategory(cat);
    setSection('store');
  };

  const occupiedSeats = activeRoom ? activeRoom.seats.filter((s) => Boolean(s.userId)) : [];

  const handleUseBagGiftInRoom = (giftId: string, ownedCount: number) => {
    const giftObj = gifts.find((g) => g.id === giftId);
    if (!giftObj) return;

    if (!activeRoom) {
      const targetRoomId = rooms[0]?.id;
      if (targetRoomId) {
        onClose();
        joinRoom(targetRoomId);
      }
      return;
    }

    if (occupiedSeats.length === 0) {
      showFeedback('اصعد على مايك داخل الغرفة أولاً لإرسال هدية الحظ من الحقيبة.', 'warning');
      return;
    }

    const sendQty = Math.min(ownedCount, selectedBagCount);
    const ok = consumeBagGift(giftId, sendQty);
    if (!ok) return;

    sound.unlockAudio();

    const targetSeat = occupiedSeats[0];
    const targetName = targetSeat.userName || `مايك ${targetSeat.index + 1}`;
    triggerFlyingGift(giftObj, sendQty, targetName);

    if (!giftObj.videoUrl && !giftObj.imageUrl) {
      sound.playGiftHitAudio(giftObj.soundEffect, giftObj.soundUrl);
    }

    const isLucky =
      giftObj.isLucky || giftObj.category === 'lucky' || giftObj.animationType === 'lollipop_matrix';

    if (isLucky) {
      const luckyRes = evaluateLuckyGiftWin(
        giftObj,
        sendQty,
        sendQty,
        giftObj.coinPrice * sendQty,
        activeRoom.title
      );
      if (luckyRes.won) {
        showFeedback(
          `أرسلت ${giftObj.nameAr} ×${sendQty} إلى ${targetSeat.userName || 'المضيف'} وربحت +${luckyRes.winCoins.toLocaleString('en-US')} عملة (${luckyRes.multiplier}X)!`,
          'success'
        );
      } else {
        showFeedback(`تم إرسال ${giftObj.nameAr} ×${sendQty} من الحقيبة بنجاح.`, 'success');
      }
    } else {
      showFeedback(
        `تم إرسال ${giftObj.nameAr} ×${sendQty} من الحقيبة إلى ${targetSeat.userName || 'المضيف'}.`,
        'success'
      );
    }

    sendRoomMessage(
      `أرسل من الحقيبة ${giftObj.icon} ${giftObj.nameAr} ×${sendQty} إلى ${targetName}`
    );
  };

  const renderItemArtwork = (item: StoreItem) => {
    if (item.type === 'frame' && item.previewUrl) {
      return (
        <div className="relative w-24 h-24 flex items-center justify-center">
          <img
            src={currentUser.avatar}
            alt={item.nameAr}
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full object-cover ring-1 ring-white/10"
          />
          <img
            src={item.previewUrl}
            alt={item.nameAr}
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[96px] h-[96px] object-contain z-20"
          />
        </div>
      );
    }

    if (item.type === 'entrance' && (item.videoUrl || item.previewUrl)) {
      return (
        <SmartMediaView
          mode="thumbnail"
          url={item.videoUrl || item.previewUrl}
          preferVideo={Boolean(item.videoUrl)}
          alt={item.nameAr}
          className="w-full h-full object-contain p-2"
          fallback={<span className="text-5xl">{item.icon}</span>}
        />
      );
    }

    if (item.previewUrl) {
      return (
        <SmartMediaView
          mode="thumbnail"
          url={item.previewUrl}
          alt={item.nameAr}
          className="w-full h-full object-contain p-3"
          fallback={<span className="text-5xl">{item.icon}</span>}
        />
      );
    }

    return <span className="text-5xl">{item.icon}</span>;
  };

  const renderOwnedCategoryGrid = (
    items: StoreItem[],
    emptyTitle: string,
    emptyHint: string,
    storeTargetCategory: StoreItem['type']
  ) => {
    if (items.length === 0) {
      return (
        <div className="py-12 px-6 rounded-3xl bg-[#0c111e] border border-white/8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-300">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-sm font-black text-white">{emptyTitle}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{emptyHint}</p>
          </div>
          <button
            type="button"
            onClick={() => jumpToStoreCategory(storeTargetCategory)}
            className="min-h-[42px] px-5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-105 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg shadow-amber-500/15 transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>تصفح المتجر للشراء</span>
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const equipped = isItemEquipped(item);
          const remainingDays = getRemainingDays(item.id);
          return (
            <div
              key={item.id}
              className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
                equipped
                  ? 'bg-[#151c2e] border-amber-400/70 shadow-lg shadow-amber-500/10'
                  : 'bg-[#111726] border-white/10 hover:border-white/20'
              }`}
            >
              {/* Product Stage */}
              <div
                className="relative h-36 flex items-center justify-center overflow-hidden border-b border-white/8"
                style={{
                  background:
                    'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.12), rgba(7, 10, 18, 0.96) 74%)',
                }}
              >
                {renderItemArtwork(item)}

                {item.type === 'entrance' && (item.videoUrl || item.previewUrl) && (
                  <button
                    type="button"
                    onClick={() => setPreviewEntrance(item)}
                    className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black border border-white/15 text-[11px] font-bold text-amber-300 flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span>معاينة</span>
                  </button>
                )}

                {equipped && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-black/70 px-2.5 py-1 rounded-lg border border-emerald-400/35">
                    <Check className="w-3.5 h-3.5" />
                    <span>مرتدى الآن</span>
                  </div>
                )}
              </div>

              {/* Metadata & Equip/Remove Actions */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                <div className="space-y-1 text-right">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                    <span>{TYPE_LABELS[item.type]}</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-300/90">
                      <Clock className="w-3 h-3" />
                      متبقي {remainingDays} يوم
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-white truncate">{item.nameAr}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.descriptionAr}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/8">
                  {equipped ? (
                    <button
                      type="button"
                      onClick={() => handleUnequipItem(item.type, item.nameAr)}
                      className="w-full min-h-[42px] rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/40 text-rose-200 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة من الحساب</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEquipOwnedItem(item)}
                      className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-105 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/15 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>ارتداء الآن</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-tajawal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-[#0a0f1c] border border-white/12 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Boutique Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-white/10 bg-[#070b15] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/logo.png"
              alt="فوكاشات"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-cover ring-1 ring-amber-400/50 shrink-0"
            />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate">
                {section === 'store' ? 'متجر فوكاشات الملكي' : 'حقيبتي الشخصية'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {section === 'store'
                  ? 'اشترِ الإطارات والدخوليات والأوسمة لتنتقل فوراً إلى حقيبتك'
                  : 'ارتدِ مقتنياتك المشتراة أو أزلها وأرسل هدايا الحظ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Wallet Balance & Quick Recharge */}
            <button
              type="button"
              onClick={() => setActiveModal('wallet')}
              className="min-h-[38px] px-3 rounded-xl bg-[#111728] hover:bg-[#172038] border border-amber-400/30 flex items-center gap-2 transition-colors"
              title="شحن العملات"
            >
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-mono tabular-nums text-xs sm:text-sm font-black text-amber-300">
                {currentUser.coins.toLocaleString('en-US')}
              </span>
              <span className="w-5 h-5 rounded-md bg-amber-400 text-slate-950 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/14 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Switcher: Store vs Backpack */}
        <div className="px-4 sm:px-6 py-3 bg-[#090d19] border-b border-white/8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#050811] border border-white/10 w-full sm:w-auto sm:min-w-[320px]">
            <button
              type="button"
              onClick={() => {
                setSection('store');
                setTryOnFrame(null);
              }}
              className={`min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all ${
                section === 'store'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span>المتجر ({storeItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSection('backpack');
                setTryOnFrame(null);
              }}
              className={`min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all ${
                section === 'backpack'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Backpack className="w-4 h-4 shrink-0" />
              <span>الحقيبة ({totalOwnedWearablesCount + totalBagGiftsCount})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <span>المقتنيات المملوكة:</span>
            <strong className="font-mono tabular-nums text-white">{totalOwnedWearablesCount}</strong>
            <span>·</span>
            <span>هدايا الحقيبة:</span>
            <strong className="font-mono tabular-nums text-emerald-400">{totalBagGiftsCount}</strong>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Action Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs font-bold ${
                feedback.tone === 'success'
                  ? 'bg-emerald-500/12 border-emerald-400/40 text-emerald-200'
                  : feedback.tone === 'warning'
                  ? 'bg-amber-500/12 border-amber-400/40 text-amber-200'
                  : 'bg-sky-500/12 border-sky-400/40 text-sky-200'
              }`}
            >
              <span>{feedback.message}</span>
              {feedback.jumpToBagTab && (
                <button
                  type="button"
                  onClick={() => {
                    setBackpackTab(feedback.jumpToBagTab!);
                    setSection('backpack');
                    setFeedback(null);
                  }}
                  className="min-h-[34px] px-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <span>فتح الحقيبة للارتداء</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Live Avatar Showcase & Active Loadout Strip */}
          <div className="p-4 rounded-2xl bg-[#111728] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-right w-full md:w-auto">
              <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                <div
                  className={
                    displayedShowcaseFrame?.previewUrl
                      ? 'w-12 h-12 rounded-full overflow-hidden'
                      : `w-14 h-14 rounded-full overflow-hidden p-0.5 border-2 ${
                          displayedShowcaseFrame ? 'border-amber-400' : 'border-white/15'
                        }`
                  }
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
                {displayedShowcaseFrame?.previewUrl && (
                  <img
                    src={displayedShowcaseFrame.previewUrl}
                    alt={displayedShowcaseFrame.nameAr}
                    referrerPolicy="no-referrer"
                    className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[78px] h-[78px] object-contain z-20"
                  />
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <div className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                  <span className="truncate">{currentUser.displayName}</span>
                  <span className="text-xs font-mono text-amber-300">
                    VIP {currentUser.vipLevel}
                  </span>
                  {section === 'store' && tryOnFrame && (
                    <span className="text-[11px] text-sky-300 font-bold">
                      · معاينة مباشرة: {tryOnFrame.nameAr}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {equippedFrame ? `الإطار: ${equippedFrame.nameAr}` : 'بدون إطار'} ·{' '}
                  {equippedEntrance ? `الدخولية: ${equippedEntrance.nameAr}` : 'بدون دخولية'} ·{' '}
                  حظ الهدايا <strong className="text-emerald-400 font-mono">{luckyConfig.winRatePercent}%</strong>
                </div>

                {/* Quick Unequip Controls */}
                {section === 'store' && tryOnFrame ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setTryOnFrame(null)}
                      className="text-[11px] font-bold text-slate-300 hover:text-white underline underline-offset-4"
                    >
                      إنهاء معاينة الإطار والعودة لمظهري الحالي
                    </button>
                  </div>
                ) : (
                  (currentUser.activeFrameId ||
                    currentUser.activeEntranceId ||
                    currentUser.activeBadgeId ||
                    currentUser.activeBubbleId ||
                    (currentUser.vipLevel >= 1 && currentUser.activeEntranceId !== '')) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {currentUser.activeFrameId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnequipItem('frame', equippedFrame?.nameAr || 'الإطار')
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-[11px] font-bold transition-colors"
                        >
                          إزالة الإطار
                        </button>
                      )}
                      {(currentUser.activeEntranceId ||
                        (currentUser.vipLevel >= 1 && currentUser.activeEntranceId !== '')) && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnequipItem('entrance', equippedEntrance?.nameAr || 'الدخولية')
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-[11px] font-bold transition-colors"
                        >
                          إزالة الدخولية
                        </button>
                      )}
                      {currentUser.activeBadgeId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnequipItem('badge', equippedBadge?.nameAr || 'الوسام')
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-[11px] font-bold transition-colors"
                        >
                          إزالة الوسام
                        </button>
                      )}
                      {currentUser.activeBubbleId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnequipItem('bubble', equippedBubble?.nameAr || 'الفقاعة')
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-[11px] font-bold transition-colors"
                        >
                          إزالة الفقاعة
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            {section === 'store' ? (
              <button
                type="button"
                onClick={() => setSection('backpack')}
                className="min-h-[40px] px-4 rounded-xl bg-white/6 hover:bg-white/12 border border-white/12 text-xs font-bold text-slate-200 flex items-center gap-2 shrink-0 w-full md:w-auto justify-center transition-colors"
              >
                <Backpack className="w-4 h-4 text-amber-400" />
                <span>عرض مقتنياتي في الحقيبة ({totalOwnedWearablesCount})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSection('store')}
                className="min-h-[40px] px-4 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-xs font-black text-amber-300 flex items-center gap-2 shrink-0 w-full md:w-auto justify-center transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>شراء عناصر جديدة من المتجر</span>
              </button>
            )}
          </div>

          {/* ========================================================== */}
          {/* SECTION 1: PROFESSIONAL BOUTIQUE STORE                     */}
          {/* ========================================================== */}
          {section === 'store' && (
            <div className="space-y-4">
              {/* Store Filters, Search & Sort Toolbar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Category Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
                  {[
                    { id: 'all', label: `الكل (${storeItems.length})` },
                    { id: 'frame', label: `إطارات الصور (${frames.length})` },
                    { id: 'entrance', label: `دخوليات الغرف (${entrances.length})` },
                    { id: 'badge', label: `الأوسمة (${badges.length})` },
                    { id: 'bubble', label: `فقاعات الدردشة (${bubbles.length})` },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setStoreCategory(cat.id as typeof storeCategory)}
                      className={`min-h-[38px] px-3.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                        storeCategory === cat.id
                          ? 'bg-amber-400 text-slate-950 shadow'
                          : 'bg-[#111728] text-slate-300 hover:text-white border border-white/8'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Search & Price Sort */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث في المتجر..."
                      className="w-full min-h-[38px] rounded-xl bg-[#111728] border border-white/10 pr-8 pl-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as SortMode)}
                      aria-label="ترتيب المنتجات"
                      className="min-h-[38px] rounded-xl bg-[#111728] border border-white/10 pr-8 pl-3 text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
                    >
                      <option value="default">الترتيب الافتراضي</option>
                      <option value="price_asc">الأقل سعراً</option>
                      <option value="price_desc">الأعلى سعراً</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Store Product Grid */}
              {filteredStoreItems.length === 0 ? (
                <div className="py-12 px-6 rounded-3xl bg-[#0d1220] border border-white/8 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-300">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h4 className="text-sm font-black text-white">
                      {storeItems.length === 0
                        ? 'المتجر جاهز لإضافة عناصر جديدة'
                        : 'لا توجد نتائج مطابقة للبحث'}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {storeItems.length === 0
                        ? 'ارفع الإطارات أو الدخوليات أو الأوسمة أو الفقاعات من لوحة تحكم المدير لتظهر هنا فوراً بشكل احترافي وجاهز للشراء.'
                        : 'جرّب تغيير كلمة البحث أو استعراض كل الأقسام.'}
                    </p>
                  </div>
                  {storeItems.length === 0 && isAdminAccount && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setCurrentView('admin_dashboard');
                      }}
                      className="min-h-[42px] px-5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs inline-flex items-center gap-2 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      <span>فتح لوحة المدير لإضافة عناصر للمتجر</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStoreItems.map((item) => {
                    const owned = isStoreItemOwned(item.id);
                    const remainingDays = owned ? getRemainingDays(item.id) : 0;
                    const canAfford = currentUser.coins >= item.priceCoins;
                    const isPreviewingFrame = tryOnFrame?.id === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border overflow-hidden flex flex-col justify-between transition-all ${
                          owned
                            ? 'bg-[#12192c] border-emerald-400/35'
                            : isPreviewingFrame
                            ? 'bg-[#131b30] border-amber-400/65 shadow-lg shadow-amber-500/10'
                            : 'bg-[#111726] border-white/10 hover:border-amber-400/35'
                        }`}
                      >
                        {/* Image-led Boutique Stage (~60% visual weight) */}
                        <div
                          className="relative h-40 flex items-center justify-center overflow-hidden border-b border-white/8"
                          style={{
                            background:
                              'radial-gradient(circle at 50% 42%, rgba(245, 158, 11, 0.13), rgba(7, 10, 18, 0.96) 75%)',
                          }}
                        >
                          {renderItemArtwork(item)}

                          {/* Live Preview Action */}
                          {item.type === 'entrance' && (item.videoUrl || item.previewUrl) ? (
                            <button
                              type="button"
                              onClick={() => setPreviewEntrance(item)}
                              className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/75 hover:bg-black border border-white/15 text-[11px] font-bold text-amber-300 flex items-center gap-1 transition-colors"
                            >
                              <Play className="w-3 h-3" />
                              <span>معاينة</span>
                            </button>
                          ) : item.type === 'frame' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setTryOnFrame((prev) => (prev?.id === item.id ? null : item))
                              }
                              className={`absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors ${
                                isPreviewingFrame
                                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                                  : 'bg-black/75 hover:bg-black text-slate-200 border-white/15'
                              }`}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isPreviewingFrame ? 'قيد المعاينة' : 'تجربة'}</span>
                            </button>
                          ) : null}

                          {owned && (
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-black/75 px-2.5 py-1 rounded-lg border border-emerald-400/35">
                              <Check className="w-3.5 h-3.5" />
                              <span>في الحقيبة</span>
                            </div>
                          )}
                        </div>

                        {/* Clean Unboxed Metadata & Purchase Controls */}
                        <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                          <div className="space-y-1 text-right">
                            <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                              <span>
                                {TYPE_LABELS[item.type]} · {item.durationDays} يوم
                              </span>
                              {owned && (
                                <span className="font-mono tabular-nums text-emerald-300">
                                  متبقي {remainingDays} يوم
                                </span>
                              )}
                            </div>
                            <h4 className="font-black text-sm text-white truncate">
                              {item.nameAr}
                            </h4>
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {item.descriptionAr}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/8 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 font-mono tabular-nums font-black text-sm text-amber-300">
                                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>{item.priceCoins.toLocaleString('en-US')}</span>
                                <span className="text-[11px] font-tajawal font-semibold text-amber-300/80">
                                  عملة
                                </span>
                              </div>
                              {!canAfford && !owned && (
                                <span className="text-[11px] font-bold text-rose-300">
                                  رصيد غير كافٍ
                                </span>
                              )}
                            </div>

                            {owned ? (
                              <div className="grid grid-cols-12 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBackpackTab(TYPE_TO_BAG_TAB[item.type]);
                                    setSection('backpack');
                                  }}
                                  className="col-span-8 min-h-[40px] rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <Backpack className="w-3.5 h-3.5" />
                                  <span>الارتداء من الحقيبة</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleBuyStoreItem(item)}
                                  title={`تمديد +${item.durationDays} يوم`}
                                  className="col-span-4 min-h-[40px] rounded-xl bg-white/8 hover:bg-white/14 border border-white/12 text-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>تمديد</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleBuyStoreItem(item)}
                                className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:brightness-105 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/15 transition-all"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>شراء ونقل للحقيبة</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* SECTION 2: BACKPACK (STRICTLY OWNED ITEMS + LUCKY GIFTS)   */}
          {/* ========================================================== */}
          {section === 'backpack' && (
            <div className="space-y-4">
              {/* Backpack Category Sub-Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-xs">
                {[
                  { id: 'frames', label: `إطاراتي (${ownedFrames.length})` },
                  { id: 'entrances', label: `دخولياتي (${ownedEntrances.length})` },
                  { id: 'badges', label: `أوسمتي (${ownedBadges.length})` },
                  { id: 'bubbles', label: `فقاعاتي (${ownedBubbles.length})` },
                  { id: 'lucky_bag', label: `هدايا الحظ والحقيبة (${totalBagGiftsCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBackpackTab(tab.id as BackpackCategory)}
                    className={`min-h-[38px] px-3.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      backpackTab === tab.id
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'bg-[#111728] text-slate-300 hover:text-white border border-white/8'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Owned Frames */}
              {backpackTab === 'frames' &&
                renderOwnedCategoryGrid(
                  ownedFrames,
                  'لا تملك أي إطارات في حقيبتك حالياً',
                  'اشترِ إطار الصورة المفضل لديك من المتجر لينتقل فوراً إلى حقيبتك، وبعدها يمكنك ارتداؤه وإزالته في أي وقت.',
                  'frame'
                )}

              {/* Owned Entrances */}
              {backpackTab === 'entrances' && (
                <div className="space-y-4">
                  {currentUser.vipLevel >= 1 &&
                    currentUser.activeEntranceId !== '' &&
                    !ownedEntrances.some((e) => e.id === currentUser.activeEntranceId) && (
                      <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-400/35 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="text-cyan-100 font-semibold">
                          تعمل حالياً دخولية VIP {currentUser.vipLevel} الافتراضية عند دخولك الغرف.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUnequipItem('entrance', 'الدخولية الافتراضية')}
                          className="min-h-[34px] px-3.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold transition-colors"
                        >
                          إزالة الدخولية
                        </button>
                      </div>
                    )}

                  {renderOwnedCategoryGrid(
                    ownedEntrances,
                    'لا تملك أي دخوليات في حقيبتك حالياً',
                    'اشترِ دخولية غرفة ملكية من المتجر لتنتقل إلى حقيبتك وتتحكم في ارتدائها وإزالتها.',
                    'entrance'
                  )}
                </div>
              )}

              {/* Owned Badges */}
              {backpackTab === 'badges' &&
                renderOwnedCategoryGrid(
                  ownedBadges,
                  'لا تملك أي أوسمة في حقيبتك حالياً',
                  'اشترِ الأوسمة الملكية من المتجر لتظهر في حقيبتك وتتمكن من ارتدائها وإزالتها.',
                  'badge'
                )}

              {/* Owned Bubbles */}
              {backpackTab === 'bubbles' &&
                renderOwnedCategoryGrid(
                  ownedBubbles,
                  'لا تملك أي فقاعات دردشة في حقيبتك حالياً',
                  'اشترِ فقاعات الدردشة المميزة من المتجر لتنتقل إلى حقيبتك وتستخدمها في الغرف.',
                  'bubble'
                )}

              {/* Lucky & Bag Gifts */}
              {backpackTab === 'lucky_bag' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-300">
                      هدايا الحظ والهدايا المخزنة في حقيبتك — أرسلها داخل أي غرفة لربح مضاعفات الكوينزات:
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[1, 5, 10, 25].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setSelectedBagCount(qty)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                            selectedBagCount === qty
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-white/8 text-slate-300 hover:bg-white/14'
                          }`}
                        >
                          ×{qty}
                        </button>
                      ))}
                    </div>
                  </div>

                  {ownedBagGiftEntries.length === 0 ? (
                    <div className="p-10 rounded-3xl bg-[#0d1220] border border-white/8 text-center space-y-3">
                      <div className="text-4xl">🎒</div>
                      <p className="text-xs text-slate-300">
                        لا توجد هدايا في حقيبتك حالياً — يمكنك الحصول عليها من صاروخ الغرفة أو كيس الحظ.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {ownedBagGiftEntries.map(({ gift, count }) => {
                        const isLucky = gift.isLucky || gift.category === 'lucky';
                        return (
                          <div
                            key={gift.id}
                            className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                              isLucky
                                ? 'bg-gradient-to-br from-[#231229] to-[#121626] border-pink-400/35'
                                : 'bg-[#111726] border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {gift.imageUrl ? (
                                  <img
                                    src={gift.imageUrl}
                                    alt={gift.nameAr}
                                    referrerPolicy="no-referrer"
                                    className="w-12 h-12 rounded-xl object-cover border border-white/15 shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-xl bg-white/8 flex items-center justify-center text-3xl shrink-0">
                                    {gift.icon}
                                  </div>
                                )}
                                <div className="min-w-0 text-right">
                                  <div className="text-sm font-bold text-white truncate">
                                    {gift.nameAr}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    {isLucky && (
                                      <span className="text-pink-300 font-semibold flex items-center gap-0.5">
                                        <Sparkles className="w-3 h-3" />
                                        هدية حظ
                                      </span>
                                    )}
                                    {(gift.videoUrl || gift.imageUrl) && (
                                      <span className="text-rose-300 font-mono flex items-center gap-0.5">
                                        <Video className="w-3 h-3" />{' '}
                                        {getMediaFormatLabel(gift.videoUrl || gift.imageUrl)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <span className="font-mono tabular-nums text-xs font-black text-emerald-400 shrink-0">
                                ×{count}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              {gift.descriptionAr}
                            </p>

                            <button
                              type="button"
                              onClick={() => handleUseBagGiftInRoom(gift.id, count)}
                              className="w-full min-h-[40px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors"
                            >
                              {activeRoom ? (
                                <>
                                  <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                                  <span>إرسال ×{Math.min(count, selectedBagCount)} في الغرفة</span>
                                </>
                              ) : (
                                <>
                                  <Radio className="w-3.5 h-3.5" />
                                  <span>دخول الغرفة لاستخدام الهدية</span>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Store Entrance Effect Preview Overlay */}
      {previewEntrance && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewEntrance(null);
          }}
        >
          <div
            className="relative w-full max-w-sm aspect-[9/16] max-h-[82dvh] rounded-3xl overflow-hidden bg-[#0a0e1a] border border-amber-400/50 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewEntrance(null)}
              aria-label="إغلاق المعاينة"
              className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/65 text-white flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
            {(() => {
              const resolved = resolveEntranceStageMedia(previewEntrance);
              if (resolved.primaryUrl) {
                return (
                  <SmartMediaView
                    mode="stage"
                    url={resolved.primaryUrl}
                    fallbackUrl={previewEntrance.previewUrl}
                    preferVideo={resolved.preferVideo}
                    alt={previewEntrance.nameAr}
                    loop
                  />
                );
              }
              return <span className="text-7xl animate-bounce">{previewEntrance.icon}</span>;
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
                <div className="text-slate-200">{previewEntrance.nameAr}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
