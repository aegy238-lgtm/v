import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic,
  MicOff,
  Smile,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Power,
  Minus,
  ChevronLeft,
  Trophy,
  Check,
  Gift,
  Copy,
  SlidersHorizontal,
  LayoutGrid,
  Send,
  Crown,
  Users,
  Gamepad2,
  Rocket,
  Coins,
  X,
  Megaphone,
  Heart,
  Trash2,
} from 'lucide-react';
import { RoomSeat, GiftItem } from '../types';
import { InteractiveGamesHub } from './InteractiveGamesHub';

// Bespoke generated room wallpapers (Zero external URL dependencies)
const ROOM_THEMES = [
  {
    id: 'midnight',
    name: 'الصالة الليلية',
    image: '/src/assets/images/room_bg_midnight_lounge_1795294231147.jpg',
    fallbackGradient: 'from-[#0b1021] via-[#10182f] to-[#080b14]',
  },
  {
    id: 'majlis',
    name: 'المجلس الملكي',
    image: '/src/assets/images/room_bg_royal_majlis_1795294234181.jpg',
    fallbackGradient: 'from-[#17120c] via-[#1c150e] to-[#0c0907]',
  },
  {
    id: 'starlight',
    name: 'سماء الليل',
    image: '/src/assets/images/room_bg_starlight_sky_1795294232054.jpg',
    fallbackGradient: 'from-[#0a1026] via-[#141c3a] to-[#080c18]',
  },
] as const;

interface GiftComboTrackItem {
  id: string;
  key: string; // senderId + giftId + targetLabel for merging combos
  senderName: string;
  senderAvatar: string;
  targetNames: string;
  giftName: string;
  giftIcon: string;
  countPerHit: number;
  comboHits: number;
  isLucky?: boolean;
  luckyMultiplier?: number;
  luckyWinCoins?: number;
  updatedAt: number;
}

interface SubtleGiftGlide {
  id: string;
  seatIndex: number;
  giftIcon: string;
  targetX: number;
  targetY: number;
  phase: 'start' | 'flying';
}

interface LuxuryTopNotice {
  id: string;
  senderName: string;
  targetNames: string;
  giftName: string;
  giftIcon: string;
  count: number;
}

interface ComboState {
  active: boolean;
  gift: GiftItem;
  count: number;
  targetSeats: number[];
  comboHits: number;
  timeLeftMs: number; // 2000ms down to 0
  fromBag?: boolean;
}

interface ActiveLuckyBagState {
  id: string;
  tierName: string;
  senderName: string;
  totalCoinsPool: number;
  rewardGifts: { giftId: string; nameAr: string; icon: string; count: number }[];
  timeLeftMs: number; // 10000ms (10 seconds) down to 0
  claimedByMe: boolean;
}

interface RoomEventLog {
  id: string;
  type: 'lucky_win' | 'gift_throw' | 'game_win' | 'rocket_explosion' | 'lucky_bag_claim';
  senderName: string;
  vipLevel: number;
  level: number;
  targetNames: string;
  giftName: string;
  giftIcon: string;
  giftCount: number;
  comboHits: number;
  winCoins?: number;
  multiplier?: number;
  time: string;
}

interface RocketTierConfig {
  level: number;
  nameAr: string;
  icon: string;
  targetCoins: number;
  rewardCoins: number;
  rewardBagGifts: { giftId: string; count: number }[];
  accent: string;
}

const ROCKET_TIERS: RocketTierConfig[] = [
  {
    level: 1,
    nameAr: 'صاروخ الفضة',
    icon: '🚀',
    targetCoins: 10000,
    rewardCoins: 5000,
    rewardBagGifts: [
      { giftId: 'gift_lollipop_lucky', count: 10 },
      { giftId: 'gift_rose', count: 15 },
      { giftId: 'gift_coffee', count: 5 },
    ],
    accent: 'from-sky-400 to-indigo-500',
  },
  {
    level: 2,
    nameAr: 'صاروخ الذهب',
    icon: '🛸',
    targetCoins: 25000,
    rewardCoins: 15000,
    rewardBagGifts: [
      { giftId: 'gift_lollipop_lucky', count: 25 },
      { giftId: 'gift_pink_perfume', count: 5 },
      { giftId: 'gift_heart', count: 8 },
    ],
    accent: 'from-amber-400 to-orange-500',
  },
  {
    level: 3,
    nameAr: 'صاروخ الألماس',
    icon: '☄️',
    targetCoins: 50000,
    rewardCoins: 35000,
    rewardBagGifts: [
      { giftId: 'gift_halloween_candy', count: 5 },
      { giftId: 'gift_car', count: 2 },
      { giftId: 'gift_teddy', count: 6 },
    ],
    accent: 'from-violet-400 to-indigo-600',
  },
  {
    level: 4,
    nameAr: 'صاروخ المجرة',
    icon: '🌌',
    targetCoins: 100000,
    rewardCoins: 75000,
    rewardBagGifts: [
      { giftId: 'gift_yacht', count: 2 },
      { giftId: 'gift_helicopter', count: 1 },
      { giftId: 'gift_treat_or_trick', count: 2 },
    ],
    accent: 'from-rose-400 to-purple-600',
  },
  {
    level: 5,
    nameAr: 'الصاروخ الإمبراطوري',
    icon: '👑',
    targetCoins: 250000,
    rewardCoins: 200000,
    rewardBagGifts: [
      { giftId: 'gift_dragon', count: 2 },
      { giftId: 'gift_palace', count: 2 },
      { giftId: 'gift_scorpion', count: 1 },
    ],
    accent: 'from-amber-300 to-red-600',
  },
];

export const VoiceRoomView: React.FC = () => {
  const {
    activeRoom,
    currentUser,
    leaveRoom,
    takeSeat,
    leaveSeat,
    toggleMic,
    toggleSeatLock,
    activeRoomMessages,
    sendRoomMessage,
    sendGift,
    rechargeCoins,
    gifts,
    users,
    setActiveModal,
    setViewingProfileUser,
  } = useApp();

  // Bottom Drawers & Sheets
  const [activeBottomDrawer, setActiveBottomDrawer] = useState<
    | 'none'
    | 'emoji'
    | 'gift'
    | 'game_center'
    | 'seat_menu'
    | 'top_ranking'
    | 'rocket'
    | 'lucky_bag_drawer'
    | 'tools_menu'
    | 'room_settings'
  >('none');
  const [selectedSeatForMenu, setSelectedSeatForMenu] = useState<RoomSeat | null>(null);

  // Room Theme & Settings State
  const [themeId, setThemeId] = useState<(typeof ROOM_THEMES)[number]['id']>('midnight');
  const [roomNotice, setRoomNotice] = useState<string>(
    activeRoom?.announcement || 'أهلاً بكم في الغرفة الصوتية — نرجو الالتزام بالأدب والاحترام.'
  );
  const [noticeDraft, setNoticeDraft] = useState<string>(roomNotice);
  const [isRoomSoundMuted, setIsRoomSoundMuted] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [chatClearedBeforeTs, setChatClearedBeforeTs] = useState<number>(0);

  // Chat state
  const [chatTab, setChatTab] = useState<'all' | 'message' | 'gifts' | 'system'>('all');
  const [chatInput, setChatInput] = useState('');
  const [showChatInputBar, setShowChatInputBar] = useState(false);

  // =========================================================================
  // AUTHENTIC VOICE APP GIFT DELIVERY (Stacked Side Banners + Subtle Glide)
  // Zero stars, zero confetti spam, zero full-screen blocking clutter!
  // =========================================================================
  const [giftComboTrack, setGiftComboTrack] = useState<GiftComboTrackItem[]>([]);
  const [subtleGlides, setSubtleGlides] = useState<SubtleGiftGlide[]>([]);
  const [seatPulseMap, setSeatPulseMap] = useState<Record<number, { icon: string; count: number }>>(
    {}
  );
  const [luxuryNotice, setLuxuryNotice] = useState<LuxuryTopNotice | null>(null);

  // 2-Second Quick Combo Button
  const [comboState, setComboState] = useState<ComboState | null>(null);

  // 10-Second Room Lucky Bag
  const [activeLuckyBag, setActiveLuckyBag] = useState<ActiveLuckyBagState | null>(null);
  const [luckyBagRewardToast, setLuckyBagRewardToast] = useState<{
    coinsWon: number;
    giftsWon: { nameAr: string; icon: string; count: number }[];
  } | null>(null);

  // Room Rocket System (Charged ONLY by coins spent on gifts + 24h Lock after Lv.5)
  const roomRocketStorageKey = `auravoice_rocket_v3_${activeRoom?.id || 'default'}`;

  const [rocketLevel, setRocketLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(roomRocketStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cooldownUntil && Date.now() >= parsed.cooldownUntil) return 1;
        return parsed.level || 1;
      }
    } catch {
      // ignore
    }
    return 1;
  });

  const [previewRocketLevel, setPreviewRocketLevel] = useState<number>(rocketLevel);

  const [rocketCurrentSupport, setRocketCurrentSupport] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(roomRocketStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cooldownUntil && Date.now() >= parsed.cooldownUntil) return 0;
        return parsed.support || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [rocketCooldownUntil, setRocketCooldownUntil] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(roomRocketStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cooldownUntil && Date.now() < parsed.cooldownUntil) {
          return parsed.cooldownUntil;
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [rocketRewardPopup, setRocketRewardPopup] = useState<{
    level: number;
    nameAr: string;
    coinsWon: number;
    giftsWon: { nameAr: string; icon: string; count: number }[];
  } | null>(null);

  // User's Bag Gifts inside Gift Drawer ("الحقيبة")
  const [bagGifts, setBagGifts] = useState<Record<string, number>>({});

  // Room Event Logs
  const [roomEventLogs, setRoomEventLogs] = useState<RoomEventLog[]>([]);

  // Gift Drawer State
  const [giftDrawerTab, setGiftDrawerTab] = useState<
    'all' | 'classic' | 'luxury' | 'lucky' | 'bag'
  >('all');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('gift_rose');
  const [giftCount, setGiftCount] = useState<number>(1);
  const [selectedRecipientSeats, setSelectedRecipientSeats] = useState<number[]>([]);

  // Emoji State
  const [emojiCategory, setEmojiCategory] = useState<'faces' | 'gestures' | 'hearts' | 'fun'>(
    'faces'
  );
  const [seatEmojis, setSeatEmojis] = useState<Record<number, string>>({});

  // Local seat heart overrides for "مسح النقاط"
  const [seatHeartsOverride, setSeatHeartsOverride] = useState<Record<number, number>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const luxuryTimeoutRef = useRef<number | null>(null);

  // Sync room notice when room changes
  useEffect(() => {
    if (activeRoom?.announcement) {
      setRoomNotice(activeRoom.announcement);
      setNoticeDraft(activeRoom.announcement);
    }
  }, [activeRoom?.id]);

  // Auto-prune Gift Combo Track items after 3.2s of inactivity
  useEffect(() => {
    if (giftComboTrack.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setGiftComboTrack((prev) => prev.filter((item) => now - item.updatedAt < 3200));
    }, 300);
    return () => clearInterval(timer);
  }, [giftComboTrack.length]);

  // 10-Second Lucky Bag Countdown Timer
  useEffect(() => {
    if (!activeLuckyBag) return;
    const interval = window.setInterval(() => {
      setActiveLuckyBag((prev) => {
        if (!prev) return null;
        if (prev.timeLeftMs <= 100) return null;
        return { ...prev, timeLeftMs: prev.timeLeftMs - 100 };
      });
    }, 100);
    return () => clearInterval(interval);
  }, [Boolean(activeLuckyBag)]);

  // 2-Second Combo Button Countdown Timer
  useEffect(() => {
    if (!comboState?.active) return;
    const interval = window.setInterval(() => {
      setComboState((prev) => {
        if (!prev) return null;
        if (prev.timeLeftMs <= 50) return null;
        return { ...prev, timeLeftMs: prev.timeLeftMs - 50 };
      });
    }, 50);
    return () => clearInterval(interval);
  }, [comboState?.active]);

  // Sync Rocket state to localStorage per room
  useEffect(() => {
    try {
      localStorage.setItem(
        roomRocketStorageKey,
        JSON.stringify({
          level: rocketLevel,
          support: rocketCurrentSupport,
          cooldownUntil: rocketCooldownUntil,
        })
      );
    } catch {
      // ignore
    }
  }, [roomRocketStorageKey, rocketLevel, rocketCurrentSupport, rocketCooldownUntil]);

  // Live 1-second timer for 24-hour Rocket cooldown
  useEffect(() => {
    if (!rocketCooldownUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (current >= rocketCooldownUntil) {
        setRocketCooldownUntil(null);
        setRocketLevel(1);
        setPreviewRocketLevel(1);
        setRocketCurrentSupport(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [rocketCooldownUntil]);

  // Auto-scroll room chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomEventLogs.length, activeRoomMessages.length]);

  // Keep selected gift recipients & active combo strictly synced to OCCUPIED mics only
  const occupiedIndicesKey = (activeRoom?.seats || [])
    .slice(0, 8)
    .filter((s) => Boolean(s.userId))
    .map((s) => s.index)
    .join(',');

  useEffect(() => {
    const occupiedList = occupiedIndicesKey
      ? occupiedIndicesKey.split(',').map((n) => Number(n))
      : [];
    const occupiedSet = new Set(occupiedList);

    setSelectedRecipientSeats((prev) => {
      const stillValid = prev.filter((idx) => occupiedSet.has(idx));
      if (stillValid.length > 0) return stillValid;
      return occupiedList.length > 0 ? [occupiedList[0]] : [];
    });

    setComboState((prev) => {
      if (!prev) return null;
      const validTargets = prev.targetSeats.filter((idx) => occupiedSet.has(idx));
      if (validTargets.length === 0) return null;
      return { ...prev, targetSeats: validTargets };
    });
  }, [occupiedIndicesKey]);

  if (!activeRoom) return null;

  const activeTheme = ROOM_THEMES.find((t) => t.id === themeId) || ROOM_THEMES[0];

  const isRocketLocked24h = Boolean(rocketCooldownUntil && rocketCooldownUntil > nowMs);
  const rocketCooldownRemainingMs = isRocketLocked24h
    ? Math.max(0, (rocketCooldownUntil || 0) - nowMs)
    : 0;

  const formatCooldownHMS = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  };

  const currentRocketTier =
    ROCKET_TIERS.find((t) => t.level === rocketLevel) || ROCKET_TIERS[0];
  const previewRocketTier =
    ROCKET_TIERS.find((t) => t.level === previewRocketLevel) || currentRocketTier;
  const rocketProgressPercent = isRocketLocked24h
    ? 100
    : Math.min(100, Math.round((rocketCurrentSupport / currentRocketTier.targetCoins) * 100));

  // Strictly 8 Mics (2 rows of 4)
  const seats8: RoomSeat[] = Array.from({ length: 8 }, (_, idx) => {
    const existing = activeRoom.seats[idx];
    if (existing) return existing;
    return {
      index: idx,
      userId: null,
      heartPoints: 0,
      isMuted: false,
      isLocked: false,
      isReserved: false,
      isSpeaking: false,
      audioLevel: 0,
    };
  });

  const occupiedSeats = seats8.filter((s) => Boolean(s.userId));
  const mySeat = seats8.find((s) => s.userId === currentUser.id);
  const totalBagCount = Object.values(bagGifts).reduce((a, b) => a + b, 0);

  const openGiftDrawer = (preferredSeatIndex?: number) => {
    if (
      preferredSeatIndex !== undefined &&
      seats8[preferredSeatIndex] &&
      Boolean(seats8[preferredSeatIndex].userId)
    ) {
      setSelectedRecipientSeats([preferredSeatIndex]);
    } else {
      setSelectedRecipientSeats((prev) => {
        const stillOccupied = prev.filter((idx) => Boolean(seats8[idx]?.userId));
        if (stillOccupied.length > 0) return stillOccupied;
        return occupiedSeats.length > 0 ? [occupiedSeats[0].index] : [];
      });
    }
    setActiveBottomDrawer('gift');
  };

  const formatScore = (val: number) => {
    if (val === 0) return '0';
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  const getTargetNamesLabel = (seatIndices: number[]) => {
    const valid = seatIndices.filter((i) => i >= 0 && i < 8 && Boolean(seats8[i]?.userId));
    if (valid.length === 0) return '';
    if (occupiedSeats.length > 1 && valid.length === occupiedSeats.length) {
      return 'جميع المتحدثين';
    }
    const names = valid.map((idx) => seats8[idx]?.userName || `مايك ${idx + 1}`);
    return names.length <= 2 ? names.join('، ') : `${names[0]} +${names.length - 1}`;
  };

  // Exact % screen coordinates for the 4x2 RTL 8-mic grid
  const getSeatCoords = (seatIndex: number) => {
    const row = Math.floor(seatIndex / 4); // 0 or 1
    const col = seatIndex % 4; // 0..3 (RTL: col 0 is rightmost, col 3 is leftmost)
    const targetX = 83 - col * 22; // 83%, 61%, 39%, 17%
    const targetY = 24 + row * 15; // 24% top row, 39% bottom row
    return { targetX, targetY };
  };

  const handleCopyRoomId = () => {
    navigator.clipboard?.writeText(activeRoom.roomNo || '2026091');
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 1800);
  };

  // =========================================================================
  // LAUNCH 10-SECOND LUCKY BAG
  // =========================================================================
  const handleLaunchLuckyBag = (
    tierName: string,
    costCoins: number,
    rewardPoolCoins: number,
    giftRewards: { giftId: string; nameAr: string; icon: string; count: number }[]
  ) => {
    if (costCoins > 0 && currentUser.coins < costCoins) {
      setActiveBottomDrawer('none');
      setActiveModal('wallet');
      return;
    }

    if (costCoins > 0) {
      rechargeCoins(-costCoins, `إطلاق ${tierName} في الغرفة`);
      addSupportToRocket(costCoins);
    }

    setActiveBottomDrawer('none');
    setActiveLuckyBag({
      id: `lbag_${Date.now()}`,
      tierName,
      senderName: currentUser.displayName,
      totalCoinsPool: rewardPoolCoins,
      rewardGifts: giftRewards,
      timeLeftMs: 10000,
      claimedByMe: false,
    });
  };

  const handleClaimLuckyBag = () => {
    if (!activeLuckyBag || activeLuckyBag.claimedByMe) return;

    const wonCoins = activeLuckyBag.totalCoinsPool;
    const wonGifts = activeLuckyBag.rewardGifts;

    setActiveLuckyBag(null);
    rechargeCoins(wonCoins, `استلام ${activeLuckyBag.tierName}`);

    setBagGifts((prev) => {
      const next = { ...prev };
      wonGifts.forEach((g) => {
        next[g.giftId] = (next[g.giftId] || 0) + g.count;
      });
      return next;
    });

    setLuckyBagRewardToast({
      coinsWon: wonCoins,
      giftsWon: wonGifts.map((g) => ({ nameAr: g.nameAr, icon: g.icon, count: g.count })),
    });

    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setRoomEventLogs((prev) => [
      ...prev.slice(-30),
      {
        id: `log_lbag_${Date.now()}`,
        type: 'lucky_bag_claim',
        senderName: currentUser.displayName,
        vipLevel: currentUser.vipLevel,
        level: currentUser.level,
        targetNames: activeLuckyBag.tierName,
        giftName: wonGifts.map((g) => `${g.nameAr} ×${g.count}`).join(' · '),
        giftIcon: '🧧',
        giftCount: 1,
        comboHits: 1,
        winCoins: wonCoins,
        time: nowTime,
      },
    ]);
  };

  // =========================================================================
  // ROOM ROCKET COMPLETION & 24-HOUR COOLDOWN
  // =========================================================================
  const completeRocketTier = (tierToComplete: RocketTierConfig, carryOverCoins = 0) => {
    rechargeCoins(tierToComplete.rewardCoins, `مكافأة ${tierToComplete.nameAr}`);

    const wonGiftsSummary: { nameAr: string; icon: string; count: number }[] = [];
    setBagGifts((prevBag) => {
      const nextBag = { ...prevBag };
      tierToComplete.rewardBagGifts.forEach((rg) => {
        nextBag[rg.giftId] = (nextBag[rg.giftId] || 0) + rg.count;
        const giftMeta = gifts.find((g) => g.id === rg.giftId);
        if (giftMeta) {
          wonGiftsSummary.push({
            nameAr: giftMeta.nameAr,
            icon: giftMeta.icon,
            count: rg.count,
          });
        }
      });
      return nextBag;
    });

    setRocketRewardPopup({
      level: tierToComplete.level,
      nameAr: tierToComplete.nameAr,
      coinsWon: tierToComplete.rewardCoins,
      giftsWon: wonGiftsSummary,
    });

    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setRoomEventLogs((prev) => [
      ...prev.slice(-30),
      {
        id: `log_rocket_${Date.now()}`,
        type: 'rocket_explosion',
        senderName: currentUser.displayName,
        vipLevel: currentUser.vipLevel,
        level: currentUser.level,
        targetNames: 'الغرفة',
        giftName: tierToComplete.nameAr,
        giftIcon: tierToComplete.icon,
        giftCount: 1,
        comboHits: tierToComplete.level,
        winCoins: tierToComplete.rewardCoins,
        time: nowTime,
      },
    ]);

    if (tierToComplete.level >= 5) {
      const lockUntil = Date.now() + 24 * 60 * 60 * 1000;
      setNowMs(Date.now());
      setRocketCooldownUntil(lockUntil);
      setRocketLevel(5);
      setPreviewRocketLevel(5);
      setRocketCurrentSupport(tierToComplete.targetCoins);
    } else {
      const nextLvl = tierToComplete.level + 1;
      setRocketLevel(nextLvl);
      setPreviewRocketLevel(nextLvl);
      setRocketCurrentSupport(carryOverCoins);
    }
  };

  const addSupportToRocket = (supportCoins: number) => {
    if (supportCoins <= 0) return;
    if (rocketCooldownUntil && Date.now() < rocketCooldownUntil) return;

    setRocketCurrentSupport((prev) => {
      const nextVal = prev + supportCoins;
      if (nextVal >= currentRocketTier.targetCoins) {
        const excessCoins = Math.max(0, nextVal - currentRocketTier.targetCoins);
        setTimeout(() => {
          completeRocketTier(currentRocketTier, excessCoins);
        }, 250);
        return currentRocketTier.targetCoins;
      }
      return nextVal;
    });
  };

  // =========================================================================
  // SUBTLE GIFT GLIDE TO TARGET MIC (Clean & Realistic, Zero Screen Clutter)
  // =========================================================================
  const triggerSubtleGiftGlide = (gift: GiftItem, targetSeats: number[], count: number) => {
    const batchId = `glide_${Date.now()}_${Math.random()}`;
    const items: SubtleGiftGlide[] = targetSeats.map((seatIdx) => {
      const { targetX, targetY } = getSeatCoords(seatIdx);
      return {
        id: `${batchId}_${seatIdx}`,
        seatIndex: seatIdx,
        giftIcon: gift.icon,
        targetX,
        targetY,
        phase: 'start',
      };
    });

    setSubtleGlides((prev) => [...prev, ...items]);

    requestAnimationFrame(() => {
      setTimeout(() => {
        setSubtleGlides((prev) =>
          prev.map((p) => (p.id.startsWith(batchId) ? { ...p, phase: 'flying' } : p))
        );
      }, 20);
    });

    setTimeout(() => {
      setSubtleGlides((prev) => prev.filter((p) => !p.id.startsWith(batchId)));

      // Soft golden halo pulse on target seat(s)
      setSeatPulseMap((prev) => {
        const next = { ...prev };
        targetSeats.forEach((sIdx) => {
          next[sIdx] = { icon: gift.icon, count };
        });
        return next;
      });

      setTimeout(() => {
        setSeatPulseMap((prev) => {
          const copy = { ...prev };
          targetSeats.forEach((sIdx) => {
            delete copy[sIdx];
          });
          return copy;
        });
      }, 650);
    }, 460);
  };

  // =========================================================================
  // AUTHENTIC GIFT THROW HANDLER (Side Stacked Combo Track + Subtle Glide)
  // =========================================================================
  const executeGiftThrow = (
    gift: GiftItem,
    count: number,
    targetSeats: number[],
    comboHits: number,
    fromBag = false
  ) => {
    const finalTargets = targetSeats.filter((i) => i >= 0 && i < 8 && Boolean(seats8[i]?.userId));
    if (finalTargets.length === 0) return;
    const targetLabel = getTargetNamesLabel(finalTargets);
    const totalNeededCount = count * finalTargets.length;

    if (fromBag) {
      const ownedCount = bagGifts[gift.id] || 0;
      if (ownedCount <= 0) return;
      const deductCount = Math.min(ownedCount, totalNeededCount);
      setBagGifts((prev) => {
        const next = { ...prev };
        if (next[gift.id] <= deductCount) delete next[gift.id];
        else next[gift.id] -= deductCount;
        return next;
      });
    } else {
      const sentOk = sendGift(gift.id, count, 'seat', finalTargets[0], finalTargets);
      if (!sentOk) return;
    }

    // Clear any manual heart reset on targeted seats
    setSeatHeartsOverride((prev) => {
      const next = { ...prev };
      finalTargets.forEach((idx) => delete next[idx]);
      return next;
    });

    // Charge room rocket ONLY from coins spent on gifts
    const totalGiftValue = gift.coinPrice * count * finalTargets.length;
    if (!fromBag) {
      addSupportToRocket(totalGiftValue);
    }

    // 1. Subtle single gift glide to target mic(s)
    triggerSubtleGiftGlide(gift, finalTargets, count);

    const isLuckyGift =
      gift.isLucky || gift.category === 'lucky' || gift.animationType === 'lollipop_matrix';
    let luckyMult: number | undefined;
    let luckyWinCoins: number | undefined;

    if (isLuckyGift) {
      const multPool = comboHits >= 5 ? [10, 25, 66, 188] : [5, 10, 25, 66];
      luckyMult = multPool[Math.floor(Math.random() * multPool.length)];
      const rawWin = gift.coinPrice * luckyMult * count;
      luckyWinCoins = rawWin > 500000 ? 188000 : rawWin;
      rechargeCoins(luckyWinCoins, 'ربح هدية الحظ');
    }

    // 2. Push/Merge into Side Stacked Gift Combo Track (Max 2 clean banners, just like Yalla/TikTok Live)
    const trackKey = `${currentUser.id}_${gift.id}_${targetLabel}`;
    const now = Date.now();
    setGiftComboTrack((prev) => {
      const existingIdx = prev.findIndex((item) => item.key === trackKey);
      const updatedItem: GiftComboTrackItem = {
        id: `${trackKey}_${now}`,
        key: trackKey,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        countPerHit: count,
        comboHits: existingIdx >= 0 ? prev[existingIdx].comboHits + 1 : comboHits,
        isLucky: isLuckyGift,
        luckyMultiplier: luckyMult,
        luckyWinCoins,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        const clone = [...prev];
        clone[existingIdx] = updatedItem;
        return clone;
      }
      return [...prev.slice(-1), updatedItem];
    });

    // 3. Only ultra-luxury gifts (>= 50,000 coins) get a sleek top marquee strip
    if (gift.coinPrice >= 50000) {
      setLuxuryNotice({
        id: `lux_${now}`,
        senderName: currentUser.displayName,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        count,
      });
      if (luxuryTimeoutRef.current) window.clearTimeout(luxuryTimeoutRef.current);
      luxuryTimeoutRef.current = window.setTimeout(() => setLuxuryNotice(null), 2800);
    }

    // 4. Clean Room Chat Log entry
    const nowTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setRoomEventLogs((prev) => [
      ...prev.slice(-30),
      {
        id: `log_gift_${now}_${Math.random()}`,
        type: isLuckyGift ? 'lucky_win' : 'gift_throw',
        senderName: currentUser.displayName,
        vipLevel: currentUser.vipLevel,
        level: currentUser.level,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftCount: count,
        comboHits,
        winCoins: luckyWinCoins,
        multiplier: luckyMult,
        time: nowTime,
      },
    ]);
  };

  const handleSendSelectedGift = () => {
    const giftObj = gifts.find((g) => g.id === selectedGiftId) || gifts[0];
    const targets = selectedRecipientSeats.filter((i) => i >= 0 && i < 8 && Boolean(seats8[i]?.userId));
    if (!giftObj || targets.length === 0) return;

    const isFromBag = giftDrawerTab === 'bag' && (bagGifts[giftObj.id] || 0) > 0;
    if (giftDrawerTab === 'bag' && !isFromBag) return;

    setActiveBottomDrawer('none');
    executeGiftThrow(giftObj, giftCount, targets, 1, isFromBag);

    setComboState({
      active: true,
      gift: giftObj,
      count: giftCount,
      targetSeats: targets,
      comboHits: 1,
      timeLeftMs: 2000,
      fromBag: isFromBag,
    });
  };

  const handleComboClick = () => {
    if (!comboState) return;
    const nextCombo = comboState.comboHits + 1;

    setComboState({
      ...comboState,
      comboHits: nextCombo,
      timeLeftMs: 2000,
    });

    executeGiftThrow(
      comboState.gift,
      comboState.count,
      comboState.targetSeats,
      nextCombo,
      comboState.fromBag
    );
  };

  const filteredDrawerGifts = gifts.filter((g) => {
    if (giftDrawerTab === 'all') return true;
    if (giftDrawerTab === 'lucky') {
      return g.isLucky || g.category === 'lucky' || g.animationType === 'lollipop_matrix';
    }
    if (giftDrawerTab === 'classic') {
      return g.category === 'classic' || g.category === 'romantic';
    }
    if (giftDrawerTab === 'luxury') {
      return g.category === 'luxury' || g.category === 'vip' || g.category === 'magic' || g.coinPrice >= 5000;
    }
    if (giftDrawerTab === 'bag') {
      return (bagGifts[g.id] || 0) > 0;
    }
    return true;
  });

  const handleSendEmojiToMySeat = (emoji: string) => {
    const mySeatIndex = seats8.findIndex((s) => s.userId === currentUser.id);
    const targetIdx = mySeatIndex >= 0 ? mySeatIndex : 0;
    if (mySeatIndex < 0) takeSeat(0);

    setSeatEmojis((prev) => ({ ...prev, [targetIdx]: emoji }));
    setActiveBottomDrawer('none');
    setTimeout(() => {
      setSeatEmojis((prev) => {
        const copy = { ...prev };
        delete copy[targetIdx];
        return copy;
      });
    }, 3500);
  };

  const handleClearHeartValue = (seatIndex: number) => {
    setSeatHeartsOverride((prev) => ({ ...prev, [seatIndex]: 0 }));
    setActiveBottomDrawer('none');
  };

  const handleToggleLockAllSeats = () => {
    const anyUnlocked = seats8.some((s) => !s.isLocked);
    seats8.forEach((s) => {
      if (anyUnlocked && !s.isLocked) toggleSeatLock(s.index);
      if (!anyUnlocked && s.isLocked) toggleSeatLock(s.index);
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendRoomMessage(chatInput.trim());
    setChatInput('');
    setShowChatInputBar(false);
  };

  const emojiSets: Record<typeof emojiCategory, string[]> = {
    faces: ['😊', '😂', '🥰', '😎', '🥳', '🤩', '😮', '😴', '🥺', '😤', '🤔', '🫡'],
    gestures: ['👏', '🔥', '👍', '🙌', '🫶', '🤝', '✌️', '👑', '💯', '🎉', '🎶', '🎙️'],
    hearts: ['❤️', '💖', '🌹', '💐', '💎', '💍', '✨', '🌙', '☕', '🥂', '🎁', '🏆'],
    fun: ['🐼', '🐱', '🦄', '🦋', '🍀', '🎯', '🚀', '⚡', '🌈', '🍓', '🧸', '🎈'],
  };

  const visibleEventLogs = roomEventLogs.filter((log) => {
    const logTs = Number(log.id.split('_')[2] || Date.now());
    if (chatClearedBeforeTs && logTs < chatClearedBeforeTs) return false;
    if (chatTab === 'all') return true;
    if (chatTab === 'gifts') return log.type === 'gift_throw' || log.type === 'lucky_win';
    if (chatTab === 'system')
      return (
        log.type === 'game_win' ||
        log.type === 'rocket_explosion' ||
        log.type === 'lucky_bag_claim'
      );
    return false;
  });

  const visibleTextMessages = activeRoomMessages.filter((msg) => {
    // Gift throws are rendered cleanly once via visibleEventLogs (prevent duplicate gift lines)
    if (msg.giftData) return false;
    if (chatTab === 'all') return true;
    if (chatTab === 'message') return !msg.isSystem;
    if (chatTab === 'gifts') return false;
    if (chatTab === 'system') return Boolean(msg.isSystem);
    return true;
  });

  return (
    <div className="relative h-dvh w-full bg-[#090c14] flex items-center justify-center font-tajawal select-none overflow-hidden">
      {/* Desktop Ambient Backdrop so wide viewports never look like an empty void */}
      <div className="hidden sm:block fixed inset-0 pointer-events-none">
        <img
          src={activeTheme.image}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-30 blur-2xl scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a12]/80 via-[#0a0e1a]/75 to-[#060810]/90" />
      </div>

      {/* Main Voice Room Shell (Mobile full-viewport, Desktop refined wide stage frame) */}
      <div
        className={`relative w-full max-w-[460px] h-full sm:h-[min(900px,calc(100dvh-2rem))] sm:rounded-[30px] sm:border sm:border-white/10 bg-gradient-to-b ${activeTheme.fallbackGradient} text-white flex flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.75)]`}
      >
        {/* Room Theme Wallpaper + Measured Readability Scrim */}
        <img
          src={activeTheme.image}
          alt={activeTheme.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a13]/75 via-[#090d18]/45 to-[#060810]/92 pointer-events-none" />

        {/* ================================================================= */}
        {/* SUBTLE GIFT GLIDE LAYER (Clean Single Icon Moving to Target Mic)  */}
        {/* ================================================================= */}
        <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
          {subtleGlides.map((glide) => (
            <div
              key={glide.id}
              style={{
                position: 'absolute',
                left: glide.phase === 'start' ? '14%' : `${glide.targetX}%`,
                top: glide.phase === 'start' ? '92%' : `${glide.targetY}%`,
                transform:
                  glide.phase === 'start'
                    ? 'translate(-50%, -50%) scale(0.75)'
                    : 'translate(-50%, -50%) scale(1.1)',
                opacity: glide.phase === 'start' ? 0.95 : 0.85,
                transition:
                  'left 440ms cubic-bezier(0.16, 1, 0.3, 1), top 440ms cubic-bezier(0.16, 1, 0.3, 1), transform 440ms ease-out',
              }}
              className="w-10 h-10 rounded-full bg-slate-950/70 backdrop-blur-sm border border-amber-400/50 flex items-center justify-center text-xl shadow-lg"
            >
              {glide.giftIcon}
            </div>
          ))}
        </div>

        {/* ================================================================= */}
        {/* ULTRA-LUXURY GIFT TOP STRIP (Only for >= 50,000 coin gifts)       */}
        {/* ================================================================= */}
        {luxuryNotice && (
          <div className="absolute top-[108px] inset-x-3 z-40 pointer-events-none flex justify-center">
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#1c1308]/95 via-[#2e1f0c]/95 to-[#1c1308]/95 border border-amber-400/50 backdrop-blur-md shadow-xl flex items-center gap-2.5 animate-gift-banner">
              <span className="text-xl">{luxuryNotice.giftIcon}</span>
              <div className="text-xs text-right leading-snug">
                <span className="font-bold text-amber-300">{luxuryNotice.senderName}</span>
                <span className="text-slate-300 mx-1">أهدى</span>
                <span className="font-bold text-white">{luxuryNotice.giftName}</span>
                <span className="text-amber-400 font-mono tabular-nums mx-1">
                  ×{luxuryNotice.count}
                </span>
                <span className="text-slate-300">إلى {luxuryNotice.targetNames}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 10-SECOND FLOATING LUCKY BAG (Only shown when actively launched)  */}
        {/* ================================================================= */}
        {activeLuckyBag && (
          <div className="absolute top-[112px] inset-x-3.5 z-40 pointer-events-none flex justify-center">
            <div className="pointer-events-auto w-full rounded-2xl bg-gradient-to-r from-[#2c0d14]/95 via-[#3d111a]/95 to-[#260b10]/95 border border-amber-400/60 backdrop-blur-md p-2.5 shadow-2xl flex items-center justify-between gap-3 animate-gift-banner">
              <button
                onClick={handleClaimLuckyBag}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors shrink-0 flex flex-col items-center justify-center"
              >
                <span>استلام</span>
                <span className="text-[10px] font-mono tabular-nums text-red-950">
                  {(activeLuckyBag.timeLeftMs / 1000).toFixed(1)}s
                </span>
              </button>

              <div className="flex-1 text-right min-w-0 space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <span className="text-[11px] font-mono tabular-nums text-amber-300">
                    {Math.ceil(activeLuckyBag.timeLeftMs / 1000)} ث
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {activeLuckyBag.tierName}
                  </span>
                </div>
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-100 ease-linear"
                    style={{ width: `${(activeLuckyBag.timeLeftMs / 10000) * 100}%` }}
                  />
                </div>
              </div>

              <div className="w-10 h-10 rounded-xl bg-red-900/70 border border-amber-400/40 flex items-center justify-center text-2xl shrink-0">
                🧧
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 1. TOP ROOM HEADER BAR (Clean Flagship Voice Room Architecture)   */}
        {/* ================================================================= */}
        <header className="relative z-30 shrink-0 pt-3 px-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* Right in RTL (First in DOM): Room Identity */}
            <div className="flex items-center gap-2.5 min-w-0 bg-black/35 backdrop-blur-md pl-3 pr-1.5 py-1.5 rounded-2xl border border-white/10">
              <img
                src={activeRoom.ownerAvatar || currentUser.avatar}
                alt={activeRoom.title}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-amber-400/40"
              />
              <div className="min-w-0 text-right">
                <h1 className="text-[13px] font-bold text-white truncate leading-tight">
                  {activeRoom.title}
                </h1>
                <button
                  onClick={handleCopyRoomId}
                  className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-amber-300 transition-colors font-mono tabular-nums mt-0.5"
                  title="نسخ رقم الغرفة"
                >
                  <span>ID {activeRoom.roomNo || '2026091'}</span>
                  {idCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5 opacity-70" />
                  )}
                </button>
              </div>
            </div>

            {/* Left in RTL (Second in DOM): Audience + Utility Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setActiveBottomDrawer('top_ranking')}
                className="h-9 px-2.5 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
                title="المتواجدون والترتيب"
              >
                <Users className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-mono tabular-nums">
                  {Math.max(1, activeRoom.onlineViewersCount)}
                </span>
              </button>

              <button
                onClick={() => {
                  setNoticeDraft(roomNotice);
                  setActiveBottomDrawer('room_settings');
                }}
                className="w-9 h-9 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors"
                title="إعدادات الغرفة"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              <button
                onClick={leaveRoom}
                className="w-9 h-9 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors"
                title="تصغير الغرفة"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                onClick={leaveRoom}
                className="w-9 h-9 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-200 hover:bg-rose-600/80 hover:border-rose-500/50 transition-colors"
                title="خروج من الغرفة"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-Header Strip: Room Charm Trophy + Announcement + Compact Rocket Status */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setActiveBottomDrawer('top_ranking')}
                className="h-7 px-2.5 rounded-lg bg-black/35 backdrop-blur-sm border border-amber-400/25 flex items-center gap-1.5 text-amber-300 hover:bg-amber-400/10 transition-colors shrink-0"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span className="font-mono tabular-nums font-bold">
                  {formatScore(activeRoom.totalDiamondsEarned)}
                </span>
              </button>

              <button
                onClick={() => {
                  setNoticeDraft(roomNotice);
                  setActiveBottomDrawer('room_settings');
                }}
                className="h-7 px-2.5 rounded-lg bg-black/25 backdrop-blur-sm border border-white/8 flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors min-w-0 max-w-[185px]"
              >
                <Megaphone className="w-3 h-3 text-amber-400/80 shrink-0" />
                <span className="truncate">{roomNotice}</span>
              </button>
            </div>

            {/* Compact Rocket Progress Chip (No clutter, 24h lock preserved) */}
            <button
              onClick={() => {
                setPreviewRocketLevel(rocketLevel);
                setActiveBottomDrawer('rocket');
              }}
              className="h-7 px-2.5 rounded-lg bg-black/35 backdrop-blur-sm border border-white/10 flex items-center gap-1.5 text-slate-200 hover:border-amber-400/40 transition-colors shrink-0"
              title="صاروخ الغرفة"
            >
              <Rocket className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono tabular-nums font-semibold">
                {isRocketLocked24h
                  ? formatCooldownHMS(rocketCooldownRemainingMs)
                  : `Lv.${rocketLevel} · ${rocketProgressPercent}%`}
              </span>
            </button>
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. SPACIOUS 8-MIC VOICE STAGE (2 Rows × 4 Mics — Yalla/SoulChill) */}
        {/* ================================================================= */}
        <section className="relative z-20 shrink-0 px-4 pt-3 pb-1.5">
          <div className="grid grid-cols-4 gap-x-3 gap-y-4">
            {seats8.map((seat, idx) => {
              const isHostSeat = idx === 0;
              const heartVal =
                seatHeartsOverride[idx] !== undefined
                  ? seatHeartsOverride[idx]
                  : seat.heartPoints || 0;
              const activeEmoji = seatEmojis[idx];
              const seatPulse = seatPulseMap[idx];
              const isOccupied = Boolean(seat.userId);
              const isSpeaking = isOccupied && seat.isSpeaking && !seat.isMuted;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedSeatForMenu(seat);
                    setActiveBottomDrawer('seat_menu');
                  }}
                  className="relative flex flex-col items-center group focus:outline-none"
                >
                  {/* Floating Reaction Emoji over Mic */}
                  {activeEmoji && (
                    <div className="absolute -top-6 z-30 text-3xl animate-bounce pointer-events-none">
                      {activeEmoji}
                    </div>
                  )}

                  {/* Subtle Gift Arrival Pulse (No explosion clutter) */}
                  {seatPulse && (
                    <div className="absolute -top-3 z-30 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-amber-400/60 text-xs font-mono tabular-nums text-amber-300 shadow-lg animate-combo-pop pointer-events-none">
                      {seatPulse.icon} +{seatPulse.count}
                    </div>
                  )}

                  {/* Circular 64px Seat Pod */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    {/* Real Speaking Audio Ring */}
                    {isSpeaking && (
                      <>
                        <span className="absolute inset-0 rounded-full border border-amber-400/75 animate-mic-wave pointer-events-none" />
                        <span
                          className="absolute inset-0 rounded-full border border-emerald-400/50 animate-mic-wave pointer-events-none"
                          style={{ animationDelay: '0.55s' }}
                        />
                      </>
                    )}

                    {/* Subtle Gift Receive Ring */}
                    {seatPulse && (
                      <span className="absolute -inset-1 rounded-full border-2 border-amber-400/80 transition-opacity pointer-events-none" />
                    )}

                    {/* Outer Metallic/Glass Frame */}
                    <div
                      className={`w-15 h-15 rounded-full p-[2px] transition-transform duration-150 group-active:scale-95 ${
                        isOccupied
                          ? isHostSeat
                            ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_6px_20px_rgba(245,158,11,0.35)]'
                            : 'bg-gradient-to-b from-slate-200/80 via-slate-400/50 to-slate-700/70 shadow-lg'
                          : isHostSeat
                          ? 'bg-gradient-to-b from-amber-400/50 to-amber-700/20'
                          : 'bg-white/12 group-hover:bg-white/20'
                      }`}
                    >
                      {seat.userAvatar ? (
                        <img
                          src={seat.userAvatar}
                          alt={seat.userName || `مايك ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full rounded-full object-cover bg-slate-900"
                        />
                      ) : (
                        <div className="w-full h-full rounded-full bg-[#0e1322]/80 backdrop-blur-md flex items-center justify-center text-slate-300/80 group-hover:text-amber-300 transition-colors">
                          {seat.isLocked ? (
                            <Lock className="w-5 h-5 text-amber-400/80" />
                          ) : (
                            <Mic
                              className={`w-5 h-5 ${
                                isHostSeat ? 'text-amber-300/90' : 'text-slate-300/70'
                              }`}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Host Seat #1 Minimal Crown Marker */}
                    {isHostSeat && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                        <Crown className="w-3 h-3" />
                      </span>
                    )}

                    {/* Seat Index Number Badge (Bottom-Left) */}
                    {!isOccupied && !seat.isLocked && (
                      <span className="absolute -bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#121829] border border-white/15 text-[9px] font-mono tabular-nums font-bold text-slate-300 flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}

                    {/* Muted Mic Badge */}
                    {isOccupied && seat.isMuted && (
                      <span className="absolute -bottom-0.5 right-0 w-5 h-5 rounded-full bg-rose-600 border-2 border-[#0e1322] flex items-center justify-center shadow">
                        <MicOff className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}

                    {/* Locked Overlay on Occupied Seat */}
                    {isOccupied && seat.isLocked && (
                      <span className="absolute inset-0 rounded-full bg-black/55 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </span>
                    )}
                  </div>

                  {/* Seat Name / Label */}
                  <span
                    className={`mt-1.5 text-[11px] font-medium truncate max-w-[74px] leading-tight ${
                      isOccupied
                        ? 'text-white font-semibold'
                        : isHostSeat
                        ? 'text-amber-200/90'
                        : 'text-slate-300/80'
                    }`}
                  >
                    {seat.userName || (isHostSeat ? 'المضيف' : `مايك ${idx + 1}`)}
                  </span>

                  {/* Clean Unboxed Charm Counter */}
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] font-mono tabular-nums text-slate-400 leading-none">
                    <Heart
                      className={`w-2.5 h-2.5 ${
                        heartVal > 0 ? 'text-rose-400 fill-rose-400' : 'text-slate-500'
                      }`}
                    />
                    <span className={heartVal > 0 ? 'text-rose-200 font-semibold' : ''}>
                      {formatScore(heartVal)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. AUTHENTIC SIDE STACKED GIFT COMBO RAIL (Yalla / SoulChill)     */}
        {/* Clean, compact slide-in cards above the chat — never covers mics! */}
        {/* ================================================================= */}
        <div className="relative z-30 shrink-0 px-3.5 min-h-[54px] flex flex-col justify-end gap-1.5 pointer-events-none">
          {giftComboTrack.map((item) => (
            <div
              key={item.id}
              className="self-end w-fit max-w-[92%] rounded-full bg-gradient-to-l from-[#121726]/92 via-[#1b1525]/92 to-[#2a1c11]/92 border border-amber-400/35 backdrop-blur-md pl-3.5 pr-1.5 py-1.5 shadow-lg flex items-center gap-2.5 animate-gift-banner"
            >
              {/* Popping Combo Multiplier */}
              <div
                key={item.comboHits}
                className="flex items-baseline gap-0.5 font-mono tabular-nums font-black text-amber-300 animate-combo-pop pl-1"
              >
                <span className="text-xs text-amber-400/90">×</span>
                <span className="text-lg leading-none">
                  {item.comboHits * item.countPerHit}
                </span>
              </div>

              {/* Gift Icon */}
              <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                {item.giftIcon}
              </div>

              {/* Sender -> Target Details */}
              <div className="text-right min-w-0">
                <div className="text-[11px] font-bold text-white truncate max-w-[150px]">
                  {item.senderName}
                </div>
                <div className="text-[10px] text-slate-300 truncate max-w-[165px]">
                  أرسل {item.giftName} إلى <span className="text-amber-300">{item.targetNames}</span>
                  {item.isLucky && item.luckyWinCoins ? (
                    <span className="text-emerald-400 font-mono tabular-nums mr-1">
                      · +{item.luckyWinCoins.toLocaleString()} ({item.luckyMultiplier}X)
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Sender Avatar */}
              <img
                src={item.senderAvatar}
                alt={item.senderName}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover border border-amber-400/50 shrink-0"
              />
            </div>
          ))}
        </div>

        {/* ================================================================= */}
        {/* 4. CLEAN ROOM CHAT STREAM & MINIMAL FILTER TABS                   */}
        {/* ================================================================= */}
        <section className="relative z-20 flex-1 min-h-0 flex flex-col justify-end px-3.5 pt-1 pb-2">
          {/* Minimal Clean Underline Filter Tabs */}
          <div className="flex items-center gap-4 border-b border-white/8 pb-1.5 mb-2 text-xs">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'message', label: 'المحادثة' },
              { id: 'gifts', label: 'الهدايا' },
              { id: 'system', label: 'النظام' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setChatTab(tab.id as typeof chatTab)}
                className={`relative pb-1 whitespace-nowrap shrink-0 transition-colors ${
                  chatTab === tab.id
                    ? 'text-amber-300 font-bold after:content-[""] after:absolute after:bottom-[-7px] after:inset-x-0 after:h-[2px] after:bg-amber-400 after:rounded-full'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable Message Stream */}
          <div className="flex-1 overflow-y-auto space-y-1.5 no-scrollbar pr-0.5">
            {/* Room Official Welcome Card */}
            <div className="w-fit max-w-[92%] rounded-2xl px-3 py-2 bg-black/35 backdrop-blur-sm border border-white/8 text-right text-[11px] text-slate-300 leading-relaxed">
              مرحباً بكم في <span className="text-amber-300 font-semibold">{activeRoom.title}</span>.
              المايكات الـ 8 متاحة للصعود والتحدث، واستمتعوا بالهدايا والألعاب الهادئة.
            </div>

            {visibleEventLogs.map((log) => (
              <div
                key={log.id}
                className="w-fit max-w-[92%] rounded-2xl px-3 py-1.5 bg-black/40 backdrop-blur-sm border border-white/8 text-right text-xs leading-relaxed"
              >
                <span className="text-[10px] font-mono tabular-nums text-amber-400/90 ml-1.5">
                  VIP{log.vipLevel}
                </span>
                <span className="font-semibold text-amber-200 ml-1">{log.senderName}</span>
                {log.type === 'lucky_win' ? (
                  <span className="text-slate-200">
                    أرسل {log.giftIcon} {log.giftName} إلى {log.targetNames} وربح{' '}
                    <span className="text-emerald-400 font-mono tabular-nums font-bold">
                      {log.winCoins?.toLocaleString()}
                    </span>{' '}
                    عملة ({log.multiplier}X)
                  </span>
                ) : log.type === 'lucky_bag_claim' ? (
                  <span className="text-slate-200">
                    استلم من {log.targetNames}:{' '}
                    <span className="text-amber-300 font-mono tabular-nums font-bold">
                      +{log.winCoins?.toLocaleString()}
                    </span>{' '}
                    عملة ({log.giftName})
                  </span>
                ) : log.type === 'rocket_explosion' ? (
                  <span className="text-amber-200">
                    أكمل {log.giftIcon} {log.giftName} وحصل على{' '}
                    <span className="text-emerald-400 font-mono tabular-nums font-bold">
                      +{log.winCoins?.toLocaleString()}
                    </span>{' '}
                    عملة وهدايا في الحقيبة
                  </span>
                ) : log.type === 'game_win' ? (
                  <span className="text-slate-200">
                    ربح في {log.giftName}{' '}
                    <span className="text-amber-300 font-mono tabular-nums font-bold">
                      {log.winCoins?.toLocaleString()}
                    </span>{' '}
                    عملة
                  </span>
                ) : (
                  <span className="text-slate-200">
                    أهدى {log.giftIcon} {log.giftName} ×{log.giftCount} إلى{' '}
                    <span className="text-amber-200">{log.targetNames}</span>
                  </span>
                )}
              </div>
            ))}

            {visibleTextMessages.slice(-15).map((msg) => (
              <div
                key={msg.id}
                className="w-fit max-w-[92%] rounded-2xl px-3 py-1.5 bg-black/40 backdrop-blur-sm border border-white/8 text-right text-xs leading-relaxed"
              >
                {msg.isSystem ? (
                  <span className="text-slate-300">{msg.text}</span>
                ) : msg.giftData ? (
                  <span className="text-slate-200">
                    <span className="font-semibold text-amber-200 ml-1">{msg.senderName}</span>
                    أرسل {msg.giftData.giftIcon} {msg.giftData.giftName} ×{msg.giftData.giftCount} إلى{' '}
                    <span className="text-amber-300">{msg.giftData.targetUserName}</span>
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-mono tabular-nums text-sky-400 ml-1.5">
                      Lv.{msg.level || 1}
                    </span>
                    <span className="font-semibold text-amber-200 ml-1.5">{msg.senderName}:</span>
                    <span className="text-white">{msg.text}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </section>

        {/* ================================================================= */}
        {/* COMPACT 2-SECOND QUICK COMBO BUTTON (Lower-Left Thumb Zone)       */}
        {/* ================================================================= */}
        {comboState && comboState.active && (
          <div className="absolute bottom-[78px] left-4 z-40">
            <button
              onClick={handleComboClick}
              className="relative w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-xl cursor-pointer"
              title="إرسال متتابع"
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="rgba(12, 16, 28, 0.94)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={282}
                  strokeDashoffset={282 - (282 * comboState.timeLeftMs) / 2000}
                  className="transition-all duration-75 ease-linear"
                />
              </svg>
              <div className="relative z-10 flex flex-col items-center leading-none">
                <span className="text-lg">{comboState.gift.icon}</span>
                <span className="text-[10px] font-mono tabular-nums font-bold text-amber-300 mt-0.5">
                  ×{comboState.comboHits}
                </span>
              </div>
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* 5. ERGONOMIC BOTTOM ACTION BAR (Yalla / SoulChill Thumb Zone)     */}
        {/* ================================================================= */}
        <footer className="relative z-30 shrink-0 px-3.5 py-2.5 bg-[#080b14]/90 backdrop-blur-md border-t border-white/10">
          {showChatInputBar ? (
            <form onSubmit={handleSendChat} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowChatInputBar(false)}
                className="w-11 h-11 rounded-xl bg-white/8 text-slate-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="اكتب رسالة للغرفة..."
                className="flex-1 h-11 rounded-xl bg-white/8 border border-white/15 px-3.5 text-sm text-white placeholder:text-slate-400 focus:border-amber-400 focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="h-11 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>إرسال</span>
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-2">
              {/* Right in RTL: Chat Trigger Input Pill */}
              <button
                onClick={() => setShowChatInputBar(true)}
                className="flex-1 h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 px-3.5 flex items-center justify-between text-slate-300 text-xs transition-colors"
              >
                <span>قل شيئاً...</span>
                <Smile
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveBottomDrawer('emoji');
                  }}
                  className="w-4 h-4 text-slate-300 hover:text-amber-300"
                />
              </button>

              {/* Center-Left Action Icons (All >= 44px touch targets) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mic Toggle / Climb Mic */}
                <button
                  onClick={() => {
                    if (!mySeat) {
                      const firstOpen = seats8.find((s) => !s.userId && !s.isLocked);
                      if (firstOpen) takeSeat(firstOpen.index);
                    } else {
                      toggleMic();
                    }
                  }}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                    mySeat && !mySeat.isMuted
                      ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                      : mySeat && mySeat.isMuted
                      ? 'bg-rose-500/20 border-rose-400/60 text-rose-300'
                      : 'bg-white/8 border-white/10 text-slate-200 hover:bg-white/12'
                  }`}
                  title={mySeat ? (mySeat.isMuted ? 'فتح المايك' : 'كتم المايك') : 'صعود للمايك'}
                >
                  {mySeat && mySeat.isMuted ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>

                {/* Room Audio Mute */}
                <button
                  onClick={() => setIsRoomSoundMuted(!isRoomSoundMuted)}
                  className="w-11 h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 flex items-center justify-center text-slate-200 transition-colors"
                  title={isRoomSoundMuted ? 'تشغيل الصوت' : 'كتم صوت الغرفة'}
                >
                  {isRoomSoundMuted ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                {/* Room Tools Menu (Games, Lucky Bag, Rocket, Wallet, Theme) */}
                <button
                  onClick={() => setActiveBottomDrawer('tools_menu')}
                  className="w-11 h-11 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 flex items-center justify-center text-slate-200 transition-colors"
                  title="الأدوات والألعاب"
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>

                {/* Primary CTA: Gift Drawer */}
                <button
                  onClick={() => openGiftDrawer()}
                  className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-[0_4px_16px_rgba(245,158,11,0.35)] active:scale-95 transition-transform"
                  title="إرسال هدية"
                >
                  <Gift className="w-5 h-5 stroke-[2.25]" />
                  {totalBagCount > 0 && (
                    <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-slate-950 font-mono tabular-nums font-bold text-[10px] flex items-center justify-center">
                      {totalBagCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </footer>

        {/* ================================================================= */}
        {/* DRAWER 1: PROFESSIONAL GIFT DRAWER (Yalla / SoulChill Pattern)    */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'gift' && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl px-4 pt-2.5 pb-4 text-white space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

              {/* 1. OCCUPIED MICS ONLY Recipient Selector Bar (Empty Mics Hidden) */}
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/8 min-h-[60px]">
                {occupiedSeats.length === 0 ? (
                  <div className="w-full flex items-center justify-between gap-2 py-1 px-2 rounded-xl bg-white/[0.04] border border-white/8">
                    <span className="text-xs text-slate-300">
                      لا يوجد متحدث على المايك حالياً لإرسال الهدايا له
                    </span>
                    <button
                      onClick={() => {
                        const firstOpen = seats8.find((s) => !s.userId && !s.isLocked);
                        if (firstOpen) {
                          takeSeat(firstOpen.index);
                          setSelectedRecipientSeats([firstOpen.index]);
                        }
                      }}
                      className="h-8 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0 transition-colors"
                    >
                      صعود على المايك
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
                      {occupiedSeats.map((s) => {
                        const idx = s.index;
                        const isSelected = selectedRecipientSeats.includes(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedRecipientSeats((prev) =>
                                prev.includes(idx)
                                  ? prev.length > 1
                                    ? prev.filter((i) => i !== idx)
                                    : prev
                                  : [...prev, idx]
                              );
                            }}
                            className="relative flex flex-col items-center shrink-0"
                          >
                            <div
                              className={`relative w-10 h-10 rounded-full p-[2px] transition-all ${
                                isSelected
                                  ? 'ring-2 ring-amber-400 bg-amber-400/20'
                                  : 'border border-white/15 opacity-65 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={s.userAvatar || currentUser.avatar}
                                alt={s.userName || `مايك ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-slate-950 border border-white/25 text-[9px] font-mono tabular-nums font-bold text-amber-300 flex items-center justify-center">
                                {idx + 1}
                              </span>
                              {isSelected && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-white font-medium max-w-[56px] truncate mt-1">
                              {s.userName || `مايك ${idx + 1}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {occupiedSeats.length > 1 && (
                      <button
                        onClick={() => {
                          const allOccupied = occupiedSeats.map((s) => s.index);
                          setSelectedRecipientSeats(
                            selectedRecipientSeats.length === allOccupied.length
                              ? [allOccupied[0]]
                              : allOccupied
                          );
                        }}
                        className={`h-9 px-3 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                          selectedRecipientSeats.length === occupiedSeats.length
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-white/8 text-slate-200 hover:bg-white/14'
                        }`}
                      >
                        {selectedRecipientSeats.length === occupiedSeats.length ? 'واحد' : 'الكل'}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 2. Clean Gift Category Tabs */}
              <div className="flex items-center gap-4 text-xs border-b border-white/8 pb-2 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'classic', label: 'كلاسيكي' },
                  { id: 'luxury', label: 'فاخر' },
                  { id: 'lucky', label: 'هدايا الحظ' },
                  { id: 'bag', label: `الحقيبة (${totalBagCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setGiftDrawerTab(tab.id as typeof giftDrawerTab);
                      if (tab.id === 'bag') {
                        const firstBag = Object.keys(bagGifts).find((k) => (bagGifts[k] || 0) > 0);
                        if (firstBag) setSelectedGiftId(firstBag);
                      }
                    }}
                    className={`whitespace-nowrap shrink-0 transition-colors ${
                      giftDrawerTab === tab.id
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 3. Crisp 4-Column Gift Grid */}
              {giftDrawerTab === 'bag' && filteredDrawerGifts.length === 0 ? (
                <div className="py-10 text-center space-y-2.5">
                  <div className="text-3xl opacity-80">🎒</div>
                  <p className="text-xs text-slate-400">
                    الحقيبة فارغة حالياً — يمكنك الحصول على هدايا مجانية من صاروخ الغرفة أو كيس الحظ.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto no-scrollbar py-0.5">
                  {filteredDrawerGifts.map((g) => {
                    const isSelected = selectedGiftId === g.id;
                    const bagQty = bagGifts[g.id] || 0;
                    const isLucky = g.isLucky || g.category === 'lucky';

                    return (
                      <button
                        key={g.id}
                        onClick={() => setSelectedGiftId(g.id)}
                        className={`relative rounded-2xl p-2.5 flex flex-col items-center justify-between border transition-colors ${
                          isSelected
                            ? 'bg-amber-400/14 border-amber-400/80'
                            : 'bg-white/[0.03] border-white/6 hover:bg-white/[0.07]'
                        }`}
                      >
                        {giftDrawerTab === 'bag' && bagQty > 0 ? (
                          <span className="absolute top-1.5 right-1.5 text-[10px] font-mono tabular-nums font-bold text-emerald-400">
                            ×{bagQty}
                          </span>
                        ) : isLucky ? (
                          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-amber-300">
                            حظ
                          </span>
                        ) : null}

                        <div className="text-3xl my-1">{g.icon}</div>
                        <span className="text-[11px] font-medium text-white truncate w-full text-center">
                          {g.nameAr}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-amber-300/90 mt-0.5">
                          {giftDrawerTab === 'bag'
                            ? 'مجاني'
                            : g.coinPrice >= 1000
                            ? `${(g.coinPrice / 1000).toFixed(g.coinPrice % 1000 === 0 ? 0 : 1)}K`
                            : g.coinPrice}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 4. Unified Footer: Balance + Recharge & Quantity + Send */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    setActiveBottomDrawer('none');
                    setActiveModal('wallet');
                  }}
                  className="h-10 px-3 rounded-xl bg-white/6 hover:bg-white/10 flex items-center gap-1.5 text-xs transition-colors"
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="font-mono tabular-nums font-bold text-white">
                    {currentUser.coins.toLocaleString('en-US')}
                  </span>
                  <span className="text-amber-400 font-bold mr-1">شحن</span>
                  <ChevronLeft className="w-3.5 h-3.5 text-amber-400" />
                </button>

                <div className="flex items-center rounded-xl overflow-hidden border border-amber-400/70">
                  <select
                    value={giftCount}
                    onChange={(e) => setGiftCount(Number(e.target.value))}
                    className="h-10 bg-[#181e30] text-white text-xs font-mono tabular-nums font-bold px-2.5 focus:outline-none"
                  >
                    <option value={1}>× 1</option>
                    <option value={10}>× 10</option>
                    <option value={66}>× 66</option>
                    <option value={99}>× 99</option>
                    <option value={520}>× 520</option>
                  </select>
                  <button
                    onClick={handleSendSelectedGift}
                    disabled={selectedRecipientSeats.length === 0 || (giftDrawerTab === 'bag' && filteredDrawerGifts.length === 0)}
                    className={`h-10 px-5 font-bold text-xs transition-colors ${
                      selectedRecipientSeats.length > 0 && !(giftDrawerTab === 'bag' && filteredDrawerGifts.length === 0)
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {selectedRecipientSeats.length > 0
                      ? `إرسال (${selectedRecipientSeats.length})`
                      : 'اختر متحدثاً'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 2: ROOM TOOLS MENU (Games, Lucky Bag, Rocket, Wallet, Theme) */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'tools_menu' && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-6 text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">أدوات الغرفة</h3>
                <button
                  onClick={() => setActiveBottomDrawer('none')}
                  className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <button
                  onClick={() => setActiveBottomDrawer('game_center')}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Gamepad2 className="w-6 h-6 text-amber-400" />
                  <span className="text-xs font-medium text-slate-200">الألعاب</span>
                </button>

                <button
                  onClick={() => setActiveBottomDrawer('lucky_bag_drawer')}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span className="text-2xl leading-none">🧧</span>
                  <span className="text-xs font-medium text-slate-200">كيس الحظ</span>
                </button>

                <button
                  onClick={() => {
                    setPreviewRocketLevel(rocketLevel);
                    setActiveBottomDrawer('rocket');
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Rocket className="w-6 h-6 text-sky-400" />
                  <span className="text-xs font-medium text-slate-200">الصاروخ</span>
                </button>

                <button
                  onClick={() => {
                    setActiveBottomDrawer('none');
                    setActiveModal('wallet');
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Coins className="w-6 h-6 text-emerald-400" />
                  <span className="text-xs font-medium text-slate-200">المحفظة</span>
                </button>

                <button
                  onClick={() => setActiveBottomDrawer('top_ranking')}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Trophy className="w-6 h-6 text-amber-300" />
                  <span className="text-xs font-medium text-slate-200">الترتيب</span>
                </button>

                <button
                  onClick={() => {
                    setNoticeDraft(roomNotice);
                    setActiveBottomDrawer('room_settings');
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <SlidersHorizontal className="w-6 h-6 text-slate-300" />
                  <span className="text-xs font-medium text-slate-200">خلفية الغرفة</span>
                </button>

                <button
                  onClick={() => {
                    handleToggleLockAllSeats();
                    setActiveBottomDrawer('none');
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  {seats8.some((s) => !s.isLocked) ? (
                    <Lock className="w-6 h-6 text-rose-400" />
                  ) : (
                    <Unlock className="w-6 h-6 text-emerald-400" />
                  )}
                  <span className="text-xs font-medium text-slate-200">
                    {seats8.some((s) => !s.isLocked) ? 'قفل الكل' : 'فتح الكل'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setChatClearedBeforeTs(Date.now());
                    setActiveBottomDrawer('none');
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <Trash2 className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">مسح الدردشة</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 3: ROOM SETTINGS (3 Luxury Wallpapers + Notice Editor)     */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'room_settings' && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-6 text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">إعدادات ومظهر الغرفة</h3>
                <button
                  onClick={() => setActiveBottomDrawer('none')}
                  className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Wallpaper Picker */}
              <div className="space-y-2 text-right">
                <label className="text-xs font-semibold text-slate-300">خلفية الغرفة</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {ROOM_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setThemeId(t.id)}
                      className={`relative h-24 rounded-2xl overflow-hidden border-2 transition-all ${
                        themeId === t.id ? 'border-amber-400' : 'border-white/10 opacity-75'
                      }`}
                    >
                      <img
                        src={t.image}
                        alt={t.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 py-1 bg-black/70 text-[11px] font-semibold text-white">
                        {t.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Announcement Editor */}
              <div className="space-y-2 text-right">
                <label className="text-xs font-semibold text-slate-300">إعلان الغرفة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={noticeDraft}
                    onChange={(e) => setNoticeDraft(e.target.value)}
                    className="flex-1 h-10 rounded-xl bg-white/6 border border-white/12 px-3 text-xs text-white focus:border-amber-400 focus:outline-none"
                    placeholder="اكتب إعلان الغرفة..."
                  />
                  <button
                    onClick={() => {
                      if (noticeDraft.trim()) setRoomNotice(noticeDraft.trim());
                      setActiveBottomDrawer('none');
                    }}
                    className="h-10 px-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    حفظ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 4: SEAT ACTION SHEET (Clean Native Pattern)                */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'seat_menu' && selectedSeatForMenu && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end p-3"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full space-y-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl bg-[#151a2b] border border-white/10 overflow-hidden divide-y divide-white/8 text-center text-sm font-medium">
                <div className="py-2.5 text-xs text-slate-400">
                  {selectedSeatForMenu.index === 0
                    ? 'مايك المضيف (#1)'
                    : `مايك #${selectedSeatForMenu.index + 1}`}{' '}
                  {selectedSeatForMenu.userName ? `· ${selectedSeatForMenu.userName}` : '· متاح'}
                </div>

                <button
                  onClick={() => {
                    if (selectedSeatForMenu.userId === currentUser.id) {
                      leaveSeat();
                    } else if (selectedSeatForMenu.userId) {
                      const targetUser = users.find((u) => u.id === selectedSeatForMenu.userId);
                      setViewingProfileUser(targetUser || currentUser);
                      setActiveModal('profile');
                    } else {
                      takeSeat(selectedSeatForMenu.index);
                    }
                    setActiveBottomDrawer('none');
                  }}
                  className="w-full h-12 text-white hover:bg-white/6 transition-colors font-semibold"
                >
                  {selectedSeatForMenu.userId === currentUser.id
                    ? 'النزول من المايك'
                    : selectedSeatForMenu.userId
                    ? 'عرض الملف الشخصي'
                    : 'صعود إلى المايك'}
                </button>

                {selectedSeatForMenu.userId && (
                  <button
                    onClick={() => {
                      openGiftDrawer(selectedSeatForMenu.index);
                    }}
                    className="w-full h-12 text-amber-300 hover:bg-white/6 transition-colors font-semibold"
                  >
                    إرسال هدية إلى {selectedSeatForMenu.userName || `مايك #${selectedSeatForMenu.index + 1}`}
                  </button>
                )}

                <button
                  onClick={() => {
                    toggleSeatLock(selectedSeatForMenu.index);
                    setActiveBottomDrawer('none');
                  }}
                  className="w-full h-12 text-slate-200 hover:bg-white/6 transition-colors"
                >
                  {selectedSeatForMenu.isLocked ? 'فتح قفل المايك' : 'قفل المايك'}
                </button>

                <button
                  onClick={() => handleClearHeartValue(selectedSeatForMenu.index)}
                  className="w-full h-12 text-rose-400 hover:bg-white/6 transition-colors"
                >
                  تصفير نقاط الكاريزما
                </button>
              </div>

              <button
                onClick={() => setActiveBottomDrawer('none')}
                className="w-full h-12 rounded-2xl bg-[#151a2b] border border-white/10 text-slate-300 font-semibold text-sm hover:bg-white/6 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 5: EMOJI SHEET                                             */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'emoji' && (
          <div
            className="absolute inset-0 z-50 bg-black/55 flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 text-white space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center gap-4 border-b border-white/8 pb-2 text-xs">
                {[
                  { id: 'faces', label: 'تعابير' },
                  { id: 'gestures', label: 'تفاعل' },
                  { id: 'hearts', label: 'مشاعر' },
                  { id: 'fun', label: 'منوعات' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setEmojiCategory(tab.id as typeof emojiCategory)}
                    className={
                      emojiCategory === tab.id
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2.5 py-2">
                {emojiSets[emojiCategory].map((emo, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendEmojiToMySeat(emo)}
                    className="h-14 rounded-2xl bg-white/5 hover:bg-white/12 flex items-center justify-center text-3xl active:scale-90 transition-transform"
                  >
                    {emo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 6: ROOM ROCKET (Gift-Only Charge + 24h Lock Preserved)     */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'rocket' && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-5 text-white space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-amber-400" />
                  <span>صاروخ الغرفة</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-amber-300">
                  {isRocketLocked24h ? 'مكتمل 5/5' : `المستوى ${rocketLevel} من 5`}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {ROCKET_TIERS.map((t) => {
                  const isCompleted = isRocketLocked24h || t.level < rocketLevel;
                  const isCurrentActive = !isRocketLocked24h && t.level === rocketLevel;
                  const isPreviewed = previewRocketLevel === t.level;

                  return (
                    <button
                      key={t.level}
                      onClick={() => setPreviewRocketLevel(t.level)}
                      className={`rounded-xl p-2 flex flex-col items-center border transition-colors ${
                        isPreviewed
                          ? 'bg-amber-400/15 border-amber-400/70'
                          : isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-white/4 border-white/8 opacity-65'
                      }`}
                    >
                      <span className="text-lg">{t.icon}</span>
                      <span className="text-[10px] font-bold text-slate-200 mt-0.5">
                        Lv.{t.level}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {isCompleted ? 'مغلق' : isCurrentActive ? 'نشط' : 'مقفل'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isRocketLocked24h ? (
                <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-1.5">
                  <div className="text-xs font-bold text-rose-300">
                    تم إغلاق جميع الصواريخ الخمسة في هذه الغرفة
                  </div>
                  <div className="text-[11px] text-slate-300">
                    يتم التجديد تلقائياً بعد مرور 24 ساعة:
                  </div>
                  <div className="text-base font-mono tabular-nums font-bold text-amber-300">
                    {formatCooldownHMS(rocketCooldownRemainingMs)}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/8 space-y-2 text-right">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{previewRocketTier.nameAr}</span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {previewRocketLevel < rocketLevel
                        ? `${previewRocketTier.targetCoins.toLocaleString()} / ${previewRocketTier.targetCoins.toLocaleString()}`
                        : previewRocketLevel === rocketLevel
                        ? `${rocketCurrentSupport.toLocaleString()} / ${currentRocketTier.targetCoins.toLocaleString()}`
                        : `0 / ${previewRocketTier.targetCoins.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${previewRocketTier.accent} transition-all duration-300`}
                      style={{
                        width: `${
                          previewRocketLevel < rocketLevel
                            ? 100
                            : previewRocketLevel === rocketLevel
                            ? rocketProgressPercent
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    يُشحن الصاروخ تلقائياً فقط عند رمي الهدايا بالكوينزات داخل الغرفة، ولا يتجدد بعد إغلاق المستويات الـ 5 إلا بعد 24 ساعة.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/8 flex flex-col items-center">
                  <span className="text-xl">🪙</span>
                  <span className="text-[10px] font-mono tabular-nums font-bold text-amber-300 mt-1">
                    +{previewRocketTier.rewardCoins.toLocaleString()}
                  </span>
                </div>
                {previewRocketTier.rewardBagGifts.map((rg, idx) => {
                  const gMeta = gifts.find((g) => g.id === rg.giftId);
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-white/[0.04] border border-white/8 flex flex-col items-center"
                    >
                      <span className="text-xl">{gMeta?.icon || '🎁'}</span>
                      <span className="text-[10px] font-mono tabular-nums text-emerald-400 mt-1">
                        ×{rg.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setGiftDrawerTab('all');
                  openGiftDrawer();
                }}
                className="w-full h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors"
              >
                إرسال هدايا في الغرفة لشحن الصاروخ
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 7: 10-SECOND LUCKY BAG LAUNCHER                            */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'lucky_bag_drawer' && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-5 text-white space-y-3.5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="text-right">
                <h3 className="text-sm font-bold text-white">إطلاق كيس الحظ (لمدة 10 ثوانٍ)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  يظهر الكيس داخل الغرفة لمدة 10 ثوانٍ ليستلم المتواجدون منه الهدايا والكوينزات ثم يختفي تلقائياً.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  {
                    tierName: 'كيس الحظ السريع',
                    cost: 0,
                    poolCoins: 1500,
                    gifts: [
                      { giftId: 'gift_lollipop_lucky', nameAr: 'مصاصة الحظ', icon: '🍭', count: 5 },
                      { giftId: 'gift_rose', nameAr: 'وردة جوري', icon: '🌹', count: 5 },
                    ],
                  },
                  {
                    tierName: 'كيس الحظ الذهبي',
                    cost: 2000,
                    poolCoins: 3500,
                    gifts: [
                      { giftId: 'gift_lollipop_lucky', nameAr: 'مصاصة الحظ', icon: '🍭', count: 12 },
                      { giftId: 'gift_pink_perfume', nameAr: 'عطر فرنسي', icon: '🧴', count: 4 },
                    ],
                  },
                  {
                    tierName: 'كيس الحظ الملكي',
                    cost: 10000,
                    poolCoins: 18000,
                    gifts: [
                      { giftId: 'gift_car', nameAr: 'سيارة فيراري', icon: '🏎️', count: 2 },
                      { giftId: 'gift_lollipop_lucky', nameAr: 'مصاصة الحظ', icon: '🍭', count: 30 },
                    ],
                  },
                ].map((bag, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-between gap-2"
                  >
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">{bag.tierName}</div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                        +{bag.poolCoins.toLocaleString()} عملة ·{' '}
                        {bag.gifts.map((g) => `${g.icon}×${g.count}`).join(' ')}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleLaunchLuckyBag(bag.tierName, bag.cost, bag.poolCoins, bag.gifts)
                      }
                      className="h-9 px-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shrink-0"
                    >
                      {bag.cost === 0 ? 'إطلاق مجاني' : `${bag.cost.toLocaleString()} عملة`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 8: INTERACTIVE GAMES HUB                                   */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'game_center' && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
              <InteractiveGamesHub
                compact={true}
                onOpenWallet={() => {
                  setActiveBottomDrawer('none');
                  setActiveModal('wallet');
                }}
                onWinAnnouncement={(gameName, gameIcon, winCoins, mult) => {
                  const nowTime = new Date().toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  setRoomEventLogs((prev) => [
                    ...prev.slice(-30),
                    {
                      id: `log_game_${Date.now()}`,
                      type: 'game_win',
                      senderName: currentUser.displayName,
                      vipLevel: currentUser.vipLevel,
                      level: currentUser.level,
                      targetNames: gameName,
                      giftName: gameName,
                      giftIcon: gameIcon,
                      giftCount: 1,
                      comboHits: 1,
                      winCoins,
                      multiplier: mult,
                      time: nowTime,
                    },
                  ]);
                }}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 9: TOP RANKING OF THE 8 MICS                               */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'top_ranking' && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-5 text-white space-y-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />
              <div className="flex items-center justify-between border-b border-white/8 pb-2.5">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>ترتيب المايكات والدعم</span>
                </div>
                <button
                  onClick={() => setActiveBottomDrawer('none')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  إغلاق
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 no-scrollbar">
                {occupiedSeats.length === 0 ? (
                  <div className="py-10 text-center space-y-2.5">
                    <div className="text-3xl opacity-80">🎙️</div>
                    <p className="text-xs text-slate-400">
                      لا يوجد متحدثون على المايكات حالياً — اصعد على أي مايك لبدء التفاعل والدعم.
                    </p>
                  </div>
                ) : (
                  occupiedSeats
                    .slice()
                    .sort((a, b) => (b.heartPoints || 0) - (a.heartPoints || 0))
                    .map((s, rankIdx) => {
                      const heartScore =
                        seatHeartsOverride[s.index] !== undefined
                          ? seatHeartsOverride[s.index]
                          : s.heartPoints || 0;
                      return (
                        <div
                          key={s.index}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.04] border border-white/8"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono tabular-nums font-bold text-xs ${
                                rankIdx === 0
                                  ? 'bg-amber-400 text-slate-950'
                                  : rankIdx === 1
                                  ? 'bg-slate-300 text-slate-950'
                                  : rankIdx === 2
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white/10 text-slate-300'
                              }`}
                            >
                              {rankIdx + 1}
                            </span>
                            <img
                              src={s.userAvatar || currentUser.avatar}
                              alt={s.userName}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover"
                            />
                            <div className="text-right">
                              <div className="text-xs font-semibold text-white">
                                {s.userName || `مايك #${s.index + 1}`}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-rose-300">
                                مايك {s.index + 1} · {heartScore.toLocaleString()} نقطة
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => openGiftDrawer(s.index)}
                            className="h-8 px-3 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 font-bold text-xs hover:bg-amber-400/25 transition-colors"
                          >
                            دعم
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CLEAN REWARD SUMMARY MODALS (Lucky Bag & Rocket Completion)       */}
        {/* ================================================================= */}
        {luckyBagRewardToast && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setLuckyBagRewardToast(null)}
          >
            <div
              className="w-full max-w-xs rounded-3xl bg-[#141928] border border-amber-400/40 p-5 text-center space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl">🧧</div>
              <div>
                <h3 className="text-sm font-bold text-white">تم استلام غنائم كيس الحظ</h3>
                <p className="text-xs text-slate-400 mt-1">
                  أُضيفت العملات إلى محفظتك والهدايا إلى حقيبتك
                </p>
              </div>
              <div className="py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 font-mono tabular-nums text-sm font-bold text-amber-300">
                +{luckyBagRewardToast.coinsWon.toLocaleString()} عملة
              </div>
              <div className="grid grid-cols-2 gap-2">
                {luckyBagRewardToast.giftsWon.map((g, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-white/5 border border-white/8 flex flex-col items-center"
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="text-[11px] text-white mt-0.5">{g.nameAr}</span>
                    <span className="text-[10px] font-mono tabular-nums text-emerald-400">
                      ×{g.count}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setLuckyBagRewardToast(null)}
                className="w-full h-10 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
              >
                تم
              </button>
            </div>
          </div>
        )}

        {rocketRewardPopup && (
          <div
            className="absolute inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setRocketRewardPopup(null)}
          >
            <div
              className="w-full max-w-xs rounded-3xl bg-[#141928] border border-amber-400/40 p-5 text-center space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-4xl">🚀</div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  اكتمل {rocketRewardPopup.nameAr} (Lv.{rocketRewardPopup.level})
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  تم إيداع المكافآت في المحفظة والحقيبة
                </p>
              </div>
              <div className="py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 font-mono tabular-nums text-sm font-bold text-amber-300">
                +{rocketRewardPopup.coinsWon.toLocaleString()} عملة
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rocketRewardPopup.giftsWon.map((gw, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-white/5 border border-white/8 flex flex-col items-center"
                  >
                    <span className="text-2xl">{gw.icon}</span>
                    <span className="text-[10px] text-white truncate w-full">{gw.nameAr}</span>
                    <span className="text-[10px] font-mono tabular-nums text-emerald-400">
                      ×{gw.count}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setRocketRewardPopup(null)}
                className="w-full h-10 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs"
              >
                حسناً
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
