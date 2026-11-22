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
  Shield,
  ShieldCheck,
  KeyRound,
  Ban,
  UserMinus,
  Search,
  UserCheck,
} from 'lucide-react';
import { RoomSeat, GiftItem, VoiceRoom, RoomLiveEvent, RoomLiveEventGiftSnapshot } from '../types';
import { InteractiveGamesHub } from './InteractiveGamesHub';
import { SmartMediaView } from './SmartMediaView';
import {
  getMediaFormatLabel,
  resolveEntranceStageMedia,
  resolveGiftStageMedia,
} from '../utils/mediaFormats';
import { preloadMediaAssets } from '../utils/apngEngine';
import { inspectVapUrl } from '../utils/vapEngine';
import { AgoraConnectionStatus, agoraVoice } from '../utils/agoraVoice';
import { selfHostedVoice } from '../utils/selfHostedVoice';
import { publishRoomLiveEventToFirestore } from '../utils/auravoiceFirestore';
import { sound } from '../utils/audio';
import midnightLoungeBg from '../assets/images/room_bg_midnight_lounge_1795294231147.jpg';
import royalMajlisBg from '../assets/images/room_bg_royal_majlis_1795294234181.jpg';
import starlightSkyBg from '../assets/images/room_bg_starlight_sky_1795294232054.jpg';

// Bespoke generated room wallpapers (Zero external URL dependencies)
const ROOM_THEMES = [
  {
    id: 'midnight',
    name: 'الصالة الليلية',
    image: midnightLoungeBg,
    fallbackGradient: 'from-[#0b1021] via-[#10182f] to-[#080b14]',
  },
  {
    id: 'majlis',
    name: 'المجلس الملكي',
    image: royalMajlisBg,
    fallbackGradient: 'from-[#17120c] via-[#1c150e] to-[#0c0907]',
  },
  {
    id: 'starlight',
    name: 'سماء الليل',
    image: starlightSkyBg,
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
  giftImageUrl?: string;
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
  giftImageUrl?: string;
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
  giftImageUrl?: string;
  count: number;
}

interface ComboState {
  active: boolean;
  gift: GiftItem;
  count: number;
  targetSeats: number[];
  comboHits: number;
  cumulativeCoins: number;
  timeLeftMs: number; // 2000ms down to 0
  fromBag?: boolean;
}

interface ActiveStageGift {
  id: string;
  mediaUrl: string;
  fallbackUrl?: string;
  preferVideo: boolean;
  durationMs: number;
  hasExplicitDuration: boolean;
  comboPulseKey: number;
  giftName: string;
  senderName: string;
  soundEffect: GiftItem['soundEffect'];
  soundUrl?: string;
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
  giftCounts: number[];
  accent: string;
}

const ROCKET_TIERS: RocketTierConfig[] = [
  {
    level: 1,
    nameAr: 'صاروخ الفضة',
    icon: '🚀',
    targetCoins: 10000,
    rewardCoins: 5000,
    giftCounts: [10, 15, 5],
    accent: 'from-sky-400 to-indigo-500',
  },
  {
    level: 2,
    nameAr: 'صاروخ الذهب',
    icon: '🛸',
    targetCoins: 25000,
    rewardCoins: 15000,
    giftCounts: [25, 5, 8],
    accent: 'from-amber-400 to-orange-500',
  },
  {
    level: 3,
    nameAr: 'صاروخ الألماس',
    icon: '☄️',
    targetCoins: 50000,
    rewardCoins: 35000,
    giftCounts: [5, 2, 6],
    accent: 'from-violet-400 to-indigo-600',
  },
  {
    level: 4,
    nameAr: 'صاروخ المجرة',
    icon: '🌌',
    targetCoins: 100000,
    rewardCoins: 75000,
    giftCounts: [2, 1, 2],
    accent: 'from-rose-400 to-purple-600',
  },
  {
    level: 5,
    nameAr: 'الصاروخ الإمبراطوري',
    icon: '👑',
    targetCoins: 250000,
    rewardCoins: 200000,
    giftCounts: [2, 2, 1],
    accent: 'from-amber-300 to-red-600',
  },
];

function resolveRocketBagGifts(
  tierLevel: number,
  liveGifts: GiftItem[]
): { giftId: string; count: number; gift: GiftItem }[] {
  if (!liveGifts || liveGifts.length === 0) return [];
  const tier = ROCKET_TIERS.find((t) => t.level === tierLevel) || ROCKET_TIERS[0];
  const sorted = [...liveGifts].sort((a, b) => a.coinPrice - b.coinPrice);
  const startIdx = Math.min(Math.max(0, tierLevel - 1), Math.max(0, sorted.length - 1));
  return tier.giftCounts.map((count, i) => {
    const gift = sorted[(startIdx + i) % sorted.length];
    return { giftId: gift.id, count, gift };
  });
}

function resolveLuckyBagRewards(
  tierIndex: number,
  liveGifts: GiftItem[]
): { giftId: string; nameAr: string; icon: string; count: number }[] {
  if (!liveGifts || liveGifts.length === 0) return [];
  const sorted = [...liveGifts].sort((a, b) => a.coinPrice - b.coinPrice);
  const luckyFirst = [...sorted.filter((g) => g.isLucky || g.category === 'lucky'), ...sorted];
  const countsByTier = [
    [5, 5],
    [12, 4],
    [2, 30],
  ];
  const counts = countsByTier[tierIndex] || countsByTier[0];
  return counts.map((count, idx) => {
    const picked = luckyFirst[(tierIndex + idx) % luckyFirst.length] || sorted[0];
    return {
      giftId: picked.id,
      nameAr: picked.nameAr,
      icon: picked.icon,
      count,
    };
  });
}

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
    appendRoomMessage,
    sendGift,
    rechargeCoins,
    gifts,
    storeItems,
    users,
    setActiveModal,
    setViewingProfileUser,
    bagGifts,
    addBagGifts,
    consumeBagGift,
    evaluateLuckyGiftWin,
    roomBackgrounds,
    isRoomOwner,
    isRoomModerator,
    canManageRoom,
    toggleAllSeatsLock,
    toggleSeatMuteByModerator,
    kickUserFromSeat,
    clearSeatHeartPoints,
    toggleRoomModerator,
    banUserFromRoom,
    unbanUserFromRoom,
    updateRoomPrivacySettings,
    flyingGift,
    entranceBanner,
    clearEntranceBanner,
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
  const [roomSettingsTab, setRoomSettingsTab] = useState<'backgrounds' | 'privacy' | 'moderation'>('backgrounds');
  const [roomNotice, setRoomNotice] = useState<string>(
    activeRoom?.announcement || 'أهلاً بكم في الغرفة الصوتية — نرجو الالتزام بالأدب والاحترام.'
  );
  const [noticeDraft, setNoticeDraft] = useState<string>(roomNotice);
  const [titleDraft, setTitleDraft] = useState<string>(activeRoom?.title || '');
  const [privacyTypeDraft, setPrivacyTypeDraft] = useState<VoiceRoom['type']>(
    activeRoom?.type || 'public'
  );
  const [passwordDraft, setPasswordDraft] = useState<string>(activeRoom?.password || '');
  const [isLockedDraft, setIsLockedDraft] = useState<boolean>(Boolean(activeRoom?.isLocked));
  const [modSearchQuery, setModSearchQuery] = useState<string>('');
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [isRoomSoundMuted, setIsRoomSoundMuted] = useState(false);
  const [agoraVolumes, setAgoraVolumes] = useState<Record<string, number>>({});
  const [agoraLiveMicActive, setAgoraLiveMicActive] = useState(false);
  const [agoraStatus, setAgoraStatus] = useState<AgoraConnectionStatus>({
    state: 'idle',
    appId: '',
    channel: null,
    remoteUsersCount: 0,
    autoplayBlocked: false,
    micActive: false,
    micError: null,
    errorMessage: null,
    requiresToken: false,
  });
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [dismissedVoiceErrorKey, setDismissedVoiceErrorKey] = useState<string | null>(null);
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

  // Active Full-Room Gift Overlay (MP4, WebM, GIF, WebP, PNG)
  const [activeStageGift, setActiveStageGift] = useState<ActiveStageGift | null>(null);
  const lastLocalGiftThrowTsRef = useRef<number>(0);
  const lastHandledFlyingIdRef = useRef<string | null>(null);
  const lastPlayedStageSoundKeyRef = useRef<number | null>(null);
  const stagePulseCounterRef = useRef<number>(0);
  const roomJoinedAtRef = useRef<number>(Date.now());
  const handledRoomEventIdsRef = useRef<Set<string>>(new Set());
  const handleIncomingRoomEventRef = useRef<(ev: RoomLiveEvent) => void>(() => {});

  // Room Event Logs
  const [roomEventLogs, setRoomEventLogs] = useState<RoomEventLog[]>([]);

  // Gift Drawer State
  const [giftDrawerTab, setGiftDrawerTab] = useState<
    'all' | 'classic' | 'luxury' | 'lucky' | 'bag'
  >('all');
  const [selectedGiftId, setSelectedGiftId] = useState<string>(gifts[0]?.id || '');
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

  // Sync room notice & privacy drafts when active room changes
  useEffect(() => {
    if (!activeRoom) return;
    if (activeRoom.announcement) {
      setRoomNotice(activeRoom.announcement);
      setNoticeDraft(activeRoom.announcement);
    }
    setTitleDraft(activeRoom.title);
    setPrivacyTypeDraft(activeRoom.type);
    setPasswordDraft(activeRoom.password || '');
    setIsLockedDraft(Boolean(activeRoom.isLocked));
  }, [
    activeRoom?.id,
    activeRoom?.announcement,
    activeRoom?.title,
    activeRoom?.type,
    activeRoom?.password,
    activeRoom?.isLocked,
  ]);

  // Auto-prune Gift Combo Track items after 3.2s of inactivity
  useEffect(() => {
    if (giftComboTrack.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setGiftComboTrack((prev) => prev.filter((item) => now - item.updatedAt < 3200));
    }, 300);
    return () => clearInterval(timer);
  }, [giftComboTrack.length]);

  // Sync external gift throws (e.g. GiftModal / BackpackModal) to full-room stage overlay
  useEffect(() => {
    if (!flyingGift || flyingGift.id === lastHandledFlyingIdRef.current) return;
    lastHandledFlyingIdRef.current = flyingGift.id;
    // Skip if executeGiftThrow just triggered this exact gift locally (< 300ms ago)
    if (Date.now() - lastLocalGiftThrowTsRef.current < 300) return;

    const stageMedia = resolveGiftStageMedia(flyingGift.gift);
    if (!stageMedia.mediaUrl) return;
    const mediaUrl = stageMedia.mediaUrl;
    const now = Date.now();
    const pulseKey = ++stagePulseCounterRef.current;
    if (flyingGift.gift.soundUrl) {
      sound.preloadAudioUrl(flyingGift.gift.soundUrl);
    }
    setActiveStageGift((prev) => {
      if (prev && prev.mediaUrl === mediaUrl) {
        return {
          ...prev,
          comboPulseKey: pulseKey,
          giftName: flyingGift.gift.nameAr,
          senderName: flyingGift.senderName,
          soundEffect: flyingGift.gift.soundEffect,
          soundUrl: flyingGift.gift.soundUrl,
        };
      }
      return {
        id: `ext_${now}_${flyingGift.gift.id}`,
        mediaUrl,
        fallbackUrl: stageMedia.fallbackUrl,
        preferVideo: stageMedia.preferVideo,
        durationMs: stageMedia.durationMs,
        hasExplicitDuration: stageMedia.hasExplicitDuration,
        comboPulseKey: pulseKey,
        giftName: flyingGift.gift.nameAr,
        senderName: flyingGift.senderName,
        soundEffect: flyingGift.gift.soundEffect,
        soundUrl: flyingGift.gift.soundUrl,
      };
    });
  }, [flyingGift]);

  // Warm-preload gift & entrance assets (VAP metadata + all formats + custom gift audio) when inside a room so gifts play at 0ms
  useEffect(() => {
    const urls: Array<string | undefined> = [];
    gifts.forEach((g) => {
      if (g.videoUrl) {
        urls.push(g.videoUrl);
        void inspectVapUrl(g.videoUrl);
      }
      if (g.imageUrl) urls.push(g.imageUrl);
      if (g.soundUrl) sound.preloadAudioUrl(g.soundUrl);
    });
    storeItems.forEach((s) => {
      if (s.type === 'entrance') {
        if (s.videoUrl) {
          urls.push(s.videoUrl);
          void inspectVapUrl(s.videoUrl);
        }
        if (s.previewUrl) urls.push(s.previewUrl);
      }
    });
    preloadMediaAssets(urls);
  }, [gifts, storeItems]);

  // Prioritize warming currently selected gift media & audio as soon as drawer opens or selection changes
  useEffect(() => {
    if (gifts.length > 0 && !gifts.some((g) => g.id === selectedGiftId)) {
      setSelectedGiftId(gifts[0].id);
    }
    if (activeBottomDrawer !== 'gift') return;
    const selected = gifts.find((g) => g.id === selectedGiftId);
    if (!selected) return;
    preloadMediaAssets([selected.videoUrl, selected.imageUrl]);
    if (selected.soundUrl) {
      sound.preloadAudioUrl(selected.soundUrl);
    }
  }, [activeBottomDrawer, selectedGiftId, gifts]);

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

  // Connect real-time Agora RTC Voice Engine for active room
  useEffect(() => {
    const unsubVol = agoraVoice.subscribeVolumes((vols) => {
      setAgoraVolumes(vols);
    });
    const unsubMic = agoraVoice.subscribeMicStatus((active) => {
      setAgoraLiveMicActive(active);
    });
    const unsubStatus = agoraVoice.subscribeStatus((st) => {
      setAgoraStatus(st);
    });
    let noticeTimer: number | null = null;
    const unsubNotice = agoraVoice.subscribeNotices((msg) => {
      setVoiceNotice(msg);
      if (noticeTimer) window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setVoiceNotice(null), 7000);
    });

    return () => {
      unsubVol();
      unsubMic();
      unsubStatus();
      unsubNotice();
      if (noticeTimer) window.clearTimeout(noticeTimer);
    };
  }, []);

  useEffect(() => {
    if (!activeRoom?.id || !currentUser.id) return;
    roomJoinedAtRef.current = Date.now();
    handledRoomEventIdsRef.current.clear();
    setDismissedVoiceErrorKey(null);
    void agoraVoice.joinRoom(activeRoom.id, currentUser.id, currentUser.displayName);
    return () => {
      void agoraVoice.leaveRoom();
    };
  }, [activeRoom?.id, currentUser.id, currentUser.displayName]);

  // Subscribe to real-time WebSocket room events (gifts, lucky bags, rockets, emojis, live chat)
  useEffect(() => {
    const unsubEvents = selfHostedVoice.subscribeRoomEvents((ev) => {
      handleIncomingRoomEventRef.current(ev);
    });
    return () => {
      unsubEvents();
    };
  }, []);

  // Also consume real-time Firestore room messages carrying liveEvent / remote giftData (works on static hosts too!)
  useEffect(() => {
    if (!activeRoom?.id || activeRoomMessages.length === 0) return;
    const minFreshTs = roomJoinedAtRef.current - 3500;
    for (const msg of activeRoomMessages) {
      if (msg.roomId !== activeRoom.id) continue;
      if (msg.liveEvent && msg.liveEvent.id) {
        if (msg.liveEvent.createdAt >= minFreshTs) {
          handleIncomingRoomEventRef.current(msg.liveEvent);
        }
        continue;
      }
      // Backwards-compatible fallback: legacy giftData messages without liveEvent from remote users
      if (msg.giftData && msg.senderId !== currentUser.id) {
        const parsedTs = Number(msg.id.split('_')[1] || 0);
        if (parsedTs >= minFreshTs) {
          const catalogGift = gifts.find((g) => g.id === msg.giftData!.giftId);
          if (catalogGift) {
            const syntheticEvent: RoomLiveEvent = {
              id: `legacy_${msg.id}`,
              kind: 'gift_throw',
              roomId: activeRoom.id,
              senderId: msg.senderId,
              senderName: msg.senderName,
              senderAvatar: msg.senderAvatar,
              senderVipLevel: msg.vipLevel,
              senderLevel: msg.level,
              createdAt: parsedTs,
              gift: {
                id: catalogGift.id,
                name: catalogGift.name,
                nameAr: catalogGift.nameAr,
                category: catalogGift.category,
                coinPrice: catalogGift.coinPrice,
                diamondReward: catalogGift.diamondReward,
                icon: catalogGift.icon,
                imageUrl: catalogGift.imageUrl,
                videoUrl: catalogGift.videoUrl,
                soundUrl: catalogGift.soundUrl,
                effectDurationSec: catalogGift.effectDurationSec,
                accentColor: catalogGift.accentColor,
                animationType: catalogGift.animationType,
                soundEffect: catalogGift.soundEffect,
                isLucky: catalogGift.isLucky,
              },
              targetSeats: [],
              targetNames: msg.giftData.targetUserName || 'المتحدثين',
              count: msg.giftData.giftCount || 1,
              comboHits: 1,
              isLucky: Boolean(catalogGift.isLucky || catalogGift.category === 'lucky'),
            };
            handleIncomingRoomEventRef.current(syntheticEvent);
          }
        }
      }
    }
  }, [activeRoom?.id, activeRoomMessages, currentUser.id, gifts]);

  const myLiveRoomSeat = activeRoom?.seats.find((s) => s.userId === currentUser.id);
  const isSeatedInAgora = Boolean(myLiveRoomSeat);
  const isMyMicMutedInAgora = Boolean(myLiveRoomSeat?.isMuted);

  useEffect(() => {
    if (!activeRoom?.id) return;
    void agoraVoice.syncMicState(isSeatedInAgora, isMyMicMutedInAgora);
  }, [activeRoom?.id, isSeatedInAgora, isMyMicMutedInAgora]);

  useEffect(() => {
    agoraVoice.setRemoteAudioMuted(isRoomSoundMuted);
  }, [isRoomSoundMuted]);

  if (!activeRoom) return null;

  const isOwner = isRoomOwner(activeRoom);
  const isMod = isRoomModerator(activeRoom);
  const canManage = canManageRoom(activeRoom);

  const selectedAdminBg = activeRoom.backgroundId
    ? roomBackgrounds.find((b) => b.id === activeRoom.backgroundId)
    : undefined;
  const matchedBuiltInTheme = activeRoom.backgroundId
    ? ROOM_THEMES.find((t) => t.id === activeRoom.backgroundId)
    : undefined;
  const activeTheme =
    matchedBuiltInTheme || ROOM_THEMES.find((t) => t.id === themeId) || ROOM_THEMES[0];
  const resolvedRoomWallpaperUrl =
    activeRoom.backgroundUrl || selectedAdminBg?.imageUrl || activeTheme.image;
  const resolvedRoomWallpaperName =
    selectedAdminBg?.nameAr || activeTheme.name;

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
    const now = Date.now();
    const bagId = `lbag_${now}_${Math.random().toString(36).slice(2, 6)}`;
    handledRoomEventIdsRef.current.add(bagId);
    setActiveLuckyBag({
      id: bagId,
      tierName,
      senderName: currentUser.displayName,
      totalCoinsPool: rewardPoolCoins,
      rewardGifts: giftRewards,
      timeLeftMs: 10000,
      claimedByMe: false,
    });
    const bagEvent: RoomLiveEvent = {
      id: bagId,
      kind: 'lucky_bag',
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipLevel: currentUser.vipLevel,
      senderLevel: currentUser.level,
      createdAt: now,
      tierName,
      totalCoinsPool: rewardPoolCoins,
      rewardGifts: giftRewards,
    };
    selfHostedVoice.broadcastRoomEvent(bagEvent);
    void publishRoomLiveEventToFirestore(bagEvent).catch(() => {});
  };

  const handleClaimLuckyBag = () => {
    if (!activeLuckyBag || activeLuckyBag.claimedByMe) return;

    const wonCoins = activeLuckyBag.totalCoinsPool;
    const wonGifts = activeLuckyBag.rewardGifts;

    setActiveLuckyBag(null);
    rechargeCoins(wonCoins, `استلام ${activeLuckyBag.tierName}`);

    addBagGifts(wonGifts.map((g) => ({ giftId: g.giftId, count: g.count })));

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

    const resolvedRewards = resolveRocketBagGifts(tierToComplete.level, gifts);
    const wonGiftsSummary: { nameAr: string; icon: string; count: number }[] = resolvedRewards.map(
      (rg) => ({
        nameAr: rg.gift.nameAr,
        icon: rg.gift.icon,
        count: rg.count,
      })
    );
    if (resolvedRewards.length > 0) {
      addBagGifts(resolvedRewards.map((rg) => ({ giftId: rg.giftId, count: rg.count })));
    }

    setRocketRewardPopup({
      level: tierToComplete.level,
      nameAr: tierToComplete.nameAr,
      coinsWon: tierToComplete.rewardCoins,
      giftsWon: wonGiftsSummary,
    });

    const now = Date.now();
    const rocketEvId = `rocket_${now}_${Math.random().toString(36).slice(2, 6)}`;
    handledRoomEventIdsRef.current.add(rocketEvId);
    const nowTime = new Date(now).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setRoomEventLogs((prev) => [
      ...prev.slice(-30),
      {
        id: `log_rocket_${now}`,
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
    const rocketEvent: RoomLiveEvent = {
      id: rocketEvId,
      kind: 'rocket_explosion',
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipLevel: currentUser.vipLevel,
      senderLevel: currentUser.level,
      createdAt: now,
      rocketLevel: tierToComplete.level,
      rocketNameAr: tierToComplete.nameAr,
      rocketIcon: tierToComplete.icon,
      rewardCoins: tierToComplete.rewardCoins,
    };
    selfHostedVoice.broadcastRoomEvent(rocketEvent);
    void publishRoomLiveEventToFirestore(rocketEvent).catch(() => {});

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
        giftImageUrl: gift.imageUrl,
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
  // SHARED GIFT RENDERER (Plays identically for Sender + ALL Users in Room!)
  // Supports VAP transparent video, MP4/WebM/APNG/GIF/WebP, glide, combo, log
  // =========================================================================
  const buildGiftSnapshot = (gift: GiftItem): RoomLiveEventGiftSnapshot => ({
    id: gift.id,
    name: gift.name,
    nameAr: gift.nameAr,
    category: gift.category,
    coinPrice: gift.coinPrice,
    diamondReward: gift.diamondReward,
    icon: gift.icon,
    imageUrl: gift.imageUrl,
    videoUrl: gift.videoUrl,
    soundUrl: gift.soundUrl,
    effectDurationSec: gift.effectDurationSec,
    accentColor: gift.accentColor,
    animationType: gift.animationType,
    soundEffect: gift.soundEffect,
    isLucky: gift.isLucky,
  });

  const playGiftVisualsAndLog = (params: {
    gift: GiftItem;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    senderVipLevel: number;
    senderLevel: number;
    targetSeats: number[];
    targetLabel: string;
    count: number;
    comboHits: number;
    isLucky: boolean;
    luckyMultiplier?: number;
    luckyWinCoins?: number;
    now: number;
  }) => {
    const {
      gift,
      senderId,
      senderName,
      senderAvatar,
      senderVipLevel,
      senderLevel,
      targetSeats,
      targetLabel,
      count,
      comboHits,
      isLucky,
      luckyMultiplier,
      luckyWinCoins,
      now,
    } = params;

    // 1. Subtle single gift glide to target mic(s)
    if (targetSeats.length > 0) {
      triggerSubtleGiftGlide(gift, targetSeats, count);
    }

    // 1b. Play full-room transparent stage gift overlay (VAP / MP4 / WebM / APNG / GIF / WebP / PNG)
    const pulseKey = ++stagePulseCounterRef.current;
    if (gift.soundUrl) {
      sound.preloadAudioUrl(gift.soundUrl);
    }
    const stageMedia = resolveGiftStageMedia(gift);
    if (stageMedia.mediaUrl) {
      const mediaUrl = stageMedia.mediaUrl;
      setActiveStageGift((prev) => {
        if (prev && prev.mediaUrl === mediaUrl) {
          return {
            ...prev,
            comboPulseKey: pulseKey,
            giftName: gift.nameAr,
            senderName,
            soundEffect: gift.soundEffect,
            soundUrl: gift.soundUrl,
          };
        }
        return {
          id: `stage_${now}_${gift.id}_${pulseKey}`,
          mediaUrl,
          fallbackUrl: stageMedia.fallbackUrl,
          preferVideo: stageMedia.preferVideo,
          durationMs: stageMedia.durationMs,
          hasExplicitDuration: stageMedia.hasExplicitDuration,
          comboPulseKey: pulseKey,
          giftName: gift.nameAr,
          senderName,
          soundEffect: gift.soundEffect,
          soundUrl: gift.soundUrl,
        };
      });
    } else {
      sound.playGiftHitAudio(gift.soundEffect, gift.soundUrl, isRoomSoundMuted);
    }

    // 2. Push/Merge into Side Stacked Gift Combo Track (Max 2 clean banners)
    const trackKey = `${senderId}_${gift.id}_${targetLabel}`;
    setGiftComboTrack((prev) => {
      const existingIdx = prev.findIndex((item) => item.key === trackKey);
      const updatedItem: GiftComboTrackItem = {
        id: `${trackKey}_${now}`,
        key: trackKey,
        senderName,
        senderAvatar,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftImageUrl: gift.imageUrl,
        countPerHit: count,
        comboHits: existingIdx >= 0 ? prev[existingIdx].comboHits + 1 : comboHits,
        isLucky,
        luckyMultiplier,
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
        senderName,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftImageUrl: gift.imageUrl,
        count,
      });
      if (luxuryTimeoutRef.current) window.clearTimeout(luxuryTimeoutRef.current);
      luxuryTimeoutRef.current = window.setTimeout(() => setLuxuryNotice(null), 2800);
    }

    // 4. Clean Room Chat Log entry
    const nowTime = new Date(now).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setRoomEventLogs((prev) => [
      ...prev.slice(-30),
      {
        id: `log_gift_${now}_${Math.random()}`,
        type: isLucky && luckyWinCoins ? 'lucky_win' : 'gift_throw',
        senderName,
        vipLevel: senderVipLevel,
        level: senderLevel,
        targetNames: targetLabel,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftCount: count,
        comboHits,
        winCoins: luckyWinCoins,
        multiplier: luckyMultiplier,
        time: nowTime,
      },
    ]);
  };

  // Keep latest room event handler in ref so WS & Firestore listeners always see fresh room state
  handleIncomingRoomEventRef.current = (ev: RoomLiveEvent) => {
    if (!ev || !ev.id || !activeRoom || ev.roomId !== activeRoom.id) return;
    if (handledRoomEventIdsRef.current.has(ev.id)) return;
    handledRoomEventIdsRef.current.add(ev.id);
    if (handledRoomEventIdsRef.current.size > 400) {
      const oldest = Array.from(handledRoomEventIdsRef.current).slice(0, 150);
      oldest.forEach((k) => handledRoomEventIdsRef.current.delete(k));
    }

    const now = Date.now();
    if (ev.kind === 'gift_throw' && ev.gift) {
      const catalogMatch = gifts.find((g) => g.id === ev.gift!.id);
      const resolvedGift: GiftItem = {
        id: ev.gift.id,
        name: ev.gift.name || catalogMatch?.name || ev.gift.nameAr,
        nameAr: ev.gift.nameAr || catalogMatch?.nameAr || 'هدية',
        category: ev.gift.category || catalogMatch?.category || 'classic',
        coinPrice: ev.gift.coinPrice ?? catalogMatch?.coinPrice ?? 0,
        diamondReward: ev.gift.diamondReward ?? catalogMatch?.diamondReward ?? 0,
        icon: ev.gift.icon || catalogMatch?.icon || '🎁',
        imageUrl: ev.gift.imageUrl || catalogMatch?.imageUrl,
        videoUrl: ev.gift.videoUrl || catalogMatch?.videoUrl,
        soundUrl: ev.gift.soundUrl || catalogMatch?.soundUrl,
        effectDurationSec: ev.gift.effectDurationSec ?? catalogMatch?.effectDurationSec,
        accentColor: ev.gift.accentColor || catalogMatch?.accentColor || 'from-amber-400 to-orange-500',
        animationType: ev.gift.animationType || catalogMatch?.animationType || 'float_sparkle',
        soundEffect: ev.gift.soundEffect || catalogMatch?.soundEffect || 'chime',
        descriptionAr: catalogMatch?.descriptionAr || '',
        isLucky: ev.gift.isLucky ?? catalogMatch?.isLucky,
      };
      const validTargetSeats = (ev.targetSeats || []).filter((idx) => idx >= 0 && idx < 8);
      const targetLabel =
        ev.targetNames ||
        (validTargetSeats.length > 0 ? getTargetNamesLabel(validTargetSeats) : 'المتحدثين');
      playGiftVisualsAndLog({
        gift: resolvedGift,
        senderId: ev.senderId,
        senderName: ev.senderName || 'مستخدم',
        senderAvatar: ev.senderAvatar || '',
        senderVipLevel: ev.senderVipLevel || 0,
        senderLevel: ev.senderLevel || 1,
        targetSeats: validTargetSeats,
        targetLabel,
        count: Math.max(1, ev.count || 1),
        comboHits: Math.max(1, ev.comboHits || 1),
        isLucky: Boolean(ev.isLucky || resolvedGift.isLucky || resolvedGift.category === 'lucky'),
        luckyMultiplier: ev.luckyMultiplier,
        luckyWinCoins: ev.luckyWinCoins,
        now,
      });
    } else if (ev.kind === 'lucky_bag' && ev.tierName) {
      setActiveLuckyBag({
        id: ev.id,
        tierName: ev.tierName,
        senderName: ev.senderName || 'مستخدم',
        totalCoinsPool: ev.totalCoinsPool || 0,
        rewardGifts: ev.rewardGifts || [],
        timeLeftMs: 10000,
        claimedByMe: false,
      });
    } else if (ev.kind === 'rocket_explosion') {
      const nowTime = new Date(now).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      setRoomEventLogs((prev) => [
        ...prev.slice(-30),
        {
          id: `log_rocket_${now}_${Math.random()}`,
          type: 'rocket_explosion',
          senderName: ev.senderName || 'مستخدم',
          vipLevel: ev.senderVipLevel || 0,
          level: ev.senderLevel || 1,
          targetNames: 'الغرفة',
          giftName: ev.rocketNameAr || 'صاروخ الغرفة',
          giftIcon: ev.rocketIcon || '🚀',
          giftCount: 1,
          comboHits: ev.rocketLevel || 1,
          winCoins: ev.rewardCoins || 0,
          time: nowTime,
        },
      ]);
    } else if (ev.kind === 'seat_emoji' && typeof ev.seatIndex === 'number' && ev.emoji) {
      const targetIdx = ev.seatIndex;
      const emojiStr = ev.emoji;
      setSeatEmojis((prev) => ({ ...prev, [targetIdx]: emojiStr }));
      setTimeout(() => {
        setSeatEmojis((prev) => {
          if (prev[targetIdx] !== emojiStr) return prev;
          const copy = { ...prev };
          delete copy[targetIdx];
          return copy;
        });
      }, 3500);
    } else if (ev.kind === 'chat_message' && ev.text) {
      appendRoomMessage({
        id: ev.id,
        roomId: ev.roomId,
        senderId: ev.senderId,
        senderName: ev.senderName || 'مستخدم',
        senderAvatar: ev.senderAvatar || '',
        vipLevel: ev.senderVipLevel || 0,
        level: ev.senderLevel || 1,
        text: ev.text,
        isSystem: Boolean(ev.isSystem),
        timestamp:
          ev.timestamp ||
          new Date(ev.createdAt || now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  // =========================================================================
  // AUTHENTIC GIFT THROW HANDLER (Local + Broadcast to ALL Users in Room!)
  // =========================================================================
  const executeGiftThrow = (
    gift: GiftItem,
    count: number,
    targetSeats: number[],
    comboHits: number,
    fromBag = false,
    comboCumulativeCoins = 0
  ): boolean => {
    const finalTargets = targetSeats.filter((i) => i >= 0 && i < 8 && Boolean(seats8[i]?.userId));
    if (finalTargets.length === 0) return false;
    sound.unlockAudio();
    const targetLabel = getTargetNamesLabel(finalTargets);
    const totalNeededCount = count * finalTargets.length;
    const now = Date.now();
    lastLocalGiftThrowTsRef.current = now;

    if (fromBag) {
      const ownedCount = bagGifts[gift.id] || 0;
      if (ownedCount <= 0) return false;
      const deductCount = Math.min(ownedCount, totalNeededCount);
      const consumed = consumeBagGift(gift.id, deductCount);
      if (!consumed) return false;
    } else {
      const sentOk = sendGift(gift.id, count, 'seat', finalTargets[0], finalTargets, {
        skipLiveBroadcast: true,
      });
      if (!sentOk) return false;
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

    // Evaluate Lucky Gift Win via Dashboard-controlled probability & 1M+ global jackpot ticker
    const isLuckyGift =
      gift.isLucky || gift.category === 'lucky' || gift.animationType === 'lollipop_matrix';
    let luckyMult: number | undefined;
    let luckyWinCoins: number | undefined;

    if (isLuckyGift) {
      const effectiveCumulative = comboCumulativeCoins > 0 ? comboCumulativeCoins : totalGiftValue;
      const res = evaluateLuckyGiftWin(
        gift,
        count * finalTargets.length,
        comboHits,
        effectiveCumulative,
        activeRoom.title
      );
      if (res.won) {
        luckyMult = res.multiplier;
        luckyWinCoins = res.winCoins;
      }
    }

    // Play locally immediately & mark event ID so our own broadcast never double-plays
    const eventId = `gift_${now}_${Math.random().toString(36).slice(2, 7)}`;
    handledRoomEventIdsRef.current.add(eventId);
    playGiftVisualsAndLog({
      gift,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipLevel: currentUser.vipLevel,
      senderLevel: currentUser.level,
      targetSeats: finalTargets,
      targetLabel,
      count,
      comboHits,
      isLucky: isLuckyGift,
      luckyMultiplier: luckyMult,
      luckyWinCoins,
      now,
    });

    // Broadcast to EVERY user in the room over WebSocket + Firestore real-time channel
    const liveEvent: RoomLiveEvent = {
      id: eventId,
      kind: 'gift_throw',
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipLevel: currentUser.vipLevel,
      senderLevel: currentUser.level,
      createdAt: now,
      gift: buildGiftSnapshot(gift),
      targetSeats: finalTargets,
      targetNames: targetLabel,
      count,
      comboHits,
      isLucky: isLuckyGift,
      luckyMultiplier: luckyMult,
      luckyWinCoins,
    };
    selfHostedVoice.broadcastRoomEvent(liveEvent);
    void publishRoomLiveEventToFirestore(liveEvent).catch(() => {});

    return true;
  };

  const handleSendSelectedGift = () => {
    const giftObj = gifts.find((g) => g.id === selectedGiftId) || gifts[0];
    const targets = selectedRecipientSeats.filter((i) => i >= 0 && i < 8 && Boolean(seats8[i]?.userId));
    if (!giftObj || targets.length === 0) return;

    const isFromBag = giftDrawerTab === 'bag' && (bagGifts[giftObj.id] || 0) > 0;
    if (giftDrawerTab === 'bag' && !isFromBag) return;

    const hitCoins = giftObj.coinPrice * giftCount * targets.length;
    setActiveBottomDrawer('none');
    const ok = executeGiftThrow(giftObj, giftCount, targets, 1, isFromBag, hitCoins);
    if (!ok) return;

    setComboState({
      active: true,
      gift: giftObj,
      count: giftCount,
      targetSeats: targets,
      comboHits: 1,
      cumulativeCoins: hitCoins,
      timeLeftMs: 2000,
      fromBag: isFromBag,
    });
  };

  const handleComboClick = () => {
    if (!comboState) return;
    const nextCombo = comboState.comboHits + 1;
    const hitCoins = comboState.gift.coinPrice * comboState.count * comboState.targetSeats.length;
    const nextCumulative = comboState.cumulativeCoins + hitCoins;

    const ok = executeGiftThrow(
      comboState.gift,
      comboState.count,
      comboState.targetSeats,
      nextCombo,
      comboState.fromBag,
      nextCumulative
    );

    if (!ok) {
      setComboState(null);
      return;
    }

    setComboState({
      ...comboState,
      comboHits: nextCombo,
      cumulativeCoins: nextCumulative,
      timeLeftMs: 2000,
    });
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

    const now = Date.now();
    const emojiEvId = `emoji_${now}_${Math.random().toString(36).slice(2, 6)}`;
    handledRoomEventIdsRef.current.add(emojiEvId);
    setSeatEmojis((prev) => ({ ...prev, [targetIdx]: emoji }));
    setActiveBottomDrawer('none');
    setTimeout(() => {
      setSeatEmojis((prev) => {
        const copy = { ...prev };
        delete copy[targetIdx];
        return copy;
      });
    }, 3500);

    const emojiEvent: RoomLiveEvent = {
      id: emojiEvId,
      kind: 'seat_emoji',
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      senderVipLevel: currentUser.vipLevel,
      senderLevel: currentUser.level,
      createdAt: now,
      seatIndex: targetIdx,
      emoji,
    };
    selfHostedVoice.broadcastRoomEvent(emojiEvent);
    void publishRoomLiveEventToFirestore(emojiEvent).catch(() => {});
  };

  const handleClearHeartValue = (seatIndex: number) => {
    if (!canManage) return;
    clearSeatHeartPoints(seatIndex);
    setSeatHeartsOverride((prev) => {
      const copy = { ...prev };
      delete copy[seatIndex];
      return copy;
    });
    setActiveBottomDrawer('none');
  };

  const handleToggleLockAllSeats = () => {
    if (!canManage) return;
    toggleAllSeatsLock();
  };

  const openRoomSettingsDrawer = (tab: 'backgrounds' | 'privacy' | 'moderation' = 'backgrounds') => {
    setNoticeDraft(activeRoom.announcement || roomNotice);
    setTitleDraft(activeRoom.title);
    setPrivacyTypeDraft(activeRoom.type);
    setPasswordDraft(activeRoom.password || '');
    setIsLockedDraft(Boolean(activeRoom.isLocked));
    setSettingsFeedback(null);
    setRoomSettingsTab(tab);
    setActiveBottomDrawer('room_settings');
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
    <div
      onPointerDownCapture={() => {
        sound.unlockAudio();
        agoraVoice.resumeRemoteAudio();
      }}
      className="relative h-dvh w-full bg-[#090c14] flex items-center justify-center font-tajawal select-none overflow-hidden"
    >
      {/* Desktop Ambient Backdrop so wide viewports never look like an empty void */}
      <div className="hidden sm:block fixed inset-0 pointer-events-none">
        <img
          src={resolvedRoomWallpaperUrl}
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
          src={resolvedRoomWallpaperUrl}
          alt={resolvedRoomWallpaperName}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070a13]/75 via-[#090d18]/45 to-[#060810]/92 pointer-events-none" />

        {/* ================================================================= */}
        {/* FULL-ROOM STAGE GIFT OVERLAY (MP4 / WebM / GIF / WebP / PNG)       */}
        {/* ================================================================= */}
        {activeStageGift && (
          <SmartMediaView
            key={activeStageGift.id}
            mode="stage"
            url={activeStageGift.mediaUrl}
            fallbackUrl={activeStageGift.fallbackUrl}
            preferVideo={activeStageGift.preferVideo}
            alt={activeStageGift.giftName}
            muted={isRoomSoundMuted}
            durationMs={activeStageGift.durationMs}
            hasExplicitDuration={activeStageGift.hasExplicitDuration}
            resetKey={activeStageGift.comboPulseKey}
            onReady={() => {
              if (lastPlayedStageSoundKeyRef.current !== activeStageGift.comboPulseKey) {
                lastPlayedStageSoundKeyRef.current = activeStageGift.comboPulseKey;
                sound.playGiftHitAudio(
                  activeStageGift.soundEffect,
                  activeStageGift.soundUrl,
                  isRoomSoundMuted
                );
              }
            }}
            onEnded={() => {
              if (lastPlayedStageSoundKeyRef.current !== activeStageGift.comboPulseKey) {
                lastPlayedStageSoundKeyRef.current = activeStageGift.comboPulseKey;
                sound.playGiftHitAudio(
                  activeStageGift.soundEffect,
                  activeStageGift.soundUrl,
                  isRoomSoundMuted
                );
              }
              setActiveStageGift(null);
            }}
          />
        )}

        {/* ================================================================= */}
        {/* FULL-ROOM ENTRANCE EFFECT OVERLAY (MP4 / WebM / GIF / WebP / PNG) */}
        {/* ================================================================= */}
        {entranceBanner && (() => {
          const fallbackResolved = resolveEntranceStageMedia({
            videoUrl: entranceBanner.entranceVideoUrl,
            previewUrl: entranceBanner.entrancePreviewUrl,
          });
          const stageUrl = entranceBanner.entranceMediaUrl || fallbackResolved.primaryUrl;
          const stagePreferVideo =
            entranceBanner.preferVideo !== undefined
              ? entranceBanner.preferVideo
              : fallbackResolved.preferVideo;
          const stageDurationMs = entranceBanner.durationMs || fallbackResolved.durationMs;
          const stageHasExplicitDuration =
            entranceBanner.hasExplicitDuration ?? fallbackResolved.hasExplicitDuration;

          return (
            <>
              {stageUrl && (
                <SmartMediaView
                  key={entranceBanner.id}
                  mode="stage"
                  url={stageUrl}
                  fallbackUrl={entranceBanner.entrancePreviewUrl}
                  preferVideo={stagePreferVideo}
                  alt={entranceBanner.entranceName}
                  muted={isRoomSoundMuted}
                  durationMs={stageDurationMs}
                  hasExplicitDuration={stageHasExplicitDuration}
                  resetKey={entranceBanner.id}
                  onEnded={clearEntranceBanner}
                />
              )}

              <div className="absolute top-[104px] inset-x-3.5 z-[45] pointer-events-none flex justify-center">
                <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#1d1408]/95 via-[#31210d]/95 to-[#1d1408]/95 border border-amber-400/60 backdrop-blur-md shadow-2xl flex items-center gap-2.5 animate-gift-banner">
                  {entranceBanner.userAvatar && (
                    <img
                      src={entranceBanner.userAvatar}
                      alt={entranceBanner.userName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-amber-400 shrink-0"
                    />
                  )}
                  {entranceBanner.entrancePreviewUrl ? (
                    <SmartMediaView
                      mode="thumbnail"
                      url={entranceBanner.entrancePreviewUrl}
                      alt={entranceBanner.entranceName}
                      className="w-8 h-8 rounded-lg object-contain shrink-0"
                      fallback={<span className="text-xl shrink-0">{entranceBanner.entranceIcon}</span>}
                    />
                  ) : (
                    <span className="text-xl shrink-0">{entranceBanner.entranceIcon}</span>
                  )}
                  <div className="text-xs text-right leading-snug">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-amber-300">{entranceBanner.userName}</span>
                      {entranceBanner.vipLevel > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px]">
                          VIP {entranceBanner.vipLevel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-200">
                      دخل بـ <span className="font-bold text-amber-200">{entranceBanner.entranceName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

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
              className="w-10 h-10 rounded-full bg-slate-950/70 backdrop-blur-sm border border-amber-400/50 flex items-center justify-center text-xl shadow-lg overflow-hidden"
            >
              {glide.giftImageUrl ? (
                <img
                  src={glide.giftImageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 object-contain"
                />
              ) : (
                glide.giftIcon
              )}
            </div>
          ))}
        </div>

        {/* ================================================================= */}
        {/* ULTRA-LUXURY GIFT TOP STRIP (Only for >= 50,000 coin gifts)       */}
        {/* ================================================================= */}
        {luxuryNotice && (
          <div className="absolute top-[108px] inset-x-3 z-40 pointer-events-none flex justify-center">
            <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-[#1c1308]/95 via-[#2e1f0c]/95 to-[#1c1308]/95 border border-amber-400/50 backdrop-blur-md shadow-xl flex items-center gap-2.5 animate-gift-banner">
              {luxuryNotice.giftImageUrl ? (
                <img
                  src={luxuryNotice.giftImageUrl}
                  alt={luxuryNotice.giftName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-contain shrink-0"
                />
              ) : (
                <span className="text-xl">{luxuryNotice.giftIcon}</span>
              )}
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

        {(() => {
          const rawBannerMsg = voiceNotice || agoraStatus.errorMessage || agoraStatus.micError;
          const voiceErrorKey = `${agoraStatus.channel || ''}:${agoraStatus.errorMessage || agoraStatus.micError || ''}`;
          const showErrorBanner =
            Boolean(voiceNotice) ||
            ((agoraStatus.state === 'error' || Boolean(agoraStatus.micError)) &&
              dismissedVoiceErrorKey !== voiceErrorKey &&
              Boolean(rawBannerMsg));

          if (!agoraStatus.autoplayBlocked && !showErrorBanner) return null;

          return (
            <div className="absolute top-[112px] inset-x-4 z-50 flex justify-center">
              {agoraStatus.autoplayBlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    sound.unlockAudio();
                    setIsRoomSoundMuted(false);
                    agoraVoice.setRemoteAudioMuted(false);
                    agoraVoice.resumeRemoteAudio(true);
                    setVoiceNotice(null);
                  }}
                  className="px-4 py-2 rounded-2xl bg-emerald-600/95 hover:bg-emerald-500 border border-emerald-300/60 text-white text-xs font-black shadow-2xl backdrop-blur-md flex items-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  <span>اضغط هنا لتفعيل سماع الصوت المباشر</span>
                </button>
              ) : (
                <div className="px-3 py-2 rounded-2xl bg-rose-950/95 border border-rose-400/50 text-rose-100 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-full">
                  <span className="flex-1 leading-relaxed">{rawBannerMsg}</span>
                  {(agoraStatus.state === 'error' || agoraStatus.micError) && (
                    <button
                      type="button"
                      onClick={() => {
                        sound.unlockAudio();
                        setVoiceNotice(null);
                        setDismissedVoiceErrorKey(null);
                        if (agoraStatus.state === 'error') {
                          void agoraVoice.reconnectActiveRoom();
                        } else {
                          void agoraVoice.retryMicPublish();
                        }
                      }}
                      className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] shrink-0 cursor-pointer"
                    >
                      {agoraStatus.state === 'error' ? 'إعادة ربط الصوت' : 'تفعيل المايك'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceNotice(null);
                      setDismissedVoiceErrorKey(voiceErrorKey);
                    }}
                    aria-label="إغلاق التنبيه"
                    className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 text-rose-200 flex items-center justify-center shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* ================================================================= */}
        {/* 1. TOP ROOM HEADER BAR (Clean Flagship Voice Room Architecture)   */}
        {/* ================================================================= */}
        <header className="relative z-30 shrink-0 pt-3 px-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* Right in RTL (First in DOM): Room Identity */}
            <div className="flex items-center gap-2.5 min-w-0 bg-black/35 backdrop-blur-md pl-3 pr-1.5 py-1.5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  const ownerProfile =
                    users.find((u) => u.id === activeRoom.ownerId) ||
                    (activeRoom.ownerId === currentUser.id
                      ? currentUser
                      : {
                          ...currentUser,
                          id: activeRoom.ownerId,
                          displayName: activeRoom.ownerName || activeRoom.title,
                          avatar: activeRoom.ownerAvatar || currentUser.avatar,
                        });
                  setViewingProfileUser(ownerProfile);
                  setActiveModal('profile');
                }}
                title={activeRoom.ownerId === currentUser.id ? 'فتح البروفايل الخاص بي' : 'فتح البروفايل'}
                className="relative shrink-0 rounded-xl focus:outline-none hover:ring-2 hover:ring-amber-400/70 transition-all"
              >
                <img
                  src={activeRoom.ownerAvatar || currentUser.avatar}
                  alt={activeRoom.title}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border border-amber-400/40"
                />
              </button>
              <div className="min-w-0 text-right">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h1 className="text-[13px] font-bold text-white truncate leading-tight">
                    {activeRoom.title}
                  </h1>
                  {activeRoom.isLocked && (
                    <span title="غرفة مقفلة" className="inline-flex shrink-0">
                      <Lock className="w-3 h-3 text-rose-400" />
                    </span>
                  )}
                  {!activeRoom.isLocked && activeRoom.type === 'password' && (
                    <span title="غرفة برمز مرور" className="inline-flex shrink-0">
                      <KeyRound className="w-3 h-3 text-amber-400" />
                    </span>
                  )}
                  {activeRoom.type === 'vip' && (
                    <span className="px-1 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-black shrink-0">
                      VIP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <button
                    onClick={handleCopyRoomId}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-amber-300 transition-colors font-mono tabular-nums"
                    title="نسخ رقم الغرفة"
                  >
                    <span>ID {activeRoom.roomNo || '2026091'}</span>
                    {idCopied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 opacity-70" />
                    )}
                  </button>
                  {isOwner ? (
                    <span className="px-1.5 py-0.2 rounded bg-amber-400/15 border border-amber-400/35 text-[9px] font-bold text-amber-300 shrink-0">
                      المالك
                    </span>
                  ) : isMod ? (
                    <span className="px-1.5 py-0.2 rounded bg-sky-500/20 border border-sky-400/40 text-[9px] font-bold text-sky-300 shrink-0">
                      مشرف
                    </span>
                  ) : null}
                </div>
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
                onClick={() => openRoomSettingsDrawer(canManage ? 'privacy' : 'backgrounds')}
                className="w-9 h-9 rounded-xl bg-black/35 backdrop-blur-md border border-white/10 flex items-center justify-center text-slate-200 hover:bg-white/10 transition-colors"
                title="إعدادات وخصوصية الغرفة"
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
                onClick={() => openRoomSettingsDrawer(canManage ? 'privacy' : 'backgrounds')}
                className="h-7 px-2.5 rounded-lg bg-black/25 backdrop-blur-sm border border-white/8 flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors min-w-0 max-w-[185px]"
              >
                <Megaphone className="w-3 h-3 text-amber-400/80 shrink-0" />
                <span className="truncate">{roomNotice}</span>
              </button>
            </div>

            {/* Compact Voice Live + Rocket Progress Chip */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(agoraStatus.state === 'connected' ||
                agoraStatus.state === 'connecting' ||
                agoraLiveMicActive ||
                agoraStatus.requiresToken) && (
                <button
                  type="button"
                  onClick={() => {
                    sound.unlockAudio();
                    agoraVoice.primeFromUserGesture();
                    agoraVoice.resumeRemoteAudio(true);
                    if (agoraStatus.state === 'error') {
                      setDismissedVoiceErrorKey(null);
                      void agoraVoice.reconnectActiveRoom();
                    }
                  }}
                  title={
                    agoraStatus.provider === 'self_hosted'
                      ? `السيرفر الصوتي الخاص (${agoraStatus.channel || activeRoom.id})`
                      : `قناة Agora (${agoraStatus.channel || agoraStatus.appId})`
                  }
                  className={`h-7 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition-colors ${
                    agoraStatus.state === 'connecting'
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                      : agoraLiveMicActive
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                      : agoraStatus.requiresToken
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                      : 'bg-black/35 border-emerald-500/30 text-emerald-300/90'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      agoraStatus.state === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : agoraLiveMicActive
                        ? 'bg-emerald-400 animate-ping'
                        : agoraStatus.requiresToken
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span>
                    {agoraStatus.state === 'connecting'
                      ? 'جاري ربط الصوت'
                      : agoraLiveMicActive
                      ? agoraStatus.state === 'connected'
                        ? agoraStatus.remoteUsersCount > 0
                          ? `مايك مباشر · ${agoraStatus.remoteUsersCount}`
                          : 'مايك مباشر'
                        : 'مايك محلي'
                      : agoraStatus.requiresToken
                      ? 'يلزم Token'
                      : agoraStatus.remoteUsersCount > 0
                      ? `صوت متصل · ${agoraStatus.remoteUsersCount}`
                      : 'صوت متصل'}
                  </span>
                </button>
              )}

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
          </div>
        </header>

        {/* ================================================================= */}
        {/* 2. SPACIOUS 8-MIC VOICE STAGE (2 Rows × 4 Mics — Clean Frames)    */}
        {/* ================================================================= */}
        <section className="relative z-20 shrink-0 px-3.5 pt-4 pb-2">
          <div className="grid grid-cols-4 gap-x-2 gap-y-6">
            {seats8.map((seat, idx) => {
              const isHostSeat = idx === 0;
              const heartVal =
                seatHeartsOverride[idx] !== undefined
                  ? seatHeartsOverride[idx]
                  : seat.heartPoints || 0;
              const activeEmoji = seatEmojis[idx];
              const seatPulse = seatPulseMap[idx];
              const isOccupied = Boolean(seat.userId);
              const liveAgoraLevel = seat.userId ? agoraVolumes[seat.userId] : undefined;
              const isSpeaking =
                isOccupied &&
                !seat.isMuted &&
                (seat.userId === currentUser.id && agoraLiveMicActive
                  ? (liveAgoraLevel ?? 0) > 2
                  : liveAgoraLevel !== undefined
                  ? liveAgoraLevel > 2
                  : seat.isSpeaking);
              const seatUserProfile = seat.userId
                ? users.find((u) => u.id === seat.userId)
                : undefined;
              const resolvedAvatar =
                seat.userId === currentUser.id
                  ? currentUser.avatar
                  : seat.userAvatar || seatUserProfile?.avatar || '';
              const activeSeatFrameId =
                seat.userId === currentUser.id
                  ? currentUser.activeFrameId
                  : seatUserProfile?.activeFrameId !== undefined
                  ? seatUserProfile.activeFrameId
                  : seat.activeFrameId;
              const seatFrame = activeSeatFrameId
                ? storeItems.find((i) => i.type === 'frame' && i.id === activeSeatFrameId)
                : undefined;
              const hasUploadedFrame = isOccupied && Boolean(seatFrame?.previewUrl);

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

                  {/* Circular Seat Pod — Large clean stage when wearing frame, no mic/rim peeking behind */}
                  <div className="relative w-[74px] h-[74px] flex items-center justify-center">
                    {/* Speaking Ring: kept cleanly behind non-framed seats; subtle tight halo on framed avatars */}
                    {isSpeaking && !hasUploadedFrame && (
                      <>
                        <span className="absolute inset-1 rounded-full border border-amber-400/75 animate-mic-wave pointer-events-none" />
                        <span
                          className="absolute inset-1 rounded-full border border-emerald-400/50 animate-mic-wave pointer-events-none"
                          style={{ animationDelay: '0.55s' }}
                        />
                      </>
                    )}

                    {/* Subtle Gift Receive Ring */}
                    {seatPulse && (
                      <span className="absolute inset-0 rounded-full border-2 border-amber-400/80 transition-opacity pointer-events-none z-10" />
                    )}

                    {isOccupied ? (
                      hasUploadedFrame ? (
                        /* Occupied Seat WITH Uploaded Frame: Concentrically centered avatar inside balanced frame */
                        <>
                          <div
                            className={`relative z-10 w-[44px] h-[44px] rounded-full overflow-hidden flex items-center justify-center transition-transform duration-150 group-active:scale-95 ${
                              isSpeaking ? 'ring-2 ring-amber-400/70' : ''
                            }`}
                          >
                            {resolvedAvatar ? (
                              <img
                                src={resolvedAvatar}
                                alt={seat.userName || `مايك ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-sm font-black text-amber-300">
                                {(seat.userName || 'U').slice(0, 1)}
                              </div>
                            )}
                          </div>

                          <img
                            src={seatFrame!.previewUrl}
                            alt={seatFrame!.nameAr}
                            referrerPolicy="no-referrer"
                            className="pointer-events-none select-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84px] h-[84px] object-contain z-20 drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
                          />
                        </>
                      ) : (
                        /* Occupied Seat WITHOUT Uploaded Frame: Crisp circular avatar rim (never shows empty mic) */
                        <div
                          className={`w-[58px] h-[58px] rounded-full p-[2px] transition-transform duration-150 group-active:scale-95 ${
                            isHostSeat
                              ? 'bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_6px_20px_rgba(245,158,11,0.35)]'
                              : 'bg-gradient-to-b from-slate-200/80 via-slate-400/50 to-slate-700/70 shadow-lg'
                          }`}
                        >
                          {resolvedAvatar ? (
                            <img
                              src={resolvedAvatar}
                              alt={seat.userName || `مايك ${idx + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full rounded-full object-cover bg-slate-900"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-sm font-black text-amber-300">
                              {(seat.userName || 'U').slice(0, 1)}
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      /* Empty / Locked Mic Seat */
                      <div
                        className={`w-[58px] h-[58px] rounded-full p-[2px] transition-transform duration-150 group-active:scale-95 ${
                          isHostSeat
                            ? 'bg-gradient-to-b from-amber-400/50 to-amber-700/20'
                            : 'bg-white/12 group-hover:bg-white/20'
                        }`}
                      >
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
                      </div>
                    )}

                    {/* Host Seat #1 Crown Marker (Hidden when wearing large custom frame so it stays clean) */}
                    {isHostSeat && !hasUploadedFrame && (
                      <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-30 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                        <Crown className="w-3 h-3" />
                      </span>
                    )}

                    {/* Seat Index Number Badge (Only when empty & unlocked) */}
                    {!isOccupied && !seat.isLocked && (
                      <span className="absolute bottom-1 right-1 z-20 w-4 h-4 rounded-full bg-[#121829] border border-white/15 text-[9px] font-mono tabular-nums font-bold text-slate-300 flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}

                    {/* Muted Mic Badge */}
                    {isOccupied && seat.isMuted && (
                      <span className="absolute bottom-1 right-1 z-30 w-5 h-5 rounded-full bg-rose-600 border-2 border-[#0e1322] flex items-center justify-center shadow">
                        <MicOff className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}

                    {/* Room Moderator Shield Marker */}
                    {isOccupied &&
                      seat.userId &&
                      seat.userId !== activeRoom.ownerId &&
                      activeRoom.moderators.includes(seat.userId) && (
                        <span
                          className="absolute bottom-1 left-1 z-30 w-5 h-5 rounded-full bg-sky-500 border-2 border-[#0e1322] flex items-center justify-center shadow"
                          title="مشرف الغرفة"
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-slate-950" />
                        </span>
                      )}

                    {/* Locked Overlay on Occupied Seat */}
                    {isOccupied && seat.isLocked && (
                      <span className="absolute inset-2 z-30 rounded-full bg-black/55 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-amber-400" />
                      </span>
                    )}
                  </div>

                  {/* Seat Name / Label */}
                  <span
                    className={`mt-2.5 text-[11px] font-medium truncate max-w-[78px] leading-tight ${
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

              {/* Gift Icon / Custom URL */}
              <div className="w-9 h-9 rounded-full bg-white/8 border border-white/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                {item.giftImageUrl ? (
                  <img
                    src={item.giftImageUrl}
                    alt={item.giftName}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 object-contain"
                  />
                ) : (
                  item.giftIcon
                )}
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
                    <button
                      type="button"
                      onClick={() => {
                        const target =
                          users.find((u) => u.id === msg.senderId) ||
                          (msg.senderId === currentUser.id ? currentUser : null);
                        if (target) {
                          setViewingProfileUser(target);
                          setActiveModal('profile');
                        }
                      }}
                      className="font-semibold text-amber-200 hover:text-amber-300 underline-offset-2 hover:underline ml-1.5"
                    >
                      {msg.senderName}:
                    </button>
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
                {comboState.gift.imageUrl ? (
                  <img
                    src={comboState.gift.imageUrl}
                    alt={comboState.gift.nameAr}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 object-contain"
                  />
                ) : (
                  <span className="text-lg">{comboState.gift.icon}</span>
                )}
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
                    sound.unlockAudio();
                    agoraVoice.primeFromUserGesture();
                    agoraVoice.resumeRemoteAudio(true);
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
                  onClick={() => {
                    const nextMuted = !isRoomSoundMuted;
                    setIsRoomSoundMuted(nextMuted);
                    agoraVoice.setRemoteAudioMuted(nextMuted);
                    if (nextMuted) {
                      sound.stopAllCustomAudio();
                    } else {
                      sound.unlockAudio();
                      agoraVoice.resumeRemoteAudio(true);
                    }
                  }}
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
              {filteredDrawerGifts.length === 0 ? (
                <div className="py-10 text-center space-y-2.5">
                  <div className="text-3xl opacity-80">{giftDrawerTab === 'bag' ? '🎒' : '🎁'}</div>
                  <p className="text-xs text-slate-400">
                    {giftDrawerTab === 'bag'
                      ? 'الحقيبة فارغة حالياً — يمكنك الحصول على هدايا مجانية من صاروخ الغرفة أو كيس الحظ.'
                      : 'لا توجد هدايا مرفوعة في هذا التصنيف حالياً.'}
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

                        {(g.videoUrl || g.imageUrl) && (
                          <span className="absolute top-1.5 left-1.5 text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-purple-500/30 text-purple-200">
                            {getMediaFormatLabel(g.videoUrl || g.imageUrl)}
                          </span>
                        )}

                        {g.imageUrl || g.videoUrl ? (
                          <SmartMediaView
                            mode="thumbnail"
                            url={g.imageUrl || g.videoUrl}
                            preferVideo={!g.imageUrl && Boolean(g.videoUrl)}
                            alt={g.nameAr}
                            className="w-10 h-10 object-contain my-1 rounded-lg"
                            fallback={<div className="text-3xl my-1">{g.icon}</div>}
                          />
                        ) : (
                          <div className="text-3xl my-1">{g.icon}</div>
                        )}
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
                  onClick={() => openRoomSettingsDrawer('backgrounds')}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <SlidersHorizontal className="w-6 h-6 text-slate-300" />
                  <span className="text-xs font-medium text-slate-200">
                    {canManage ? 'الخصوصية والخلفية' : 'مظهر الغرفة'}
                  </span>
                </button>

                {canManage && (
                  <button
                    onClick={() => openRoomSettingsDrawer('moderation')}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-400/25 transition-colors"
                  >
                    <ShieldCheck className="w-6 h-6 text-sky-400" />
                    <span className="text-xs font-medium text-sky-200">الإشراف والحظر</span>
                  </button>
                )}

                {canManage && (
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
                )}

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
        {/* DRAWER 3: ROOM SETTINGS (Backgrounds + Privacy + Moderation)      */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'room_settings' && (
          <div
            className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end"
            onClick={() => setActiveBottomDrawer('none')}
          >
            <div
              className="w-full max-h-[82dvh] bg-[#111522] border-t border-white/12 rounded-t-3xl p-4 pb-6 text-white flex flex-col gap-3.5 shadow-2xl overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto shrink-0" />
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <h3 className="text-sm font-bold text-white">إدارة ومظهر وخصوصيات الغرفة</h3>
                  <p className="text-[11px] text-slate-400">
                    {isOwner
                      ? 'أنت مالك الغرفة — لديك صلاحية كاملة وإدارة المشرفين'
                      : isMod
                      ? 'أنت مشرف في الغرفة — لديك صلاحيات إدارة الغرفة والخصوصية'
                      : 'عرض حالة الغرفة فقط (التعديل متاح للمالك والمشرفين)'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveBottomDrawer('none')}
                  className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center text-slate-400 hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Settings Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.04] border border-white/8 text-xs font-bold">
                <button
                  onClick={() => setRoomSettingsTab('backgrounds')}
                  className={`py-2 rounded-xl transition-colors ${
                    roomSettingsTab === 'backgrounds'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  خلفيات الغرفة
                </button>
                <button
                  onClick={() => setRoomSettingsTab('privacy')}
                  className={`py-2 rounded-xl transition-colors ${
                    roomSettingsTab === 'privacy'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  خصوصيات الغرفة
                </button>
                <button
                  onClick={() => setRoomSettingsTab('moderation')}
                  className={`py-2 rounded-xl transition-colors ${
                    roomSettingsTab === 'moderation'
                      ? 'bg-sky-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  الإشراف ({activeRoom.moderators.length})
                </button>
              </div>

              {settingsFeedback && (
                <div className="px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs text-right">
                  {settingsFeedback}
                </div>
              )}

              {/* TAB 1: ROOM WALLPAPERS (Built-in + Admin Dashboard URLs) */}
              {roomSettingsTab === 'backgrounds' && (
                <div className="space-y-3.5 text-right">
                  {!canManage && (
                    <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                      ملاحظة: اختيار أو تغيير خلفية الغرفة متاح لمالك الغرفة والمشرفين فقط.
                    </div>
                  )}

                  {roomBackgrounds.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-300">
                          خلفيات الغرف المميزة ({roomBackgrounds.length})
                        </label>
                        <span className="text-[10px] text-slate-400">مرفوعة من الإدارة</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        {roomBackgrounds.map((bg) => {
                          const isSelectedBg =
                            activeRoom.backgroundId === bg.id ||
                            activeRoom.backgroundUrl === bg.imageUrl;
                          return (
                            <button
                              key={bg.id}
                              type="button"
                              disabled={!canManage}
                              onClick={() => {
                                const ok = updateRoomPrivacySettings(activeRoom.id, {
                                  backgroundId: bg.id,
                                  backgroundUrl: bg.imageUrl,
                                  coverImage: bg.imageUrl,
                                });
                                if (ok) {
                                  setSettingsFeedback(`تم تطبيق خلفية "${bg.nameAr}" للغرفة`);
                                }
                              }}
                              className={`relative h-24 rounded-2xl overflow-hidden border-2 transition-all ${
                                isSelectedBg
                                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                                  : 'border-white/10 opacity-80 hover:opacity-100'
                              } ${!canManage ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <img
                                src={bg.imageUrl}
                                alt={bg.nameAr}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-x-0 bottom-0 py-1 px-1.5 bg-black/75 text-[10px] font-semibold text-white truncate">
                                {bg.nameAr}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300">الخلفيات الافتراضية</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {ROOM_THEMES.map((t) => {
                        const isSelectedBuiltIn =
                          !activeRoom.backgroundUrl &&
                          (activeRoom.backgroundId === t.id ||
                            (!activeRoom.backgroundId && themeId === t.id));
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={!canManage}
                            onClick={() => {
                              setThemeId(t.id);
                              const ok = updateRoomPrivacySettings(activeRoom.id, {
                                backgroundId: t.id,
                                backgroundUrl: '',
                              });
                              if (ok) {
                                setSettingsFeedback(`تم تطبيق خلفية "${t.name}"`);
                              }
                            }}
                            className={`relative h-24 rounded-2xl overflow-hidden border-2 transition-all ${
                              isSelectedBuiltIn
                                ? 'border-amber-400'
                                : 'border-white/10 opacity-75 hover:opacity-100'
                            } ${!canManage ? 'cursor-not-allowed opacity-60' : ''}`}
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
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ROOM PRIVACY SETTINGS */}
              {roomSettingsTab === 'privacy' && (
                <div className="space-y-3.5 text-right">
                  {!canManage && (
                    <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200">
                      خصوصيات الغرفة محمية — يملك صلاحية التعديل مالك الغرفة أو من منحه المالك إشرافاً.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">اسم الغرفة</label>
                    <input
                      type="text"
                      disabled={!canManage}
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      className="w-full h-10 rounded-xl bg-white/6 border border-white/12 px-3 text-xs text-white focus:border-amber-400 focus:outline-none disabled:opacity-50"
                      placeholder="عنوان الغرفة..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">إعلان الغرفة</label>
                    <input
                      type="text"
                      disabled={!canManage}
                      value={noticeDraft}
                      onChange={(e) => setNoticeDraft(e.target.value)}
                      className="w-full h-10 rounded-xl bg-white/6 border border-white/12 px-3 text-xs text-white focus:border-amber-400 focus:outline-none disabled:opacity-50"
                      placeholder="اكتب إعلان الغرفة..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">مستوى دخول الغرفة</label>
                    <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                      {[
                        { id: 'public', label: 'مفتوحة للجميع' },
                        { id: 'password', label: 'برمز دخول 🔑' },
                        { id: 'vip', label: 'VIP فقط 👑' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!canManage}
                          onClick={() => setPrivacyTypeDraft(opt.id as 'public' | 'vip' | 'password')}
                          className={`py-2.5 px-2 rounded-xl border transition-colors ${
                            privacyTypeDraft === opt.id
                              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                              : 'bg-white/[0.04] border-white/10 text-slate-300'
                          } disabled:opacity-50`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {privacyTypeDraft === 'password' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-amber-300">رمز مرور الدخول للغرفة</label>
                      <input
                        type="text"
                        disabled={!canManage}
                        value={passwordDraft}
                        onChange={(e) => setPasswordDraft(e.target.value)}
                        className="w-full h-10 rounded-xl bg-white/6 border border-amber-400/35 px-3 text-xs font-mono text-white focus:border-amber-400 focus:outline-none disabled:opacity-50"
                        placeholder="أدخل رمز الغرفة (مثال: 1234)"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div>
                      <div className="text-xs font-bold text-white">قفل الغرفة بالكامل</div>
                      <div className="text-[10px] text-slate-400">
                        منع دخول أي زوار جدد (ماعدا المالك والمشرفين)
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={() => setIsLockedDraft((prev) => !prev)}
                      className={`h-9 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors ${
                        isLockedDraft
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      } disabled:opacity-50`}
                    >
                      {isLockedDraft ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      <span>{isLockedDraft ? 'مقفلة' : 'مفتوحة'}</span>
                    </button>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleToggleLockAllSeats}
                        className="h-10 px-3.5 rounded-xl bg-white/8 hover:bg-white/14 text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{seats8.some((s) => !s.isLocked) ? 'قفل المايكات' : 'فتح المايكات'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (privacyTypeDraft === 'password' && !passwordDraft.trim()) {
                            setSettingsFeedback('يرجى إدخال رمز مرور الغرفة أولاً.');
                            return;
                          }
                          const ok = updateRoomPrivacySettings(activeRoom.id, {
                            title: titleDraft.trim() || activeRoom.title,
                            announcement: noticeDraft.trim() || activeRoom.announcement,
                            type: privacyTypeDraft,
                            password: privacyTypeDraft === 'password' ? passwordDraft.trim() : '',
                            isLocked: isLockedDraft,
                          });
                          if (ok) {
                            if (noticeDraft.trim()) setRoomNotice(noticeDraft.trim());
                            setSettingsFeedback('تم حفظ خصوصيات وإعدادات الغرفة بنجاح.');
                          }
                        }}
                        className="flex-1 h-10 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-colors"
                      >
                        حفظ خصوصيات الغرفة
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ROOM MODERATION & BAN MANAGEMENT */}
              {roomSettingsTab === 'moderation' && (() => {
                const roomUserIds = new Set<string>();
                seats8.forEach((s) => {
                  if (s.userId) roomUserIds.add(s.userId);
                });
                activeRoomMessages.forEach((m) => {
                  if (m.senderId && m.senderId !== 'system') roomUserIds.add(m.senderId);
                });
                activeRoom.moderators.forEach((id) => roomUserIds.add(id));

                const modQuery = modSearchQuery.trim().toLowerCase();
                const candidateUsers = users.filter((u) => {
                  if (u.id === activeRoom.ownerId) return false;
                  if (modQuery) {
                    return (
                      u.displayName.toLowerCase().includes(modQuery) ||
                      u.userCode.toLowerCase().includes(modQuery)
                    );
                  }
                  return roomUserIds.has(u.id);
                });

                const bannedUsers = (activeRoom.bannedUserIds || [])
                  .map((bId) => users.find((u) => u.id === bId) || { id: bId, displayName: bId, userCode: '---', avatar: '' });

                return (
                  <div className="space-y-3 text-right">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/25 flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Crown className="w-4 h-4" />
                        مالك الغرفة: {activeRoom.ownerName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        المشرفون: {activeRoom.moderators.length}
                      </span>
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={modSearchQuery}
                        onChange={(e) => setModSearchQuery(e.target.value)}
                        placeholder="ابحث بالاسم أو رقم ID لمنح الإشراف أو الحظر..."
                        className="w-full h-10 rounded-xl bg-white/6 border border-white/12 pr-9 pl-3 text-xs text-white focus:border-sky-400 focus:outline-none"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 no-scrollbar">
                      {candidateUsers.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          لا يوجد أعضاء متطابقون — يمكنك البحث بالاسم أو ID لإضافة مشرف.
                        </div>
                      ) : (
                        candidateUsers.map((u) => {
                          const userIsMod = activeRoom.moderators.includes(u.id);
                          const userIsBanned = (activeRoom.bannedUserIds || []).includes(u.id);
                          return (
                            <div
                              key={u.id}
                              className="p-2.5 rounded-2xl bg-white/[0.04] border border-white/8 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={u.avatar}
                                  alt={u.displayName}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                    <span>{u.displayName}</span>
                                    {userIsMod && (
                                      <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[9px]">
                                        مشرف
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    ID {u.userCode}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = toggleRoomModerator(activeRoom.id, u.id);
                                      setSettingsFeedback(res.message);
                                    }}
                                    className={`h-8 px-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors ${
                                      userIsMod
                                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                                        : 'bg-sky-500/20 border border-sky-400/40 text-sky-300 hover:bg-sky-500/30'
                                    }`}
                                  >
                                    {userIsMod ? (
                                      <>
                                        <Shield className="w-3 h-3" />
                                        <span>سحب</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="w-3 h-3" />
                                        <span>إشراف</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {canManage && u.id !== currentUser.id && !userIsBanned && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      banUserFromRoom(activeRoom.id, u.id);
                                      setSettingsFeedback(`تم حظر ${u.displayName} من الغرفة`);
                                    }}
                                    className="h-8 px-2.5 rounded-xl bg-rose-950/60 border border-rose-500/35 text-rose-300 hover:bg-rose-900/60 text-[11px] font-bold flex items-center gap-1"
                                    title="حظر من الغرفة"
                                  >
                                    <Ban className="w-3 h-3" />
                                    <span>حظر</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {bannedUsers.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-white/10">
                        <div className="text-[11px] font-bold text-rose-300">
                          المحظورون من الغرفة ({bannedUsers.length})
                        </div>
                        <div className="max-h-28 overflow-y-auto space-y-1.5 no-scrollbar">
                          {bannedUsers.map((bu) => (
                            <div
                              key={bu.id}
                              className="px-2.5 py-2 rounded-xl bg-rose-950/30 border border-rose-500/25 flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-200 truncate">
                                {bu.displayName} <span className="text-[10px] font-mono text-slate-400">({bu.userCode})</span>
                              </span>
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    unbanUserFromRoom(activeRoom.id, bu.id);
                                    setSettingsFeedback(`تم رفع الحظر عن ${bu.displayName}`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-[10px]"
                                >
                                  فك الحظر
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* DRAWER 4: SEAT ACTION SHEET (Clean Native Pattern + Room Mods)    */}
        {/* ================================================================= */}
        {activeBottomDrawer === 'seat_menu' && selectedSeatForMenu && (() => {
          const liveSeat = seats8[selectedSeatForMenu.index] || selectedSeatForMenu;
          const targetUserId = liveSeat.userId;
          const targetIsOwner = targetUserId === activeRoom.ownerId;
          const targetIsMod = Boolean(targetUserId && activeRoom.moderators.includes(targetUserId));

          return (
            <div
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end p-3"
              onClick={() => setActiveBottomDrawer('none')}
            >
              <div
                className="w-full space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rounded-2xl bg-[#151a2b] border border-white/10 overflow-hidden divide-y divide-white/8 text-center text-sm font-medium max-h-[75dvh] overflow-y-auto no-scrollbar">
                  <div className="py-2.5 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <span>
                      {liveSeat.index === 0 ? 'مايك المضيف (#1)' : `مايك #${liveSeat.index + 1}`}{' '}
                      {liveSeat.userName ? `· ${liveSeat.userName}` : '· متاح'}
                    </span>
                    {targetIsOwner && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                        المالك
                      </span>
                    )}
                    {!targetIsOwner && targetIsMod && (
                      <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">
                        مشرف
                      </span>
                    )}
                  </div>

                  {targetUserId === currentUser.id && (
                    <button
                      onClick={() => {
                        setViewingProfileUser(currentUser);
                        setActiveModal('profile');
                        setActiveBottomDrawer('none');
                      }}
                      className="w-full h-12 text-amber-300 hover:bg-white/6 transition-colors font-bold flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>فتح البروفايل الخاص بي</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (targetUserId === currentUser.id) {
                        leaveSeat();
                      } else if (targetUserId) {
                        const targetUser = users.find((u) => u.id === targetUserId);
                        setViewingProfileUser(targetUser || currentUser);
                        setActiveModal('profile');
                      } else {
                        sound.unlockAudio();
                        agoraVoice.primeFromUserGesture();
                        agoraVoice.resumeRemoteAudio(true);
                        takeSeat(liveSeat.index);
                      }
                      setActiveBottomDrawer('none');
                    }}
                    className="w-full h-12 text-white hover:bg-white/6 transition-colors font-semibold"
                  >
                    {targetUserId === currentUser.id
                      ? 'النزول من المايك'
                      : targetUserId
                      ? 'عرض الملف الشخصي'
                      : 'صعود إلى المايك'}
                  </button>

                  {targetUserId && (
                    <button
                      onClick={() => {
                        openGiftDrawer(liveSeat.index);
                      }}
                      className="w-full h-12 text-amber-300 hover:bg-white/6 transition-colors font-semibold"
                    >
                      إرسال هدية إلى {liveSeat.userName || `مايك #${liveSeat.index + 1}`}
                    </button>
                  )}

                  {/* Owner-Only: Grant / Revoke Room Full Moderation */}
                  {isOwner && targetUserId && !targetIsOwner && (
                    <button
                      onClick={() => {
                        toggleRoomModerator(activeRoom.id, targetUserId);
                        setActiveBottomDrawer('none');
                      }}
                      className="w-full h-12 text-sky-300 hover:bg-white/6 transition-colors font-semibold flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {targetIsMod
                          ? 'سحب إشراف الغرفة'
                          : 'منح إشراف الغرفة (صلاحيات كاملة)'}
                      </span>
                    </button>
                  )}

                  {/* Owner / Moderator Actions */}
                  {canManage && targetUserId && !targetIsOwner && targetUserId !== currentUser.id && (
                    <>
                      <button
                        onClick={() => {
                          toggleSeatMuteByModerator(liveSeat.index);
                          setActiveBottomDrawer('none');
                        }}
                        className="w-full h-12 text-slate-200 hover:bg-white/6 transition-colors flex items-center justify-center gap-2"
                      >
                        <MicOff className="w-4 h-4 text-amber-400" />
                        <span>{liveSeat.isMuted ? 'فتح المايك للمتحدث' : 'كتم مايك المتحدث'}</span>
                      </button>

                      <button
                        onClick={() => {
                          kickUserFromSeat(liveSeat.index);
                          setActiveBottomDrawer('none');
                        }}
                        className="w-full h-12 text-orange-300 hover:bg-white/6 transition-colors flex items-center justify-center gap-2"
                      >
                        <UserMinus className="w-4 h-4" />
                        <span>إنزال من المايك</span>
                      </button>

                      <button
                        onClick={() => {
                          banUserFromRoom(activeRoom.id, targetUserId);
                          setActiveBottomDrawer('none');
                        }}
                        className="w-full h-12 text-rose-400 hover:bg-white/6 transition-colors flex items-center justify-center gap-2"
                      >
                        <Ban className="w-4 h-4" />
                        <span>حظر من الغرفة</span>
                      </button>
                    </>
                  )}

                  {canManage && (
                    <>
                      <button
                        onClick={() => {
                          toggleSeatLock(liveSeat.index);
                          setActiveBottomDrawer('none');
                        }}
                        className="w-full h-12 text-slate-200 hover:bg-white/6 transition-colors"
                      >
                        {liveSeat.isLocked ? 'فتح قفل المايك' : 'قفل المايك'}
                      </button>

                      <button
                        onClick={() => handleClearHeartValue(liveSeat.index)}
                        className="w-full h-12 text-rose-400 hover:bg-white/6 transition-colors"
                      >
                        تصفير نقاط الكاريزما
                      </button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setActiveBottomDrawer('none')}
                  className="w-full h-12 rounded-2xl bg-[#151a2b] border border-white/10 text-slate-300 font-semibold text-sm hover:bg-white/6 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          );
        })()}

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
                {resolveRocketBagGifts(previewRocketTier.level, gifts).map((rg, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-white/[0.04] border border-white/8 flex flex-col items-center"
                  >
                    <span className="text-xl">{rg.gift.icon || '🎁'}</span>
                    <span className="text-[10px] font-mono tabular-nums text-emerald-400 mt-1">
                      ×{rg.count}
                    </span>
                  </div>
                ))}
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
                    gifts: resolveLuckyBagRewards(0, gifts),
                  },
                  {
                    tierName: 'كيس الحظ الذهبي',
                    cost: 2000,
                    poolCoins: 3500,
                    gifts: resolveLuckyBagRewards(1, gifts),
                  },
                  {
                    tierName: 'كيس الحظ الملكي',
                    cost: 10000,
                    poolCoins: 18000,
                    gifts: resolveLuckyBagRewards(2, gifts),
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
