import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic,
  MicOff,
  Smile,
  Volume2,
  VolumeX,
  Lock,
  Power,
  Minus,
  ChevronRight,
  Trophy,
  Check,
  Sparkles,
} from 'lucide-react';
import { RoomSeat, GiftItem } from '../types';
import { InteractiveGamesHub } from './InteractiveGamesHub';
import confetti from 'canvas-confetti';

interface LuckyWinBanner {
  id: string;
  userName: string;
  userAvatar: string;
  vipLevel: number;
  winCoins: number;
  multiplier: number;
  giftIcon: string;
  giftName: string;
  comboCount: number;
}

interface FlyingLuckyProjectile {
  id: string;
  seatIndex: number;
  giftIcon: string;
  targetX: number; // % from left
  targetY: number; // % from top
  phase: 'start' | 'flying' | 'burst';
}

interface ActiveGiftEffectState {
  id: string;
  gift: GiftItem;
  senderName: string;
  senderAvatar: string;
  targetNames: string;
  count: number;
  comboCount: number;
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
  senderAvatar: string;
  totalCoinsPool: number;
  rewardGifts: { giftId: string; nameAr: string; icon: string; count: number }[];
  timeLeftMs: number; // 10000ms (10 seconds) down to 0
  claimedByMe: boolean;
}

interface RoomGiftLog {
  id: string;
  type: 'lucky_win' | 'gift_throw' | 'game_win' | 'rocket_explosion' | 'lucky_bag_claim';
  senderName: string;
  senderAvatar: string;
  vipLevel: number;
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
  color: string;
}

const ROCKET_TIERS: RocketTierConfig[] = [
  {
    level: 1,
    nameAr: 'صاروخ الفضة المشتعل',
    icon: '🚀',
    targetCoins: 10000,
    rewardCoins: 5000,
    rewardBagGifts: [
      { giftId: 'gift_lollipop_lucky', count: 10 },
      { giftId: 'gift_rose', count: 15 },
      { giftId: 'gift_coffee', count: 5 },
    ],
    color: 'from-cyan-400 via-blue-500 to-indigo-600',
  },
  {
    level: 2,
    nameAr: 'صاروخ الذهب الملكي',
    icon: '🛸',
    targetCoins: 25000,
    rewardCoins: 15000,
    rewardBagGifts: [
      { giftId: 'gift_lollipop_lucky', count: 25 },
      { giftId: 'gift_pink_perfume', count: 5 },
      { giftId: 'gift_heart', count: 8 },
    ],
    color: 'from-amber-400 via-yellow-500 to-orange-600',
  },
  {
    level: 3,
    nameAr: 'صاروخ الماس الخارق',
    icon: '☄️',
    targetCoins: 50000,
    rewardCoins: 35000,
    rewardBagGifts: [
      { giftId: 'gift_halloween_candy', count: 5 },
      { giftId: 'gift_car', count: 2 },
      { giftId: 'gift_teddy', count: 6 },
    ],
    color: 'from-fuchsia-500 via-purple-500 to-indigo-600',
  },
  {
    level: 4,
    nameAr: 'صاروخ المجرة الكونية',
    icon: '🌌',
    targetCoins: 100000,
    rewardCoins: 75000,
    rewardBagGifts: [
      { giftId: 'gift_yacht', count: 2 },
      { giftId: 'gift_helicopter', count: 1 },
      { giftId: 'gift_treat_or_trick', count: 2 },
    ],
    color: 'from-rose-500 via-pink-500 to-purple-700',
  },
  {
    level: 5,
    nameAr: 'الصاروخ الإمبراطوري الأسطوري',
    icon: '👑',
    targetCoins: 250000,
    rewardCoins: 200000,
    rewardBagGifts: [
      { giftId: 'gift_dragon', count: 2 },
      { giftId: 'gift_palace', count: 2 },
      { giftId: 'gift_scorpion', count: 1 },
    ],
    color: 'from-yellow-300 via-amber-500 to-red-600',
  },
];

// ============================================================================
// CUSTOM 3D GLOSSY SVG ICONS FOR VOICE ROOM (Matches Screenshot #3 & Top Apps)
// ============================================================================
const Golden3DMicSvg: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-6 h-6 drop-shadow-[0_2px_6px_rgba(245,158,11,0.55)]">
    <defs>
      <linearGradient id="goldMicBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="45%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="goldMicShine" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Capsule */}
    <rect x="22" y="10" width="20" height="28" rx="10" fill="url(#goldMicBody)" />
    {/* Specular Highlight */}
    <rect x="25" y="13" width="6" height="18" rx="3" fill="url(#goldMicShine)" />
    {/* Grille Lines */}
    <line x1="22" y1="20" x2="42" y2="20" stroke="#78350f" strokeWidth="1.5" strokeOpacity="0.45" />
    <line x1="22" y1="26" x2="42" y2="26" stroke="#78350f" strokeWidth="1.5" strokeOpacity="0.45" />
    {/* U-Stand */}
    <path
      d="M16 26 C16 37, 48 37, 48 26"
      fill="none"
      stroke="url(#goldMicBody)"
      strokeWidth="4"
      strokeLinecap="round"
    />
    {/* Stem & Base */}
    <line x1="32" y1="36" x2="32" y2="48" stroke="url(#goldMicBody)" strokeWidth="4" strokeLinecap="round" />
    <path d="M22 48 L42 48" stroke="url(#goldMicBody)" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

const GiftBox3DSvg: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-8 h-8 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]">
    <defs>
      <linearGradient id="boxGrad3D" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="ribbonCyan3D" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#a5f3fc" />
        <stop offset="50%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0284c7" />
      </linearGradient>
    </defs>
    {/* Glowing Pedestal */}
    <ellipse cx="32" cy="54" rx="22" ry="5" fill="#38bdf8" fillOpacity="0.45" />
    {/* Box Base */}
    <rect x="14" y="26" width="36" height="25" rx="4" fill="url(#boxGrad3D)" stroke="#fef3c7" strokeWidth="1" />
    {/* Box Lid */}
    <rect x="11" y="19" width="42" height="9" rx="3" fill="url(#boxGrad3D)" stroke="#fef3c7" strokeWidth="1" />
    {/* Vertical & Horizontal Cyan 3D Ribbons */}
    <rect x="29" y="19" width="6" height="32" fill="url(#ribbonCyan3D)" />
    <rect x="14" y="34" width="36" height="5" fill="url(#ribbonCyan3D)" />
    {/* 3D Bow Loops */}
    <path
      d="M32 19 C24 10, 16 14, 24 20 Z"
      fill="url(#ribbonCyan3D)"
      stroke="#e0f2fe"
      strokeWidth="1"
    />
    <path
      d="M32 19 C40 10, 48 14, 40 20 Z"
      fill="url(#ribbonCyan3D)"
      stroke="#e0f2fe"
      strokeWidth="1"
    />
  </svg>
);

const Gamepad3DSvg: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-7 h-7 drop-shadow-[0_3px_8px_rgba(245,158,11,0.7)]">
    <defs>
      <linearGradient id="padGold3D" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#92400e" />
      </linearGradient>
    </defs>
    <path
      d="M16 22 H48 C54 22, 58 28, 56 38 L53 48 C51 53, 45 53, 42 47 L39 42 H25 L22 47 C19 53, 13 53, 11 48 L8 38 C6 28, 10 22, 16 22 Z"
      fill="url(#padGold3D)"
      stroke="#fef9c3"
      strokeWidth="1.5"
    />
    {/* D-Pad */}
    <path d="M20 29 V37 M16 33 H24" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    {/* Action Buttons */}
    <circle cx="44" cy="30" r="2.5" fill="#22d3ee" />
    <circle cx="48" cy="34" r="2.5" fill="#f43f5e" />
    <circle cx="40" cy="34" r="2.5" fill="#10b981" />
    <circle cx="44" cy="38" r="2.5" fill="#a855f7" />
  </svg>
);

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

  // Overlays & Drawers
  const [activeBottomDrawer, setActiveBottomDrawer] = useState<
    | 'none'
    | 'emoji'
    | 'gift'
    | 'game_center'
    | 'treasure_chest'
    | 'seat_menu'
    | 'top_ranking'
    | 'rocket'
    | 'lucky_bag_drawer'
  >('none');
  const [selectedSeatForMenu, setSelectedSeatForMenu] = useState<RoomSeat | null>(null);
  const [isRoomSoundMuted, setIsRoomSoundMuted] = useState(false);

  // Chat state
  const [chatTab, setChatTab] = useState<'all' | 'gifts' | 'message' | 'other'>('all');
  const [chatInput, setChatInput] = useState('');
  const [showChatInputBar, setShowChatInputBar] = useState(false);

  // =========================================================================
  // 1. LUCKY GIFTS: FLYING TO MICS + SPINNING RIBBONS VORTEX ("طشة الشرايط اللي بتلف")
  // =========================================================================
  const [flyingProjectiles, setFlyingProjectiles] = useState<FlyingLuckyProjectile[]>([]);
  const [seatBurstEffects, setSeatBurstEffects] = useState<
    Record<number, { icon: string; mult?: number }>
  >({});
  const [luckyBanner, setLuckyBanner] = useState<LuckyWinBanner | null>(null);
  const [spinningRibbonsBurst, setSpinningRibbonsBurst] = useState<{
    id: string;
    giftIcon: string;
    multiplier: number;
  } | null>(null);

  // =========================================================================
  // 2. REGULAR GIFTS: CLEAN 3D ANIME SHOWCASE (NO STARS / NO SOUND)
  // =========================================================================
  const [activeGiftEffect, setActiveGiftEffect] = useState<ActiveGiftEffectState | null>(null);

  // =========================================================================
  // 3. 10-SECOND ROOM LUCKY BAG ("كيس الحظ" - Appears 10s, Claim Gifts, Disappears)
  // =========================================================================
  const [activeLuckyBag, setActiveLuckyBag] = useState<ActiveLuckyBagState | null>(null);
  const [luckyBagClaimRewardModal, setLuckyBagClaimRewardModal] = useState<{
    coinsWon: number;
    giftsWon: { nameAr: string; icon: string; count: number }[];
  } | null>(null);

  // =========================================================================
  // 4. ROOM ROCKET SYSTEM (Charged ONLY by coins thrown in room + 24h Cooldown)
  // =========================================================================
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

  const [rocketExplosionStage, setRocketExplosionStage] = useState<
    'none' | 'launching' | 'exploding' | 'rewards'
  >('none');
  const [lastRocketRewardSummary, setLastRocketRewardSummary] = useState<{
    level: number;
    nameAr: string;
    coinsWon: number;
    giftsWon: { nameAr: string; icon: string; count: number }[];
  } | null>(null);

  // User's Bag Gifts inside Gift Drawer ("الحقيبة") — populated by Lucky Bags & Rocket explosions!
  const [bagGifts, setBagGifts] = useState<Record<string, number>>({});

  // Real-time Gift, Lucky, Lucky Bag & Rocket Logs in Room Chat
  const [roomEventLogs, setRoomEventLogs] = useState<RoomGiftLog[]>([]);

  // 2-Second Lower-Center Combo Button State
  const [comboState, setComboState] = useState<ComboState | null>(null);

  // Gift Drawer State
  const [giftDrawerTab, setGiftDrawerTab] = useState<
    'gifts' | 'lucky' | 'bag' | 'event' | 'cp' | 'celebrity'
  >('lucky');
  const [selectedGiftId, setSelectedGiftId] = useState<string>('gift_lollipop_lucky');
  const [giftCount, setGiftCount] = useState<number>(1);
  const [selectedRecipientSeats, setSelectedRecipientSeats] = useState<number[]>([0]);
  const [giftExpProgress, setGiftExpProgress] = useState<number>(172670);

  // Emoji Drawer State
  const [emojiCategory, setEmojiCategory] = useState<
    'classic' | 'panda' | 'capoo' | 'workday' | 'cute_panda' | 'river_horse'
  >('classic');
  const [seatEmojis, setSeatEmojis] = useState<Record<number, string>>({});

  // Treasure Chest State
  const [selectedChestTier, setSelectedChestTier] = useState<number>(2);
  const [chestProgress, setChestProgress] = useState<number>(52.18);

  // Local seat heart overrides for "مسح قيمة القلب"
  const [seatHeartsOverride, setSeatHeartsOverride] = useState<Record<number, number>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const effectTimeoutRef = useRef<number | null>(null);
  const ribbonTimeoutRef = useRef<number | null>(null);

  // =========================================================================
  // 10-SECOND LUCKY BAG COUNTDOWN TIMER (10000ms -> 0ms then disappears!)
  // =========================================================================
  useEffect(() => {
    if (!activeLuckyBag) return;

    const interval = window.setInterval(() => {
      setActiveLuckyBag((prev) => {
        if (!prev) return null;
        if (prev.timeLeftMs <= 100) {
          return null; // Automatically disappears after 10 seconds!
        }
        return {
          ...prev,
          timeLeftMs: prev.timeLeftMs - 100,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [Boolean(activeLuckyBag)]);

  // =========================================================================
  // 2-SECOND COMBO BUTTON COUNTDOWN TIMER (2000ms -> 0ms)
  // =========================================================================
  useEffect(() => {
    if (!comboState?.active) return;

    const interval = window.setInterval(() => {
      setComboState((prev) => {
        if (!prev) return null;
        if (prev.timeLeftMs <= 50) {
          return null; // Disappears automatically after 2 seconds without click
        }
        return {
          ...prev,
          timeLeftMs: prev.timeLeftMs - 50,
        };
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
      // ignore storage errors
    }
  }, [roomRocketStorageKey, rocketLevel, rocketCurrentSupport, rocketCooldownUntil]);

  // Live 1-second timer for 24-hour Rocket cooldown & automatic renewal after 24 hours
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

  if (!activeRoom) return null;

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
    : Math.min(
        100,
        Math.round((rocketCurrentSupport / currentRocketTier.targetCoins) * 100)
      );

  // Ensure 24 seats in 4 rows of 6 (or 5-per-row luxury layout)
  const all24Seats: RoomSeat[] = Array.from({ length: 24 }, (_, idx) => {
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

  const mySeat = all24Seats.find((s) => s.userId === currentUser.id);

  // Trigger Spinning Ribbons Splash ("طشة الشرايط اللي بتلف في التطبيق") ONLY for Lucky Gifts / Wins!
  const triggerSpinningRibbonsSplash = (giftIcon: string, multiplier: number) => {
    setSpinningRibbonsBurst({
      id: `ribbons_${Date.now()}`,
      giftIcon,
      multiplier,
    });

    // Long colorful swirling ribbons/streamers confetti (NOT stars)
    confetti({
      particleCount: 55,
      spread: 110,
      startVelocity: 38,
      shapes: ['square'],
      scalar: 1.25,
      ticks: 160,
      origin: { x: 0.5, y: 0.55 },
      colors: ['#f43f5e', '#fbbf24', '#22d3ee', '#a855f7', '#10b981', '#ec4899'],
    });

    if (ribbonTimeoutRef.current) window.clearTimeout(ribbonTimeoutRef.current);
    ribbonTimeoutRef.current = window.setTimeout(() => {
      setSpinningRibbonsBurst(null);
    }, 1800);
  };

  const formatHeartScore = (val: number) => {
    if (val === 0) return '0';
    if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  };

  const getTargetNamesLabel = (seatIndices: number[]) => {
    if (seatIndices.length === 0) return 'الجميع';
    if (seatIndices.length >= 12) return `كل الغرفة (${seatIndices.length})`;
    const names = seatIndices.map((idx) => {
      const s = all24Seats[idx];
      return s?.userName || `مايك ${idx + 1}`;
    });
    return names.length <= 2 ? names.join('، ') : `${names[0]} +${names.length - 1}`;
  };

  // Calculate exact screen coordinates (% X and % Y) for any of the 24 seats in the 6x4 RTL grid
  const getSeatScreenCoords = (seatIndex: number) => {
    const row = Math.floor(seatIndex / 6); // 0..3
    const col = seatIndex % 6; // 0..5 (RTL: col 0 is rightmost, col 5 is leftmost)
    const targetX = 88 - col * 15.2; // % from left
    const targetY = 16 + row * 11.2; // % from top
    return { targetX, targetY };
  };

  // =========================================================================
  // LAUNCH 10-SECOND LUCKY BAG IN ROOM ("كيس الحظ لمدة 10 ثواني")
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

    // Spawn the 10-second Lucky Bag in the room!
    setActiveLuckyBag({
      id: `lbag_${Date.now()}`,
      tierName,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      totalCoinsPool: rewardPoolCoins,
      rewardGifts: giftRewards,
      timeLeftMs: 10000, // 10 seconds!
      claimedByMe: false,
    });
  };

  // Claim gifts & coins from the active 10-second Lucky Bag before it disappears!
  const handleClaimLuckyBag = () => {
    if (!activeLuckyBag || activeLuckyBag.claimedByMe) return;

    const wonCoins = activeLuckyBag.totalCoinsPool;
    const wonGifts = activeLuckyBag.rewardGifts;

    // 1. Mark claimed & close floating bag
    setActiveLuckyBag(null);

    // 2. Credit coins & deposit gifts into user's Bag ("الحقيبة")
    rechargeCoins(wonCoins, `استلام هدايا ${activeLuckyBag.tierName}`);
    setBagGifts((prev) => {
      const next = { ...prev };
      wonGifts.forEach((g) => {
        next[g.giftId] = (next[g.giftId] || 0) + g.count;
      });
      return next;
    });

    // 3. Trigger Spinning Ribbons Splash & show reward summary
    triggerSpinningRibbonsSplash('🧧', 10);
    setLuckyBagClaimRewardModal({
      coinsWon: wonCoins,
      giftsWon: wonGifts.map((g) => ({
        nameAr: g.nameAr,
        icon: g.icon,
        count: g.count,
      })),
    });

    // 4. Log in room chat
    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setRoomEventLogs((prev) => [
      ...prev.slice(-25),
      {
        id: `log_lbag_${Date.now()}`,
        type: 'lucky_bag_claim',
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        vipLevel: currentUser.vipLevel,
        targetNames: activeLuckyBag.tierName,
        giftName: wonGifts.map((g) => `${g.icon} ${g.nameAr} ×${g.count}`).join(' + '),
        giftIcon: '🧧',
        giftCount: 1,
        comboHits: 1,
        winCoins: wonCoins,
        time: nowTime,
      },
    ]);
  };

  // =========================================================================
  // TRIGGER ROCKET LAUNCH & EXPLOSION SEQUENCE
  // =========================================================================
  const triggerRocketExplosion = (tierToExplode: RocketTierConfig, carryOverCoins = 0) => {
    setActiveBottomDrawer('none');
    setRocketExplosionStage('launching');

    // Stage 1 -> Stage 2 (Explosion at 1100ms)
    setTimeout(() => {
      setRocketExplosionStage('exploding');
      triggerSpinningRibbonsSplash(tierToExplode.icon, tierToExplode.level * 10);

      // Credit coins & Bag Gifts to currentUser
      rechargeCoins(tierToExplode.rewardCoins, `مكافأة انفجار ${tierToExplode.nameAr}`);

      const wonGiftsSummary: { nameAr: string; icon: string; count: number }[] = [];
      setBagGifts((prevBag) => {
        const nextBag = { ...prevBag };
        tierToExplode.rewardBagGifts.forEach((rg) => {
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

      setLastRocketRewardSummary({
        level: tierToExplode.level,
        nameAr: tierToExplode.nameAr,
        coinsWon: tierToExplode.rewardCoins,
        giftsWon: wonGiftsSummary,
      });

      const nowTime = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setRoomEventLogs((prev) => [
        ...prev.slice(-25),
        {
          id: 'log_rocket_' + Date.now(),
          type: 'rocket_explosion',
          senderName: currentUser.displayName,
          senderAvatar: currentUser.avatar,
          vipLevel: currentUser.vipLevel,
          targetNames: 'كل الغرفة',
          giftName: tierToExplode.nameAr,
          giftIcon: tierToExplode.icon,
          giftCount: 1,
          comboHits: tierToExplode.level,
          winCoins: tierToExplode.rewardCoins,
          time: nowTime,
        },
      ]);

      // Advance Rocket to Next Level OR Lock All 5 Rockets for 24 Hours!
      if (tierToExplode.level >= 5) {
        const lockUntil = Date.now() + 24 * 60 * 60 * 1000;
        setNowMs(Date.now());
        setRocketCooldownUntil(lockUntil);
        setRocketLevel(5);
        setPreviewRocketLevel(5);
        setRocketCurrentSupport(tierToExplode.targetCoins);
      } else {
        const nextLvl = tierToExplode.level + 1;
        setRocketLevel(nextLvl);
        setPreviewRocketLevel(nextLvl);
        setRocketCurrentSupport(carryOverCoins);
      }
    }, 1100);

    // Stage 2 -> Stage 3 (Show Rewards Card at 2200ms)
    setTimeout(() => {
      setRocketExplosionStage('rewards');
    }, 2200);
  };

  // Add support to Rocket ONLY from coins spent on gifts in the room
  const addSupportToRocket = (supportCoins: number) => {
    if (supportCoins <= 0) return;
    if (rocketCooldownUntil && Date.now() < rocketCooldownUntil) {
      return;
    }

    setRocketCurrentSupport((prev) => {
      const nextVal = prev + supportCoins;
      if (nextVal >= currentRocketTier.targetCoins && rocketExplosionStage === 'none') {
        const excessCoins = Math.max(0, nextVal - currentRocketTier.targetCoins);
        setTimeout(() => {
          triggerRocketExplosion(currentRocketTier, excessCoins);
        }, 300);
        return currentRocketTier.targetCoins;
      }
      return nextVal;
    });
  };

  // =========================================================================
  // LAUNCH LUCKY PROJECTILES FROM BOTTOM TO EACH TARGETED SEAT MIC
  // =========================================================================
  const launchLuckyProjectilesToMics = (
    gift: GiftItem,
    targetSeats: number[],
    chosenMult: number
  ) => {
    const batchId = 'proj_' + Date.now() + '_' + Math.random();
    const newProjectiles: FlyingLuckyProjectile[] = targetSeats.map((seatIdx) => {
      const { targetX, targetY } = getSeatScreenCoords(seatIdx);
      return {
        id: `${batchId}_${seatIdx}`,
        seatIndex: seatIdx,
        giftIcon: gift.icon,
        targetX,
        targetY,
        phase: 'start',
      };
    });

    setFlyingProjectiles((prev) => [...prev, ...newProjectiles]);

    requestAnimationFrame(() => {
      setTimeout(() => {
        setFlyingProjectiles((prev) =>
          prev.map((p) => (p.id.startsWith(batchId) ? { ...p, phase: 'flying' } : p))
        );
      }, 25);
    });

    // When projectile reaches the user's mic (after 580ms), burst on the seat & disappear!
    setTimeout(() => {
      setFlyingProjectiles((prev) => prev.filter((p) => !p.id.startsWith(batchId)));

      setSeatBurstEffects((prev) => {
        const next = { ...prev };
        targetSeats.forEach((sIdx) => {
          next[sIdx] = { icon: gift.icon, mult: chosenMult };
        });
        return next;
      });

      setTimeout(() => {
        setSeatBurstEffects((prev) => {
          const copy = { ...prev };
          targetSeats.forEach((sIdx) => {
            delete copy[sIdx];
          });
          return copy;
        });
      }, 950);
    }, 600);
  };

  // =========================================================================
  // CORE GIFT & LUCKY GIFT EXECUTION
  // =========================================================================
  const executeGiftThrow = (
    gift: GiftItem,
    count: number,
    targetSeats: number[],
    comboHits: number,
    fromBag = false
  ) => {
    const cleanTargets = targetSeats.length > 0 ? targetSeats : [0];
    const targetLabel = getTargetNamesLabel(cleanTargets);
    const totalNeededCount = count * cleanTargets.length;

    if (fromBag) {
      const ownedCount = bagGifts[gift.id] || 0;
      if (ownedCount <= 0) {
        return;
      }
      const deductCount = Math.min(ownedCount, totalNeededCount);
      setBagGifts((prev) => {
        const next = { ...prev };
        if (next[gift.id] <= deductCount) {
          delete next[gift.id];
        } else {
          next[gift.id] -= deductCount;
        }
        return next;
      });
    } else {
      const sentOk = sendGift(gift.id, count, 'seat', cleanTargets[0], cleanTargets);
      if (!sentOk) {
        return;
      }
    }

    // Clear any local heart override on the targeted seats
    setSeatHeartsOverride((prev) => {
      const next = { ...prev };
      cleanTargets.forEach((idx) => {
        delete next[idx];
      });
      return next;
    });

    // Advance Gift Level, Treasure Chest & Room Rocket Support (ONLY from coins thrown in room!)
    const totalGiftValue = gift.coinPrice * count * cleanTargets.length;
    setGiftExpProgress((p) => Math.min(263990, p + Math.max(250, Math.round(totalGiftValue * 0.5))));
    setChestProgress((p) =>
      Math.min(60, Number((p + Math.max(0.05, totalGiftValue / 50000)).toFixed(2)))
    );
    if (!fromBag) {
      addSupportToRocket(totalGiftValue);
    }

    const isLuckyGift =
      gift.isLucky || gift.category === 'lucky' || gift.animationType === 'lollipop_matrix';

    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isLuckyGift) {
      // =====================================================================
      // A. LUCKY GIFT: Fly from Bottom to Mic + Spinning Ribbons Burst ("طشة الشرايط اللي بتلف")
      // =====================================================================
      const multPool = comboHits >= 5 ? [18, 66, 188, 500] : [8, 18, 66, 188];
      const chosenMult = multPool[Math.floor(Math.random() * multPool.length)];
      const rawWin = gift.coinPrice * chosenMult * count;
      const winCoins = rawWin > 1000000 ? 188000 : rawWin;

      // 1. Launch smooth flying projectiles from bottom center to each target seat mic!
      launchLuckyProjectilesToMics(gift, cleanTargets, chosenMult);

      // 2. Trigger Spinning Ribbons Splash ("طشة الشرايط اللي بتلف في التطبيق")
      triggerSpinningRibbonsSplash(gift.icon, chosenMult);

      // 3. Credit lucky win coins to currentUser
      rechargeCoins(winCoins, 'ربح هدية الحظ');

      // 4. Show Golden Winged Multiplier Banner at top of room
      setLuckyBanner({
        id: 'lb_' + Date.now() + '_' + comboHits,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatar,
        vipLevel: currentUser.vipLevel,
        winCoins,
        multiplier: chosenMult,
        giftIcon: gift.icon,
        giftName: gift.nameAr,
        comboCount: comboHits,
      });

      // 5. Add Golden Lucky Win Card to Room Chat
      setRoomEventLogs((prev) => [
        ...prev.slice(-25),
        {
          id: 'log_lucky_' + Date.now() + '_' + Math.random(),
          type: 'lucky_win',
          senderName: currentUser.displayName,
          senderAvatar: currentUser.avatar,
          vipLevel: currentUser.vipLevel,
          targetNames: targetLabel,
          giftName: gift.nameAr,
          giftIcon: gift.icon,
          giftCount: count,
          comboHits,
          winCoins,
          multiplier: chosenMult,
          time: nowTime,
        },
      ]);
    } else {
      // =====================================================================
      // B. REGULAR GIFT: Clean 3D Anime Visual Showcase (NO STARS / NO SOUND!)
      // =====================================================================
      setActiveGiftEffect({
        id: 'ge_' + Date.now() + '_' + comboHits,
        gift,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        targetNames: targetLabel,
        count,
        comboCount: comboHits,
      });

      setRoomEventLogs((prev) => [
        ...prev.slice(-25),
        {
          id: 'log_gift_' + Date.now() + '_' + Math.random(),
          type: 'gift_throw',
          senderName: currentUser.displayName,
          senderAvatar: currentUser.avatar,
          vipLevel: currentUser.vipLevel,
          targetNames: targetLabel,
          giftName: gift.nameAr,
          giftIcon: gift.icon,
          giftCount: count,
          comboHits,
          time: nowTime,
        },
      ]);

      if (effectTimeoutRef.current) window.clearTimeout(effectTimeoutRef.current);
      effectTimeoutRef.current = window.setTimeout(() => {
        setActiveGiftEffect(null);
      }, 2200);
    }
  };

  // Triggered when user clicks "إرسال" inside Gift Drawer
  const handleSendSelectedGift = () => {
    const giftObj = gifts.find((g) => g.id === selectedGiftId) || gifts[0];
    const targets = selectedRecipientSeats.length > 0 ? selectedRecipientSeats : [0];
    const isFromBag = giftDrawerTab === 'bag' && (bagGifts[giftObj.id] || 0) > 0;

    // 1. Close the Gift Drawer immediately
    setActiveBottomDrawer('none');

    // 2. Execute the first gift throw (Combo X1)
    executeGiftThrow(giftObj, giftCount, targets, 1, isFromBag);

    // 3. Show the 2-Second Lower-Center Combo Button
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

  // Triggered every time user taps the Lower-Center Combo Button within 2 seconds
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

  // Filter gifts in Gift Drawer by selected tab
  const filteredDrawerGifts = gifts.filter((g) => {
    if (giftDrawerTab === 'lucky') {
      return g.isLucky || g.category === 'lucky' || g.animationType === 'lollipop_matrix';
    }
    if (giftDrawerTab === 'gifts') {
      return g.category === 'classic' || g.category === 'romantic' || g.category === 'luxury';
    }
    if (giftDrawerTab === 'event') {
      return g.category === 'magic' || g.coinPrice >= 50000;
    }
    if (giftDrawerTab === 'cp') {
      return (
        g.category === 'romantic' ||
        g.id.includes('heart') ||
        g.id.includes('rose') ||
        g.id.includes('teddy')
      );
    }
    if (giftDrawerTab === 'celebrity') {
      return (
        g.category === 'luxury' ||
        g.category === 'vip' ||
        g.category === 'celebrity' ||
        g.coinPrice >= 15000
      );
    }
    if (giftDrawerTab === 'bag') {
      return (bagGifts[g.id] || 0) > 0;
    }
    return true;
  });

  const handleSendEmojiToMySeat = (emoji: string) => {
    const mySeatIndex = all24Seats.findIndex((s) => s.userId === currentUser.id);
    const targetIdx = mySeatIndex >= 0 ? mySeatIndex : 0;
    if (mySeatIndex < 0) {
      takeSeat(0);
    }
    setSeatEmojis((prev) => ({ ...prev, [targetIdx]: emoji }));
    setActiveBottomDrawer('none');
    setTimeout(() => {
      setSeatEmojis((prev) => {
        const copy = { ...prev };
        delete copy[targetIdx];
        return copy;
      });
    }, 4000);
  };

  const handleClearHeartValue = (seatIndex: number) => {
    setSeatHeartsOverride((prev) => ({ ...prev, [seatIndex]: 0 }));
    setActiveBottomDrawer('none');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendRoomMessage(chatInput.trim());
    setChatInput('');
    setShowChatInputBar(false);
  };

  const emojiSets: Record<typeof emojiCategory, string[]> = {
    classic: ['🤢', '😴', '🙂', '😊', '😒', '😔', '😤', '😮', '😂', '😄', '😁', '😆', '😍', '😎', '😡', '🥳'],
    panda: ['🐼', '🎋', '🐾', '💤', '🥊', '🍜', '🤪', '🥰', '🤩', '😭', '🫣', '🤗', '🫡', '👑', '🔥', '💖'],
    capoo: ['🐱', '🐛', '🩵', '🍖', '🐟', '✨', '🌈', '🎉', '😺', '😻', '🙀', '😿', '😾', '🫶', '💥', '🍭'],
    workday: ['☕', '💻', '📈', '💸', '⏰', '🤯', '🥱', '💼', '📞', '📝', '🏆', '🚀', '🤝', '🎯', '🥂', '💰'],
    cute_panda: ['🧸', '🌸', '🍓', '🎀', '🍼', '🌙', '⭐', '🫧', '🥺', '🥹', '😚', '🤭', '💌', '🎁', '🧁', '🦄'],
    river_horse: ['🦛', '💦', '🍉', '🌴', '🛟', '🕶️', '🍹', '🏖️', '🌊', '🪩', '💃', '🕺', '🎶', '🥁', '🎸', '🎤'],
  };

  const visibleEventLogs = roomEventLogs.filter((log) => {
    if (chatTab === 'all') return true;
    if (chatTab === 'gifts') return log.type === 'lucky_win' || log.type === 'gift_throw';
    if (chatTab === 'other')
      return (
        log.type === 'game_win' ||
        log.type === 'rocket_explosion' ||
        log.type === 'lucky_bag_claim'
      );
    return false;
  });

  const visibleTextMessages = activeRoomMessages.filter((msg) => {
    if (chatTab === 'all') return true;
    if (chatTab === 'message') return !msg.isSystem && !msg.giftData;
    if (chatTab === 'gifts') return Boolean(msg.giftData);
    if (chatTab === 'other') return Boolean(msg.isSystem);
    return true;
  });

  return (
    <div className="relative min-h-screen max-w-md mx-auto bg-[#1a0f0a] text-white flex flex-col justify-between overflow-hidden font-tajawal select-none shadow-2xl">
      
      {/* Warm European Cafe / Lounge 3D Atmospheric Wallpaper (Matches Screenshot #3) */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50 scale-105"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1000&q=80)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#1e120a]/75 via-[#170d07]/65 to-[#100804]/90 pointer-events-none" />

      {/* ===================================================================== */}
      {/* FLYING LUCKY GIFT PROJECTILES (Launch from Bottom -> Fly to Mic!)     */}
      {/* ===================================================================== */}
      <div className="fixed inset-0 max-w-md mx-auto z-40 pointer-events-none overflow-hidden">
        {flyingProjectiles.map((proj) => (
          <div
            key={proj.id}
            style={{
              position: 'absolute',
              left: proj.phase === 'start' ? '50%' : `${proj.targetX}%`,
              top: proj.phase === 'start' ? '85%' : `${proj.targetY}%`,
              transform:
                proj.phase === 'start'
                  ? 'translate(-50%, -50%) scale(0.7)'
                  : 'translate(-50%, -50%) scale(1.25)',
              transition:
                'left 560ms cubic-bezier(0.22, 1, 0.36, 1), top 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 560ms ease-out',
            }}
            className="flex flex-col items-center"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-pink-500 via-amber-300 to-cyan-400 p-0.5 shadow-[0_0_25px_rgba(236,72,153,0.95)] border-2 border-white flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-slate-950/60 flex items-center justify-center text-2xl">
                {proj.giftIcon}
              </div>
            </div>
            <div className="w-2 h-8 bg-gradient-to-b from-amber-300 via-pink-500/70 to-transparent rounded-full blur-[1px] -mt-1" />
          </div>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* SPINNING RIBBONS VORTEX FOR LUCKY GIFTS ("طشة الشرايط اللي بتلف")       */}
      {/* ===================================================================== */}
      {spinningRibbonsBurst && (
        <div className="fixed inset-0 max-w-md mx-auto z-40 pointer-events-none flex items-center justify-center overflow-hidden">
          <div className="relative w-72 h-72 flex items-center justify-center animate-in zoom-in-50 duration-200">
            {/* Rotating Ribbon Ring 1 */}
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-amber-400/80 animate-spin" style={{ animationDuration: '2.2s' }} />
            {/* Rotating Ribbon Ring 2 (Reverse) */}
            <div className="absolute inset-4 rounded-full border-4 border-dotted border-pink-500/80 animate-spin" style={{ animationDuration: '1.6s', animationDirection: 'reverse' }} />
            {/* Rotating Ribbon Streamers */}
            <div className="absolute inset-8 rounded-full border-2 border-cyan-400/70 animate-spin flex items-center justify-between px-2" style={{ animationDuration: '1.2s' }}>
              <span className="text-2xl">🎗️</span>
              <span className="text-2xl">🎀</span>
              <span className="text-2xl">🎗️</span>
              <span className="text-2xl">🎊</span>
            </div>
            {/* Center Lucky Multiplier Core */}
            <div className="relative z-10 px-5 py-2.5 rounded-3xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 border-2 border-yellow-200 shadow-[0_0_40px_rgba(245,158,11,0.95)] flex flex-col items-center">
              <span className="text-4xl">{spinningRibbonsBurst.giftIcon}</span>
              <span className="text-base font-black text-white drop-shadow">
                ضربة حظ ×{spinningRibbonsBurst.multiplier}! 🎊
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10-SECOND FLOATING LUCKY BAG IN ROOM ("كيس الحظ يظهر لمدة 10 ثواني")   */}
      {/* ===================================================================== */}
      {activeLuckyBag && (
        <div className="fixed top-28 inset-x-0 max-w-md mx-auto z-45 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto w-full max-w-xs rounded-3xl bg-gradient-to-r from-red-900/95 via-rose-700/95 to-amber-700/95 border-2 border-amber-300 p-3 shadow-[0_0_35px_rgba(245,158,11,0.85)] flex items-center justify-between gap-3 animate-in zoom-in-90 duration-200">
            
            {/* Left: Claim Button & 10-Second Countdown */}
            <button
              onClick={handleClaimLuckyBag}
              className="px-3.5 py-2 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 text-slate-950 font-black text-xs shadow-lg active:scale-90 transition-transform shrink-0 flex flex-col items-center"
            >
              <span>استلام الهدايا 🎁</span>
              <span className="text-[10px] font-mono font-black text-red-950">
                {(activeLuckyBag.timeLeftMs / 1000).toFixed(1)}s ⏳
              </span>
            </button>

            {/* Center: Lucky Bag Info & Progress Bar */}
            <div className="flex-1 text-right space-y-1">
              <div className="flex items-center justify-end gap-1">
                <span className="px-2 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px]">
                  يختفي خلال {Math.ceil(activeLuckyBag.timeLeftMs / 1000)} ثواني
                </span>
                <span className="text-xs font-black text-yellow-200">
                  {activeLuckyBag.tierName}
                </span>
              </div>
              <div className="text-[10px] text-amber-100">
                أرسله <span className="font-black text-white">{activeLuckyBag.senderName}</span> • استلم هدايا وكوينزات فورية!
              </div>
              {/* 10s Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-black/50 overflow-hidden border border-amber-300/40">
                <div
                  className="h-full bg-gradient-to-r from-yellow-300 to-emerald-400 transition-all duration-100 ease-linear"
                  style={{ width: `${(activeLuckyBag.timeLeftMs / 10000) * 100}%` }}
                />
              </div>
            </div>

            {/* Right: 3D Shaking Lucky Bag Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-red-600 p-0.5 shadow-lg flex items-center justify-center shrink-0 animate-bounce">
              <div className="w-full h-full rounded-[14px] bg-red-950/80 flex items-center justify-center text-3xl">
                🧧
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LUCKY BAG CLAIMED REWARDS POPUP                                       */}
      {/* ===================================================================== */}
      {luckyBagClaimRewardModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLuckyBagClaimRewardModal(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-red-950 via-[#240a15] to-slate-950 border-2 border-amber-400 p-5 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.7)] animate-in zoom-in-90 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-red-600 p-1 shadow-xl flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-red-950 flex items-center justify-center text-4xl">
                🧧
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-amber-300">
                مبروك! استلمت غنائم كيس الحظ 🎉
              </h3>
              <p className="text-[11px] text-amber-100/80 mt-0.5">
                تمت إضافة الهدايا إلى حقيبتك والكوينزات إلى محفظتك:
              </p>
            </div>

            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center gap-2">
              <span className="text-xl">🪙</span>
              <span className="text-sm font-mono font-black text-amber-300">
                +{luckyBagClaimRewardModal.coinsWon.toLocaleString()} كوينز
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {luckyBagClaimRewardModal.giftsWon.map((g, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-2xl bg-white/5 border border-pink-400/40 flex flex-col items-center"
                >
                  <span className="text-2xl">{g.icon}</span>
                  <span className="text-[10px] font-bold text-white mt-0.5">{g.nameAr}</span>
                  <span className="text-xs font-black text-emerald-400">×{g.count} بالحقيبة</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setLuckyBagClaimRewardModal(null);
                  setGiftDrawerTab('bag');
                  setActiveBottomDrawer('gift');
                }}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs"
              >
                فتح الحقيبة 🎒
              </button>
              <button
                onClick={() => setLuckyBagClaimRewardModal(null)}
                className="px-4 py-2.5 rounded-2xl bg-white/10 text-stone-200 font-bold text-xs"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FULL-SCREEN 3D ROCKET LAUNCH & EXPLOSION OVERLAY                      */}
      {/* ===================================================================== */}
      {rocketExplosionStage !== 'none' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-4">
          {rocketExplosionStage === 'launching' && (
            <div className="flex flex-col items-center animate-in slide-in-from-bottom duration-700">
              <div className="text-8xl animate-bounce drop-shadow-[0_0_40px_rgba(245,158,11,0.9)]">
                🚀
              </div>
              <div className="w-6 h-28 bg-gradient-to-b from-yellow-300 via-orange-500 to-transparent rounded-full blur-xs -mt-2 animate-pulse" />
              <div className="mt-4 text-xl font-black text-amber-300">
                انطلاق {currentRocketTier.nameAr} نحو الفضاء! 🔥
              </div>
            </div>
          )}

          {rocketExplosionStage === 'exploding' && (
            <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
              <div className="w-56 h-56 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-[0_0_90px_rgba(251,191,36,1)] animate-ping">
                <span className="text-8xl">💥</span>
              </div>
              <div className="mt-6 text-2xl font-black text-yellow-300 drop-shadow">
                انفجار الصاروخ العظيم وتوزيع الغنائم! 🎆🎁
              </div>
            </div>
          )}

          {rocketExplosionStage === 'rewards' && lastRocketRewardSummary && (
            <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#2b133d] via-[#190a26] to-[#0f0517] border-2 border-amber-400 p-5 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.6)] animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-400 via-yellow-300 to-rose-500 p-1 shadow-xl flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#190a26] flex items-center justify-center text-4xl">
                  🚀
                </div>
              </div>

              <div>
                <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                  مكافآت المستوى {lastRocketRewardSummary.level}
                </span>
                <h3 className="text-lg font-black text-white mt-1">
                  انفجر {lastRocketRewardSummary.nameAr}!
                </h3>
                <p className="text-xs text-amber-200 mt-0.5">
                  تم إيداع الكوينزات وهدايا الحقيبة المجانية في حسابك فوراً:
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-500/20 border border-amber-400/60 flex items-center justify-center gap-2">
                <span className="text-2xl">🪙</span>
                <span className="text-lg font-mono font-black text-amber-300">
                  +{lastRocketRewardSummary.coinsWon.toLocaleString()} كوينز مكافأة
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="text-xs font-black text-pink-300">
                  🎒 هدايا أضيفت إلى حقيبتك (في صندوق الهدايا):
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {lastRocketRewardSummary.giftsWon.map((gw, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-2xl bg-white/5 border border-pink-400/40 flex flex-col items-center"
                    >
                      <span className="text-2xl">{gw.icon}</span>
                      <span className="text-[10px] font-bold text-white truncate w-full">
                        {gw.nameAr}
                      </span>
                      <span className="text-xs font-black text-emerald-400">×{gw.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setRocketExplosionStage('none');
                    setGiftDrawerTab('bag');
                    setActiveBottomDrawer('gift');
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-amber-500 text-white font-black text-xs shadow-lg"
                >
                  فتح الحقيبة وإرسال الهدايا 🎒
                </button>
                <button
                  onClick={() => setRocketExplosionStage('none')}
                  className="px-4 py-2.5 rounded-2xl bg-white/10 text-stone-200 font-bold text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* PROFESSIONAL LOWER-CENTER 2-SECOND COMBO BUTTON (كومبو COMBO)         */}
      {/* ===================================================================== */}
      {comboState && comboState.active && (
        <div className="fixed bottom-16 inset-x-0 max-w-md mx-auto z-50 pointer-events-none flex flex-col items-center justify-end pb-1">
          <div className="pointer-events-auto flex flex-col items-center animate-in slide-in-from-bottom-4 duration-150">
            <div className="mb-1.5 px-3 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center gap-1.5">
              <span className="text-sm">{comboState.gift.icon}</span>
              <span className="text-[10px] font-bold text-amber-200">
                {getTargetNamesLabel(comboState.targetSeats)}
              </span>
              <span className="px-2 py-0.2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-[11px] shadow">
                COMBO X{comboState.comboHits}
              </span>
            </div>

            <button
              onClick={handleComboClick}
              className="relative w-22 h-22 rounded-full flex items-center justify-center active:scale-90 transition-transform group cursor-pointer"
            >
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-cyan-400 opacity-75 blur-xs animate-pulse" />

              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="url(#comboCoreGrad)"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="url(#comboRingGrad)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={276}
                  strokeDashoffset={276 - (276 * comboState.timeLeftMs) / 2000}
                  className="transition-all duration-75 ease-linear"
                />
                <defs>
                  <radialGradient id="comboCoreGrad" cx="50%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#3b1d5e" />
                    <stop offset="100%" stopColor="#12091c" />
                  </radialGradient>
                  <linearGradient id="comboRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="relative z-10 flex flex-col items-center justify-center text-center">
                <span className="text-2xl group-active:scale-125 transition-transform drop-shadow">
                  {comboState.gift.icon}
                </span>
                <span className="text-[11px] font-black text-amber-300 leading-none mt-0.5">
                  كومبو
                </span>
                <span className="text-[9px] font-mono font-black text-cyan-300 mt-0.5">
                  {(comboState.timeLeftMs / 1000).toFixed(1)}s
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* CLEAN 3D ANIME SHOWCASE FOR REGULAR GIFTS (NO STARS / NO SOUND!)      */}
      {/* ===================================================================== */}
      {activeGiftEffect && (
        <div className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center px-4">
          <div className="relative flex flex-col items-center animate-in zoom-in-90 duration-200">
            {/* Sleek 3D Pedestal Aura (No flying stars/particles) */}
            <div
              className="w-36 h-36 rounded-3xl flex items-center justify-center border-2 border-amber-300/80 shadow-[0_12px_45px_rgba(0,0,0,0.85)]"
              style={{
                background: `linear-gradient(145deg, ${activeGiftEffect.gift.accentColor || '#f59e0b'}55 0%, rgba(15,10,25,0.92) 90%)`,
              }}
            >
              <span className="text-7xl drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)]">
                {activeGiftEffect.gift.icon}
              </span>
            </div>

            {/* Royal Gift Streamer Banner */}
            <div className="mt-2.5 px-5 py-2 rounded-full bg-gradient-to-r from-slate-950/95 via-[#26160a]/95 to-slate-950/95 border border-amber-400/80 shadow-2xl flex items-center gap-3">
              <img
                src={activeGiftEffect.senderAvatar}
                alt={activeGiftEffect.senderName}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400"
              />
              <div className="text-right">
                <div className="text-xs font-black text-amber-300">
                  {activeGiftEffect.senderName} ⬅️ {activeGiftEffect.targetNames}
                </div>
                <div className="text-[11px] font-bold text-white">
                  أهدى {activeGiftEffect.gift.nameAr} × {activeGiftEffect.count}
                </div>
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs shadow">
                X{activeGiftEffect.comboCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. TOP ROOM HEADER & LUCKY GOLDEN WINGS BANNER (Screenshot #3 Style)  */}
      {/* ===================================================================== */}
      <div className="relative z-30 pt-2.5 px-3 space-y-1.5">
        <div className="flex items-center justify-between">
          {/* Left Controls: Power Exit & Minimize */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={leaveRoom}
              className="w-8 h-8 rounded-full bg-black/50 border border-white/15 flex items-center justify-center text-white/90 hover:bg-rose-600/80 transition-colors shadow"
              title="خروج من الغرفة"
            >
              <Power className="w-4 h-4" />
            </button>
            <button
              onClick={leaveRoom}
              className="w-8 h-8 rounded-full bg-black/50 border border-white/15 flex items-center justify-center text-white/90 hover:bg-white/20 transition-colors shadow"
              title="تصغير الغرفة"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Right Room Identity Pill (Matches Screenshot #3: tyy's room, ID, Avatar) */}
          <div className="flex items-center gap-2 bg-black/55 backdrop-blur-md pl-3 pr-1.5 py-1 rounded-2xl border border-amber-400/25 shadow-lg">
            <div className="text-right">
              <div className="text-xs font-black text-white leading-tight">
                {activeRoom.title}
              </div>
              <div className="text-[10px] font-mono text-stone-300 leading-tight">
                ID:{activeRoom.roomNo || '6919142'}
              </div>
            </div>
            <img
              src={activeRoom.ownerAvatar || currentUser.avatar}
              alt={activeRoom.ownerName}
              className="w-9 h-9 rounded-xl object-cover border border-amber-300/60"
            />
          </div>
        </div>

        {/* Sub-Header Row: Online Viewers on Left + Music & Trophy Score on Right (Screenshot #3) */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-black/55 border border-white/20 flex items-center justify-center text-[10px] font-black text-white">
              {activeRoom.onlineViewersCount || 1}
            </span>
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              onClick={() => {
                setViewingProfileUser(currentUser);
                setActiveModal('profile');
              }}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-amber-400 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Music Pill */}
            <button
              onClick={() => setActiveBottomDrawer('lucky_bag_drawer')}
              className="px-3 py-1 rounded-full bg-gradient-to-r from-red-600/80 to-amber-600/80 border border-amber-300/60 flex items-center gap-1.5 text-[11px] font-black text-white shadow active:scale-95 transition-transform"
            >
              <span>🧧</span>
              <span>إطلاق كيس الحظ (10ث)</span>
            </button>

            {/* Trophy Score Pill */}
            <button
              onClick={() => setActiveBottomDrawer('top_ranking')}
              className="px-3 py-1 rounded-full bg-black/55 border border-amber-400/30 flex items-center gap-1.5 text-xs font-mono font-black text-amber-300 active:scale-95 transition-transform"
            >
              <span>{activeRoom.totalDiamondsEarned.toLocaleString()}</span>
              <span>🏆</span>
            </button>
          </div>
        </div>

        {/* Lucky Multiplier Golden Winged Banner */}
        {luckyBanner && (
          <div className="relative mx-auto w-full max-w-[355px] h-11 rounded-full bg-gradient-to-r from-amber-600/95 via-yellow-400/95 to-amber-600/95 border-2 border-yellow-100 shadow-[0_0_25px_rgba(251,191,36,0.75)] flex items-center justify-between px-3 animate-in fade-in zoom-in-95 duration-200">
            <span className="text-lg drop-shadow">🪽</span>
            <div className="flex items-center gap-1.5 text-slate-950 font-black text-[11px] truncate">
              <img
                src={luckyBanner.userAvatar}
                alt={luckyBanner.userName}
                className="w-6 h-6 rounded-full object-cover border border-slate-900"
              />
              <span className="truncate max-w-[85px]">{luckyBanner.userName}</span>
              <span>ربح</span>
              <span className="text-red-700 font-mono text-xs font-black">
                {luckyBanner.winCoins.toLocaleString()}
              </span>
              <span>كوينز ({luckyBanner.multiplier}X)</span>
              <span className="text-base">{luckyBanner.giftIcon}</span>
            </div>
            <span className="text-lg drop-shadow">🪽</span>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 2. 24-SEAT VOICE STAGE WITH 3D GOLDEN CONDENSER MICS (Screenshot #3)  */}
      {/* ===================================================================== */}
      <div className="relative z-20 px-2 pt-1">
        <div className="grid grid-cols-6 gap-x-1 gap-y-2 place-items-center">
          {all24Seats.map((seat, idx) => {
            const heartVal =
              seatHeartsOverride[idx] !== undefined
                ? seatHeartsOverride[idx]
                : seat.heartPoints || 0;
            const activeEmoji = seatEmojis[idx];
            const isTargetedInGiftDrawer = selectedRecipientSeats.includes(idx);
            const burstOnSeat = seatBurstEffects[idx];

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedSeatForMenu(seat);
                  setActiveBottomDrawer('seat_menu');
                }}
                className="relative flex flex-col items-center cursor-pointer group select-none"
              >
                {/* Lucky Projectile Impact Burst on Target Mic Seat */}
                {burstOnSeat && (
                  <div className="absolute -inset-2 z-40 pointer-events-none flex flex-col items-center justify-center animate-in zoom-in-50 duration-150">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500/80 via-amber-400/80 to-cyan-300/80 border-2 border-white flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(236,72,153,1)] animate-ping" />
                    <span className="absolute -top-3 px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black text-[9px] shadow">
                      {burstOnSeat.icon} +{burstOnSeat.mult}X
                    </span>
                  </div>
                )}

                {/* Active Animated Emoji over Seat */}
                {activeEmoji && (
                  <div className="absolute -top-3 z-40 text-3xl animate-bounce drop-shadow-lg">
                    {activeEmoji}
                  </div>
                )}

                {/* 3D Double-Ring Golden Condenser Mic Sphere (Matches Screenshot #3!) */}
                <div className="relative w-12 h-12 rounded-full flex items-center justify-center">
                  {seat.isSpeaking && !seat.isMuted && (
                    <div className="absolute -inset-0.5 rounded-full border-2 border-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.85)]" />
                  )}

                  {comboState?.active && isTargetedInGiftDrawer && (
                    <div className="absolute -inset-1 rounded-full border-2 border-pink-400 animate-pulse" />
                  )}

                  <div className="w-11 h-11 rounded-full p-[1.5px] bg-gradient-to-b from-amber-200 via-amber-500 to-amber-800 shadow-[0_4px_12px_rgba(0,0,0,0.65)] group-hover:scale-105 transition-transform">
                    {seat.userAvatar ? (
                      <img
                        src={seat.userAvatar}
                        alt={seat.userName || `Seat ${idx + 1}`}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2b1d12]/90 to-[#140c06]/95 border border-amber-300/30 flex items-center justify-center shadow-inner">
                        <Golden3DMicSvg />
                      </div>
                    )}
                  </div>

                  {seat.userId && seat.isMuted && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-600 border border-white flex items-center justify-center">
                      <MicOff className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}

                  {seat.isLocked && (
                    <div className="absolute inset-0 rounded-full bg-black/65 flex items-center justify-center">
                      <Lock className="w-4 h-4 text-amber-400" />
                    </div>
                  )}
                </div>

                {/* Seat Number Pill or User Name Underneath (Matches Screenshot #3) */}
                <div className="mt-1 px-2 py-0.2 rounded-full bg-black/55 border border-white/10 text-[9px] font-black text-stone-200 max-w-[54px] truncate leading-tight">
                  {seat.userName ? seat.userName : idx + 1}
                </div>

                {heartVal > 0 && (
                  <div className="mt-0.5 flex items-center gap-0.5 px-1.5 py-0.1 rounded-full bg-pink-950/70 border border-pink-400/30 text-[8px] font-bold text-pink-200 leading-tight">
                    <span>{formatHeartScore(heartVal)}</span>
                    <span>💗</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. CHAT FILTER PILLS & LEFT 3D FLOATING WIDGETS (Screenshot #3 Style) */}
      {/* ===================================================================== */}
      <div className="relative z-20 flex-1 flex flex-col justify-end px-2.5 pb-1 pt-2 overflow-hidden">
        
        {/* Golden/Glass Filter Pills Row: هدية | محادثة | الجميع (Matches Screenshot #3!) */}
        <div className="flex items-center justify-end gap-2 px-1 mb-1.5 text-xs font-bold">
          <button
            onClick={() => setChatTab('other')}
            className={`px-3.5 py-1 rounded-full transition-all ${
              chatTab === 'other'
                ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black shadow-md'
                : 'bg-black/45 border border-white/10 text-stone-300'
            }`}
          >
            اخر
          </button>
          <button
            onClick={() => setChatTab('gifts')}
            className={`px-3.5 py-1 rounded-full transition-all ${
              chatTab === 'gifts'
                ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black shadow-md'
                : 'bg-black/45 border border-white/10 text-stone-300'
            }`}
          >
            هدية
          </button>
          <button
            onClick={() => setChatTab('message')}
            className={`px-3.5 py-1 rounded-full transition-all ${
              chatTab === 'message'
                ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black shadow-md'
                : 'bg-black/45 border border-white/10 text-stone-300'
            }`}
          >
            محادثة
          </button>
          <button
            onClick={() => setChatTab('all')}
            className={`px-4 py-1 rounded-full transition-all ${
              chatTab === 'all'
                ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 text-slate-950 font-black shadow-md'
                : 'bg-black/45 border border-white/10 text-stone-300'
            }`}
          >
            الجميع
          </button>
        </div>

        {/* Lower Split Area: Left 3D Widgets + Right Real-Time Chat Stream */}
        <div className="flex items-end justify-between gap-2 h-38">
          
          {/* Left Floating 3D Widgets: Lucky Bag (10s), Weekly Star Chest, 3D Rocket Card */}
          <div className="flex flex-col items-center gap-2 shrink-0 pb-1">
            
            {/* 1. 3D LUCKY BAG LAUNCHER WIDGET ("كيس الحظ 10 ثواني") */}
            <button
              onClick={() => setActiveBottomDrawer('lucky_bag_drawer')}
              className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-red-600 via-rose-700 to-amber-900 border-2 border-amber-300 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(244,63,94,0.5)] active:scale-95 transition-transform"
              title="كيس الحظ (10 ثواني)"
            >
              {activeLuckyBag && (
                <span className="absolute -top-1.5 -right-1 px-1 py-0.1 rounded-full bg-emerald-400 text-slate-950 font-black text-[8px] animate-pulse">
                  {Math.ceil(activeLuckyBag.timeLeftMs / 1000)}s
                </span>
              )}
              <span className="text-xl drop-shadow">🧧</span>
              <span className="text-[8px] font-black text-amber-200 leading-none mt-0.5">
                كيس الحظ
              </span>
            </button>

            {/* 2. Weekly Star / Royal Treasure Chest Card (Matches Screenshot #3) */}
            <button
              onClick={() => setActiveBottomDrawer('treasure_chest')}
              className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-amber-700/80 via-stone-900 to-black border border-amber-400/80 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.4)] active:scale-95 transition-transform"
              title="حدث النجوم وصندوق الكنز"
            >
              <span className="text-lg drop-shadow">👑</span>
              <span className="text-[7px] font-black text-amber-200 leading-tight text-center">
                حدث النجوم
              </span>
            </button>

            {/* 3. 3D ROOM ROCKET LAUNCHPAD CARD WITH PROGRESS BAR (Matches Screenshot #3!) */}
            <button
              onClick={() => {
                setPreviewRocketLevel(rocketLevel);
                setActiveBottomDrawer('rocket');
              }}
              className="relative w-12 h-13 rounded-2xl bg-gradient-to-b from-amber-500/40 via-orange-950/80 to-stone-950 border border-amber-400/90 flex flex-col items-center justify-between p-1 shadow-[0_0_18px_rgba(245,158,11,0.5)] active:scale-95 transition-transform"
              title="صاروخ الغرفة والمكافآت"
            >
              <span
                className={`absolute -top-1.5 -right-1 px-1 py-0.1 rounded-full text-white font-black text-[8px] shadow ${
                  isRocketLocked24h ? 'bg-slate-700' : 'bg-rose-600'
                }`}
              >
                {isRocketLocked24h ? '🔒 5/5' : `Lv.${rocketLevel}`}
              </span>
              <span className="text-xl drop-shadow" style={{ animationDuration: '2s' }}>
                {isRocketLocked24h ? '⏳' : '🚀'}
              </span>
              <div className="w-full h-1.5 rounded-full bg-black/80 overflow-hidden border border-amber-400/40">
                <div
                  className={`h-full transition-all duration-300 ${
                    isRocketLocked24h
                      ? 'bg-slate-500'
                      : 'bg-gradient-to-r from-amber-300 via-orange-500 to-rose-500'
                  }`}
                  style={{ width: `${rocketProgressPercent}%` }}
                />
              </div>
              <span className="text-[7px] font-mono font-black text-amber-300 leading-none">
                {isRocketLocked24h
                  ? formatCooldownHMS(rocketCooldownRemainingMs)
                  : `${rocketProgressPercent}%`}
              </span>
            </button>
          </div>

          {/* Right Chat Stream */}
          <div className="flex-1 h-full overflow-y-auto space-y-2 pr-1 flex flex-col justify-end">
            {visibleEventLogs.length === 0 && visibleTextMessages.length === 0 && (
              <div className="mr-auto ml-0 w-full max-w-[270px] rounded-2xl px-3 py-2 bg-black/45 border border-white/10 text-right text-[11px] text-stone-200 leading-relaxed">
                أهلاً بكم في عيوني! نرجو منكم التحلي بالأدب واللطف. التزموا بإرشادات المنتدى، ولننشئ معاً بيئة دافئة ومفعمة بالحب.
              </div>
            )}

            {visibleEventLogs.map((log) => (
              <div key={log.id} className="space-y-1">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs font-bold text-stone-300">{log.senderName}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-[9px] shadow-sm">
                    💎 VIP{log.vipLevel}
                  </span>
                  <img
                    src={log.senderAvatar}
                    alt={log.senderName}
                    className="w-5 h-5 rounded-full object-cover ring-1 ring-amber-400"
                  />
                </div>

                <div className="mr-auto ml-0 w-full max-w-[270px] rounded-2xl px-3 py-2 bg-gradient-to-r from-amber-950/85 via-stone-900/90 to-amber-900/75 border border-amber-400/60 shadow-md text-right">
                  {log.type === 'lucky_win' ? (
                    <p className="text-xs font-bold text-stone-100 leading-snug">
                      أرسل {log.giftIcon} إلى <span className="text-pink-300">{log.targetNames}</span>{' '}
                      {log.comboHits > 1 && (
                        <span className="text-cyan-300 font-black">(كومبو X{log.comboHits}) </span>
                      )}
                      وفاز بـ{' '}
                      <span className="text-amber-400 font-black">
                        {log.winCoins?.toLocaleString()} كوينزات
                      </span>{' '}
                      من هدايا الحظ (
                      <span className="text-amber-400 font-black">{log.multiplier} أضعاف</span>)!
                    </p>
                  ) : log.type === 'lucky_bag_claim' ? (
                    <p className="text-xs font-bold text-amber-200 leading-snug">
                      🧧 استلم من <span className="text-yellow-300 font-black">{log.targetNames}</span>:{' '}
                      <span className="text-emerald-400 font-black">
                        +{log.winCoins?.toLocaleString()} كوينز
                      </span>{' '}
                      و ({log.giftName}) في الحقيبة!
                    </p>
                  ) : log.type === 'rocket_explosion' ? (
                    <p className="text-xs font-bold text-yellow-200 leading-snug">
                      🚀 فجّر <span className="text-amber-400 font-black">{log.giftName}</span> في الغرفة وربح{' '}
                      <span className="text-emerald-400 font-black">
                        {log.winCoins?.toLocaleString()} كوينز
                      </span>{' '}
                      + هدايا مجانية في الحقيبة!
                    </p>
                  ) : log.type === 'game_win' ? (
                    <p className="text-xs font-bold text-stone-100 leading-snug">
                      في <span className="text-cyan-300">{log.giftName}</span> {log.giftIcon} ربح{' '}
                      <span className="text-amber-400 font-black">
                        {log.winCoins?.toLocaleString()} كوينزات
                      </span>{' '}
                      ({log.multiplier}X)!
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-stone-100 leading-snug">
                      أهدى {log.giftIcon} <span className="text-amber-300">{log.giftName}</span> ×
                      {log.giftCount} إلى <span className="text-pink-300">{log.targetNames}</span>{' '}
                      {log.comboHits > 1 && (
                        <span className="text-cyan-300 font-black">(كومبو X{log.comboHits})</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {visibleTextMessages.slice(-8).map((msg) => (
              <div
                key={msg.id}
                className="mr-auto ml-0 w-full max-w-[270px] rounded-2xl px-3 py-1.5 bg-black/55 border border-white/10 text-right"
              >
                <span className="text-amber-300 font-bold text-xs ml-1">{msg.senderName}:</span>
                <span className="text-white text-xs">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. 3D BOTTOM CONTROL BAR (Matches Screenshot #3: Gamepad, Grid,       */}
      {/*    Center Glowing 3D Gift Box, Mic/Audio, and Chat Input Pill)        */}
      {/* ===================================================================== */}
      <div className="relative z-30 px-3 py-2.5 bg-gradient-to-t from-[#0d0704] via-[#140b06]/95 to-transparent flex items-center justify-between gap-2">
        
        {/* Left Group: 3D Gamepad Orb + Tools/Mic Controls */}
        <div className="flex items-center gap-2">
          {/* 3D Golden Gamepad Button (Matches Screenshot #3 Bottom-Left!) */}
          <button
            onClick={() => setActiveBottomDrawer('game_center')}
            className="w-11 h-11 rounded-full bg-black/65 border border-amber-400/50 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.35)] active:scale-90 transition-transform"
            title="مركز الألعاب التفاعلي"
          >
            <Gamepad3DSvg />
          </button>

          {/* Mic Toggle */}
          <button
            onClick={() => {
              if (!mySeat) {
                takeSeat(0);
              } else {
                toggleMic();
              }
            }}
            className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
              mySeat && !mySeat.isMuted
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-black/60 border-white/15 text-stone-200'
            }`}
            title="المايك"
          >
            {mySeat && mySeat.isMuted ? (
              <MicOff className="w-4 h-4 text-rose-400" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Speaker / Mute Room Audio */}
          <button
            onClick={() => setIsRoomSoundMuted(!isRoomSoundMuted)}
            className="w-10 h-10 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-stone-200 hover:bg-white/15"
            title="صوت الغرفة"
          >
            {isRoomSoundMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>

        {/* Center Hero: 3D Glowing Gift Box on Pedestal (Matches Screenshot #3!) */}
        <button
          onClick={() => setActiveBottomDrawer('gift')}
          className="relative -mt-3 w-14 h-14 rounded-full bg-radial from-cyan-400/35 via-amber-400/15 to-transparent flex items-center justify-center active:scale-90 transition-transform group"
          title="صندوق الهدايا والحقيبة"
        >
          <div className="absolute inset-1 rounded-full bg-cyan-400/20 blur-xs group-hover:bg-amber-400/30 transition-colors" />
          <GiftBox3DSvg />
          {Object.values(bagGifts).reduce((a, b) => a + b, 0) > 0 && (
            <span className="absolute -top-0.5 right-0 px-1.5 py-0.1 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] shadow">
              {Object.values(bagGifts).reduce((a, b) => a + b, 0)}
            </span>
          )}
        </button>

        {/* Right: Emoji + Chat Pill ("محادثة 🙂") */}
        {showChatInputBar ? (
          <form onSubmit={handleSendChat} className="flex-1 flex items-center gap-1">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="اكتب رسالتك..."
              className="w-full bg-stone-900 border border-amber-400/60 rounded-full px-3 py-1.5 text-xs text-white focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs"
            >
              إرسال
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveModal('wallet')}
              className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/60 flex items-center justify-center text-sm shadow active:scale-90 transition-transform"
              title="المحفظة"
            >
              🪙
            </button>

            <div className="flex items-center rounded-full bg-black/65 border border-white/15 px-3 py-1.5 gap-2">
              <button
                onClick={() => setActiveBottomDrawer('emoji')}
                className="text-white hover:text-amber-300 transition-colors"
                title="الملصقات التعبيرية"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowChatInputBar(true)}
                className="text-xs font-bold text-stone-200 hover:text-white"
              >
                محادثة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* DRAWER: 10-SECOND ROOM LUCKY BAG LAUNCHER ("كيس الحظ لمدة 10 ثواني")  */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'lucky_bag_drawer' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#3b0a18] via-[#220610] to-[#110308] border-t-2 border-amber-400 rounded-t-[34px] p-4 pt-10 text-white space-y-4 shadow-[0_-10px_50px_rgba(244,63,94,0.4)] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-10 inset-x-0 flex justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 via-red-500 to-rose-600 p-1 shadow-[0_0_30px_rgba(245,158,11,0.85)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#240610] flex flex-col items-center justify-center">
                  <span className="text-3xl animate-bounce">🧧</span>
                  <span className="text-[9px] font-black text-amber-300">10 ثواني</span>
                </div>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-amber-300">
                🧧 إطلاق كيس الحظ الملكي في الغرفة (لمدة 10 ثواني)
              </h3>
              <p className="text-xs text-stone-300">
                يظهر كيس الحظ داخل الغرفة لمدة 10 ثواني ليستلم منه المستخدمون الهدايا والكوينزات، ثم يختفي تلقائياً!
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  tierName: 'كيس الحظ السريع (مجاني للتجربة)',
                  cost: 0,
                  poolCoins: 1500,
                  gifts: [
                    { giftId: 'gift_lollipop_lucky', nameAr: 'مصاصة الحظ', icon: '🍭', count: 5 },
                    { giftId: 'gift_rose', nameAr: 'وردة جوري', icon: '🌹', count: 5 },
                  ],
                },
                {
                  tierName: 'كيس الحظ الذهبي الملكي',
                  cost: 2000,
                  poolCoins: 3500,
                  gifts: [
                    { giftId: 'gift_lollipop_lucky', nameAr: 'مصاصة الحظ', icon: '🍭', count: 12 },
                    { giftId: 'gift_pink_perfume', nameAr: 'عطر فرنسي', icon: '🧴', count: 4 },
                  ],
                },
                {
                  tierName: 'كيس الحظ الإمبراطوري الماسي',
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
                  className="p-3 rounded-2xl bg-white/5 border border-amber-400/30 flex items-center justify-between gap-2"
                >
                  <button
                    onClick={() =>
                      handleLaunchLuckyBag(bag.tierName, bag.cost, bag.poolCoins, bag.gifts)
                    }
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs shrink-0 shadow active:scale-95 transition-transform"
                  >
                    {bag.cost === 0 ? 'إطلاق الآن 🧧' : `إطلاق (${bag.cost.toLocaleString()} 🪙)`}
                  </button>

                  <div className="text-right">
                    <div className="text-xs font-black text-white">{bag.tierName}</div>
                    <div className="text-[10px] text-amber-300 mt-0.5">
                      يوزع +{bag.poolCoins.toLocaleString()} 🪙 +{' '}
                      {bag.gifts.map((g) => `${g.icon}×${g.count}`).join(' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER: ROOM ROCKET SUPPORT & 24-HOUR COOLDOWN MODAL                  */}
      {/* (Charged ONLY by throwing coins/gifts in room - no direct buy button) */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'rocket' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#1e1136] via-[#130a24] to-[#0a0514] border-t-2 border-amber-400 rounded-t-[34px] p-4 pt-10 text-white space-y-4 shadow-[0_-10px_50px_rgba(245,158,11,0.4)] animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-10 inset-x-0 flex justify-center pointer-events-none">
              <div
                className={`w-20 h-20 rounded-full bg-gradient-to-tr ${previewRocketTier.color} p-1 shadow-[0_0_30px_rgba(245,158,11,0.8)] flex items-center justify-center`}
              >
                <div className="w-full h-full rounded-full bg-[#150a26] flex flex-col items-center justify-center">
                  <span className="text-3xl animate-bounce">
                    {isRocketLocked24h ? '🔒' : previewRocketTier.icon}
                  </span>
                  <span className="text-[9px] font-black text-amber-300">
                    {isRocketLocked24h ? 'مغلق 24س' : `Lv.${rocketLevel}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-2">
              {ROCKET_TIERS.map((t) => {
                const isCompleted = isRocketLocked24h || t.level < rocketLevel;
                const isCurrentActive = !isRocketLocked24h && t.level === rocketLevel;
                const isPreviewed = previewRocketLevel === t.level;

                return (
                  <button
                    key={t.level}
                    onClick={() => setPreviewRocketLevel(t.level)}
                    className={`relative rounded-2xl p-2 flex flex-col items-center border transition-all ${
                      isPreviewed
                        ? 'bg-amber-500/25 border-amber-300 scale-105 shadow-md'
                        : isCompleted
                        ? 'bg-emerald-950/40 border-emerald-500/40 opacity-80'
                        : 'bg-white/5 border-white/10 opacity-65'
                    }`}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-[9px] font-black text-amber-200 mt-0.5">
                      مستوى {t.level}
                    </span>
                    <span
                      className={`text-[8px] font-black mt-0.5 px-1.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : isCurrentActive
                          ? 'bg-amber-500/30 text-amber-300'
                          : 'bg-white/10 text-stone-400'
                      }`}
                    >
                      {isCompleted ? 'مغلق ✅' : isCurrentActive ? 'نشط 🔥' : 'مقفل 🔒'}
                    </span>
                  </button>
                );
              })}
            </div>

            {isRocketLocked24h ? (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border-2 border-rose-500/70 text-center space-y-1.5 shadow-inner">
                <div className="text-xs font-black text-rose-300">
                  🔒 تم إغلاق وتفجير جميع الصواريخ الـ 5 في هذه الغرفة!
                </div>
                <div className="text-[11px] text-stone-300">
                  لا يمكن تجديد الصواريخ إلا بعد مرور 24 ساعة من إغلاق المستوى الخامس:
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-black/60 border border-amber-400/50 text-amber-300 font-mono font-black text-base">
                  <span>⏳</span>
                  <span>{formatCooldownHMS(rocketCooldownRemainingMs)}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-2 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-amber-300">
                    {previewRocketLevel < rocketLevel
                      ? `${previewRocketTier.targetCoins.toLocaleString()} / ${previewRocketTier.targetCoins.toLocaleString()} 🪙 (مكتمل)`
                      : previewRocketLevel === rocketLevel
                      ? `${rocketCurrentSupport.toLocaleString()} / ${currentRocketTier.targetCoins.toLocaleString()} 🪙`
                      : `0 / ${previewRocketTier.targetCoins.toLocaleString()} 🪙`}
                  </span>
                  <span className="text-xs font-black text-white">{previewRocketTier.nameAr}</span>
                </div>

                <div className="relative w-full h-4 rounded-full bg-slate-900 border border-amber-400/50 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${previewRocketTier.color} transition-all duration-300`}
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
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
                    {previewRocketLevel < rocketLevel
                      ? 'تم تفجير هذا المستوى وإغلاقه ✅'
                      : previewRocketLevel === rocketLevel
                      ? `طاقة الصاروخ الحالي: ${rocketProgressPercent}% (متبقي ${(
                          currentRocketTier.targetCoins - rocketCurrentSupport
                        ).toLocaleString()} كوينز)`
                      : `يفتح بعد إكمال المستوى ${previewRocketLevel - 1}`}
                  </span>
                </div>

                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  ⚠️ الصاروخ لا يُباع ولا يمكن تفجيره يدوياً! يتم شحنه تلقائياً فقط عن طريق رمي الهدايا بالكوينزات داخل الغرفة، وعند إغلاق الصواريخ الـ 5 لا يتم تجديدها إلا بعد 24 ساعة.
                </p>
              </div>
            )}

            <div className="space-y-2 text-right">
              <div className="text-xs font-black text-amber-300">
                🎁 غنائم ومكافآت انفجار المستوى {previewRocketTier.level} (تودع في الحقيبة والمحفظة):
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-2xl bg-amber-500/20 border border-amber-400 flex flex-col items-center justify-center">
                  <span className="text-2xl">🪙</span>
                  <span className="text-[10px] font-black text-amber-300 mt-1">
                    +{previewRocketTier.rewardCoins.toLocaleString()}
                  </span>
                  <span className="text-[8px] text-amber-100">كوينز مكافأة</span>
                </div>

                {previewRocketTier.rewardBagGifts.map((rg, idx) => {
                  const gMeta = gifts.find((g) => g.id === rg.giftId);
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-2xl bg-white/5 border border-pink-400/40 flex flex-col items-center justify-center"
                    >
                      <span className="text-2xl">{gMeta?.icon || '🎁'}</span>
                      <span className="text-[9px] font-bold text-white truncate w-full text-center mt-1">
                        {gMeta?.nameAr || 'هدية'}
                      </span>
                      <span className="text-[9px] font-black text-emerald-400">
                        ×{rg.count} بالحقيبة
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={() => {
                  setGiftDrawerTab('lucky');
                  setActiveBottomDrawer('gift');
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600 text-slate-950 font-black text-xs shadow-[0_0_20px_rgba(245,158,11,0.5)] active:scale-95 transition-transform"
              >
                🎁 ارمِ هدايا داخل الغرفة لشحن الصاروخ بالكوينزات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER A: EMOJI & STICKER SHEET                                       */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'emoji' && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="w-full max-w-md mx-auto bg-[#1c130e] border-t border-white/15 rounded-t-3xl p-4 text-white animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-3 border-b border-white/10 text-xs font-bold">
              {[
                { id: 'river_horse', label: 'فرس النهر الـ' },
                { id: 'cute_panda', label: 'باندا لطيف' },
                { id: 'workday', label: 'يوم العمل' },
                { id: 'capoo', label: 'كابو' },
                { id: 'panda', label: 'الباندا' },
                { id: 'classic', label: 'كلاسيكي' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setEmojiCategory(tab.id as typeof emojiCategory)}
                  className={`whitespace-nowrap px-2 py-1 transition-colors ${
                    emojiCategory === tab.id
                      ? 'text-amber-400 font-black border-b-2 border-amber-400'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-3 py-4 place-items-center">
              {emojiSets[emojiCategory].map((emo, index) => (
                <button
                  key={index}
                  onClick={() => handleSendEmojiToMySeat(emo)}
                  className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-4xl shadow-inner active:scale-90 transition-transform"
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER B: SEAT ACTION SHEET                                           */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'seat_menu' && selectedSeatForMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end p-3"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-2xl bg-white text-slate-900 overflow-hidden divide-y divide-slate-200 shadow-2xl text-center font-bold text-sm">
              <button
                onClick={() => {
                  setSelectedRecipientSeats([selectedSeatForMenu.index]);
                  setActiveBottomDrawer('gift');
                }}
                className="w-full py-3.5 bg-amber-50 text-amber-700 font-black hover:bg-amber-100 transition-colors"
              >
                🎁 إرسال هدية / هدية حظ إلى مايك #{selectedSeatForMenu.index + 1}
              </button>

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
                className="w-full py-3.5 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                {selectedSeatForMenu.userId === currentUser.id
                  ? 'أترك مايك'
                  : selectedSeatForMenu.userId
                  ? 'عرض الملف الشخصي'
                  : `صعود إلى المايك #${selectedSeatForMenu.index + 1} 🎙️`}
              </button>

              <button
                onClick={() => {
                  toggleSeatLock(selectedSeatForMenu.index);
                  setActiveBottomDrawer('none');
                }}
                className="w-full py-3.5 hover:bg-slate-100 active:bg-slate-200 transition-colors"
              >
                {selectedSeatForMenu.isLocked ? 'فتح قفل المايك 🔓' : 'قفل المايك 🔒'}
              </button>

              <button
                onClick={() => handleClearHeartValue(selectedSeatForMenu.index)}
                className="w-full py-3.5 hover:bg-slate-100 active:bg-slate-200 transition-colors text-rose-600"
              >
                مسح قيمة القلب 💗
              </button>
            </div>

            <button
              onClick={() => setActiveBottomDrawer('none')}
              className="w-full py-3.5 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-xl hover:bg-slate-100"
            >
              الغاء
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER C: MULTI-ENGINE GAME CENTER MODAL (6 Distinct Games!)          */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'game_center' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#2b1708] via-[#1c0f05] to-[#120802] border-t-4 border-amber-400 rounded-t-[32px] p-4 pt-8 text-white shadow-[0_-10px_40px_rgba(245,158,11,0.4)] animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-6 inset-x-0 flex justify-center pointer-events-none">
              <div className="px-8 py-2 rounded-full bg-gradient-to-r from-amber-700 via-yellow-400 to-amber-700 border-2 border-yellow-100 shadow-2xl flex items-center gap-2">
                <span className="text-lg">🪽</span>
                <span className="text-base font-black text-slate-950 tracking-wider uppercase drop-shadow">
                  GAME CENTER
                </span>
                <span className="text-lg">🪽</span>
              </div>
            </div>

            <InteractiveGamesHub
              compact={true}
              onOpenWallet={() => {
                setActiveBottomDrawer('none');
                setActiveModal('wallet');
              }}
              onWinAnnouncement={(gameName, gameIcon, winCoins, mult) => {
                triggerSpinningRibbonsSplash(gameIcon, mult);
                const nowTime = new Date().toLocaleTimeString('ar-EG', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                setRoomEventLogs((prev) => [
                  ...prev.slice(-25),
                  {
                    id: 'log_game_' + Date.now(),
                    type: 'game_win',
                    senderName: currentUser.displayName,
                    senderAvatar: currentUser.avatar,
                    vipLevel: currentUser.vipLevel,
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

      {/* ===================================================================== */}
      {/* DRAWER D: GIFT DRAWER WITH RECIPIENT SELECTION & BAG GIFTS            */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'gift' && (
        <div
          className="fixed inset-0 z-50 bg-black/65 flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="w-full max-w-md mx-auto bg-[#141018]/98 border-t border-white/15 rounded-t-3xl p-3.5 text-white space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Level Progress Pill */}
            <div className="flex items-center justify-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-teal-500 text-slate-950 font-black text-[10px]">
                41
              </span>
              <div className="relative w-48 h-4 rounded-full bg-slate-800 overflow-hidden border border-teal-400/50">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((giftExpProgress / 263990) * 100))}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow">
                  {(giftExpProgress / 1000).toFixed(2)}K/263.99K
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white font-black text-[10px]">
                42
              </span>
            </div>

            {/* 2. Recipient Selection Bar: Choose specific seat(s) to hit! */}
            <div className="flex items-center justify-between gap-2 bg-black/50 p-2 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar">
                {all24Seats.map((s, idx) => {
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
                      className={`relative flex flex-col items-center shrink-0 transition-transform ${
                        isSelected ? 'scale-105' : 'opacity-55 hover:opacity-85'
                      }`}
                    >
                      <div
                        className={`relative w-9 h-9 rounded-full p-0.5 ${
                          isSelected
                            ? 'ring-2 ring-teal-400 bg-teal-500/30'
                            : 'border border-white/20'
                        }`}
                      >
                        {s.userAvatar ? (
                          <img
                            src={s.userAvatar}
                            alt={s.userName || `مايك ${idx + 1}`}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-full bg-stone-800 flex items-center justify-center text-[10px] font-black text-amber-300">
                            {idx + 1}
                          </div>
                        )}
                        {isSelected && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center shadow">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] font-bold text-stone-300 max-w-[40px] truncate mt-0.5">
                        {s.userName || `مايك ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  const occupiedIndices = all24Seats
                    .filter((s) => s.userId)
                    .map((s) => s.index);
                  const allTargetPool =
                    occupiedIndices.length > 0 ? occupiedIndices : [0, 1, 2, 3, 4, 5];
                  setSelectedRecipientSeats(
                    selectedRecipientSeats.length === allTargetPool.length
                      ? [0]
                      : allTargetPool
                  );
                }}
                className="px-2.5 py-1.5 rounded-xl bg-teal-500/20 border border-teal-400 text-teal-300 font-black text-[10px] shrink-0"
              >
                {selectedRecipientSeats.length > 1 ? 'تحديد 1' : 'تحديد الكل'}
              </button>
            </div>

            {/* 3. Gift Category Tabs */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs font-bold overflow-x-auto gap-3">
              {[
                { id: 'celebrity', label: 'هدية المشاهير' },
                { id: 'cp', label: 'CP' },
                { id: 'event', label: 'الحدث' },
                {
                  id: 'bag',
                  label: `الحقيبة 🎒 (${Object.values(bagGifts).reduce((a, b) => a + b, 0)})`,
                },
                { id: 'lucky', label: 'هدايا الحظ 🍭' },
                { id: 'gifts', label: 'الهدايا' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setGiftDrawerTab(t.id as typeof giftDrawerTab);
                    if (t.id === 'bag') {
                      const firstBagGiftId = Object.keys(bagGifts).find(
                        (k) => (bagGifts[k] || 0) > 0
                      );
                      if (firstBagGiftId) setSelectedGiftId(firstBagGiftId);
                    }
                  }}
                  className={`whitespace-nowrap transition-colors ${
                    giftDrawerTab === t.id
                      ? 'text-amber-400 font-black border-b-2 border-amber-400 pb-1'
                      : 'text-stone-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 4. 4-Column Grid of Gifts (or Bag Gifts) */}
            {giftDrawerTab === 'bag' && filteredDrawerGifts.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="text-3xl">🎒</div>
                <div className="text-xs font-bold text-stone-300">
                  حقيبة الهدايا فارغة حالياً! استلم هدايا من كيس الحظ 🧧 أو فجّر صاروخ الغرفة 🚀
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setActiveBottomDrawer('lucky_bag_drawer')}
                    className="px-4 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs"
                  >
                    إطلاق كيس الحظ 🧧
                  </button>
                  <button
                    onClick={() => setActiveBottomDrawer('rocket')}
                    className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs"
                  >
                    صاروخ الغرفة 🚀
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5 max-h-52 overflow-y-auto py-1">
                {filteredDrawerGifts.map((g) => {
                  const isSelected = selectedGiftId === g.id;
                  const isLucky =
                    g.isLucky || g.category === 'lucky' || g.animationType === 'lollipop_matrix';
                  const bagQty = bagGifts[g.id] || 0;

                  return (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGiftId(g.id)}
                      className={`relative rounded-2xl p-2 flex flex-col items-center justify-between border transition-all ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 scale-[1.02] shadow-md'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {giftDrawerTab === 'bag' && bagQty > 0 ? (
                        <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-[9px] font-black text-slate-950">
                          ×{bagQty}
                        </span>
                      ) : (
                        isLucky && (
                          <span className="absolute top-1 right-1 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-pink-500 to-amber-500 text-[8px] font-black text-white">
                            حظ
                          </span>
                        )
                      )}
                      <div className="text-3xl my-1 filter drop-shadow">{g.icon}</div>
                      <div className="flex items-center gap-0.5 text-[11px] font-black text-amber-300">
                        {giftDrawerTab === 'bag' ? (
                          <span className="text-emerald-400 text-[10px]">مجاني بالحقيبة</span>
                        ) : (
                          <>
                            <span>
                              {g.coinPrice >= 1000
                                ? `${(g.coinPrice / 1000).toFixed(
                                    g.coinPrice % 1000 === 0 ? 0 : 1
                                  )}K`
                                : g.coinPrice}
                            </span>
                            <span>🪙</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-300 truncate w-full text-center">
                        {g.nameAr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 5. Bottom Footer: Send Button + Quantity + Balance */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center rounded-full overflow-hidden border border-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.3)]">
                <button
                  onClick={handleSendSelectedGift}
                  className="px-5 py-1.5 bg-gradient-to-r from-teal-400 to-emerald-500 text-slate-950 font-black text-xs hover:opacity-95 active:scale-95"
                >
                  إرسال ({selectedRecipientSeats.length})
                </button>
                <select
                  value={giftCount}
                  onChange={(e) => setGiftCount(Number(e.target.value))}
                  className="bg-slate-900 text-white text-xs font-black px-2.5 py-1.5 focus:outline-none"
                >
                  <option value={1}>× 1</option>
                  <option value={10}>× 10</option>
                  <option value={66}>× 66</option>
                  <option value={99}>× 99</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setActiveBottomDrawer('none');
                  setActiveModal('wallet');
                }}
                className="flex items-center gap-1.5 text-xs font-black text-amber-400 hover:text-amber-300"
              >
                <ChevronRight className="w-4 h-4" />
                <span>إعادة شحن</span>
                <span className="text-white font-mono">
                  {currentUser.coins.toLocaleString('en-US')}
                </span>
                <span>🪙</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER E: WINGED TREASURE CHEST MODAL                                 */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'treasure_chest' && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="relative w-full max-w-md mx-auto bg-gradient-to-b from-[#1d1138] via-[#130b24] to-[#0c0717] border-t-2 border-pink-400/70 rounded-t-[36px] p-4 pt-12 text-white space-y-4 shadow-[0_-10px_50px_rgba(236,72,153,0.4)] animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-12 inset-x-0 flex justify-center pointer-events-none">
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 via-rose-400 to-amber-300 p-1 shadow-[0_0_35px_rgba(236,72,153,0.9)] flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-[#24103a] flex flex-col items-center justify-center">
                  <span className="text-4xl animate-bounce">👛</span>
                  <span className="text-[9px] font-black text-pink-200">كنز الحظ</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 pt-2">
              {[1, 2, 3, 4, 5].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedChestTier(tier)}
                  className={`rounded-2xl p-2 flex flex-col items-center border transition-all ${
                    selectedChestTier === tier
                      ? 'bg-pink-500/30 border-amber-300 scale-105 shadow-lg'
                      : 'bg-white/5 border-white/10 opacity-70'
                  }`}
                >
                  <span className="text-2xl">👑</span>
                  <span className="text-[9px] font-black text-amber-200 mt-1">
                    مستوى {tier}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="relative w-full h-3.5 rounded-full bg-slate-900 border border-amber-400/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-pink-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((chestProgress / 60) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-black text-amber-300 font-mono">
                <span>60M</span>
                <span>{chestProgress}M</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 items-stretch">
              <div className="col-span-3 grid grid-cols-4 gap-1.5">
                {[
                  { name: 'Gold x 89', icon: '🪙' },
                  { name: 'Gold x 1', icon: '🔮' },
                  { name: 'Ride*7Days', icon: '🏎️' },
                  { name: 'Frame*7Da', icon: '🖼️' },
                  { name: 'Gold x 699', icon: '🪙' },
                  { name: 'Gold x 1', icon: '🌸' },
                  { name: 'Gold x 1', icon: '🍬' },
                  { name: 'Gold x 5000', icon: '🪙' },
                ].map((r, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-[#24183d] border border-purple-400/30 p-1.5 flex flex-col items-center justify-center text-center"
                  >
                    <span className="text-xl">{r.icon}</span>
                    <span className="text-[8px] font-bold text-amber-200 truncate w-full mt-1">
                      {r.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="col-span-2 rounded-2xl bg-gradient-to-b from-amber-500/20 to-[#24183d] border-2 border-amber-400 p-2.5 flex flex-col items-center justify-between relative">
                <span className="absolute top-1.5 right-1.5 px-2 py-0.2 rounded-full bg-purple-600 text-white font-black text-[9px]">
                  خاص
                </span>
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-3xl shadow-lg my-auto">
                  🪙
                </div>
                <span className="text-xs font-black text-amber-300">
                  Golds x {selectedChestTier * 4000}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                const reward = selectedChestTier * 4000;
                rechargeCoins(reward, 'صندوق الكنز الملكي');
                setBagGifts((prev) => ({
                  ...prev,
                  gift_lollipop_lucky: (prev.gift_lollipop_lucky || 0) + 5,
                }));
                triggerSpinningRibbonsSplash('👑', selectedChestTier * 10);
                setActiveBottomDrawer('none');
              }}
              className="w-full py-3 rounded-full bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 font-black text-sm shadow-lg hover:opacity-95 active:scale-95 transition-transform"
            >
              فتح الصندوق واستلام {(selectedChestTier * 4000).toLocaleString()} 🪙 + 5 مصاصات بالحقيبة
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER F: ROOM TOP CONTRIBUTORS & SEATS LEADERBOARD (👑 Top)          */}
      {/* ===================================================================== */}
      {activeBottomDrawer === 'top_ranking' && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setActiveBottomDrawer('none')}
        >
          <div
            className="w-full max-w-md mx-auto bg-gradient-to-b from-[#241509] to-[#120904] border-t-2 border-amber-400 rounded-t-3xl p-4 text-white space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <button
                onClick={() => setActiveBottomDrawer('none')}
                className="text-xs text-stone-400 hover:text-white"
              >
                إغلاق
              </button>
              <div className="flex items-center gap-1.5 text-amber-300 font-black text-sm">
                <Trophy className="w-4 h-4" />
                <span>ترتيب نجوم المايكات والداعمين</span>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {all24Seats
                .slice()
                .sort((a, b) => (b.heartPoints || 0) - (a.heartPoints || 0))
                .slice(0, 10)
                .map((s, rankIdx) => {
                  const heartScore =
                    seatHeartsOverride[s.index] !== undefined
                      ? seatHeartsOverride[s.index]
                      : s.heartPoints || 0;
                  return (
                    <div
                      key={s.index}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/10"
                    >
                      <button
                        onClick={() => {
                          setSelectedRecipientSeats([s.index]);
                          setActiveBottomDrawer('gift');
                        }}
                        className="px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-amber-500 text-white font-black text-[10px]"
                      >
                        دعم 🎁
                      </button>

                      <div className="flex items-center gap-2.5">
                        <div className="text-right">
                          <div className="text-xs font-black text-white">
                            {s.userName || `مايك #${s.index + 1}`}
                          </div>
                          <div className="text-[10px] text-pink-400 font-bold">
                            {heartScore.toLocaleString()} 💗
                          </div>
                        </div>
                        {s.userAvatar ? (
                          <img
                            src={s.userAvatar}
                            alt={s.userName}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-amber-400"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-stone-800 flex items-center justify-center text-xs font-black text-amber-300">
                            #{s.index + 1}
                          </div>
                        )}
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                            rankIdx === 0
                              ? 'bg-amber-400 text-slate-950'
                              : rankIdx === 1
                              ? 'bg-slate-300 text-slate-950'
                              : rankIdx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-white/10 text-stone-300'
                          }`}
                        >
                          {rankIdx + 1}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
