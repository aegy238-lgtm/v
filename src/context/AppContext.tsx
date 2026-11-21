import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Language,
  User,
  VoiceRoom,
  GiftItem,
  VipTier,
  StoreItem,
  Transaction,
  Agency,
  RechargeAgent,
  StaffMember,
  RoomChatMessage,
  UserInventoryItem,
  ActiveScreenTab,
  RoomSeat,
  LuckyGiftConfig,
  GlobalJackpotBannerState,
} from '../types';
import { translations, Translations } from '../utils/i18n';
import {
  INITIAL_USERS,
  INITIAL_ROOMS,
  GIFTS_CATALOG,
  VIP_TIERS,
  STORE_ITEMS,
  INITIAL_AGENCIES,
  INITIAL_AGENTS,
  INITIAL_STAFF,
  INITIAL_TRANSACTIONS,
} from '../data/mockData';
import { sound } from '../utils/audio';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  firebaseConfig,
  FirebaseConnectionStatus,
  loginWithEmailPassword,
  registerWithEmailPassword,
  signInWithGoogle,
  signOutFirebase,
  subscribeToAuthState,
  subscribeToFirebaseStatus,
  testFirebaseConnection,
  translateFirebaseAuthError,
} from '../utils/firebase';
import {
  bootstrapAuraVoiceFirestoreIfEmpty,
  fetchAuraUserById,
  persistAuraAgency,
  persistAuraAgent,
  persistAuraGift,
  persistAuraRoom,
  persistAuraStoreItem,
  persistAuraTransaction,
  persistAuraUser,
  persistBagGifts,
  persistLuckyConfig,
  persistRoomMessage,
  removeAuraGift,
  removeAuraRoom,
  removeAuraStoreItem,
  subscribeToAuthAuraCollections,
  subscribeToPublicAuraCollections,
  subscribeToRoomMessages,
  syncAllAuraVoiceToFirestore,
} from '../utils/auravoiceFirestore';
import { buildVoiceAvatarSvg } from '../utils/voiceProfileOptions';
import { resolveEntranceStageMedia } from '../utils/mediaFormats';

interface FlyingGiftState {
  id: string;
  gift: GiftItem;
  count: number;
  senderName: string;
  senderVip: number;
  targetName: string;
}

interface EntranceBannerState {
  id: string;
  userName: string;
  userAvatar?: string;
  vipLevel: number;
  entranceName: string;
  entranceIcon: string;
  entrancePreviewUrl?: string;
  entranceVideoUrl?: string;
  entranceMediaUrl?: string;
  preferVideo?: boolean;
  isVideoEntrance?: boolean;
  durationMs?: number;
}

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  currentView: 'user_app' | 'agent_portal' | 'admin_dashboard';
  setCurrentView: (view: 'user_app' | 'agent_portal' | 'admin_dashboard') => void;
  activeTab: ActiveScreenTab;
  setActiveTab: (tab: ActiveScreenTab) => void;
  currentUser: User;
  users: User[];
  rooms: VoiceRoom[];
  activeRoom: VoiceRoom | null;
  activeRoomMessages: RoomChatMessage[];
  gifts: GiftItem[];
  vipTiers: VipTier[];
  storeItems: StoreItem[];
  agencies: Agency[];
  agents: RechargeAgent[];
  staff: StaffMember[];
  transactions: Transaction[];
  flyingGift: FlyingGiftState | null;
  entranceBanner: EntranceBannerState | null;
  luckyConfig: LuckyGiftConfig;
  updateLuckyConfig: (updates: Partial<LuckyGiftConfig>) => void;
  bagGifts: Record<string, number>;
  addBagGifts: (items: { giftId: string; count: number }[]) => void;
  consumeBagGift: (giftId: string, count: number) => boolean;
  globalJackpotBanner: GlobalJackpotBannerState | null;
  triggerGlobalJackpotBanner: (payload: Omit<GlobalJackpotBannerState, 'id' | 'createdAt'>) => void;
  evaluateLuckyGiftWin: (
    gift: GiftItem,
    count: number,
    comboHits: number,
    comboCumulativeCoins: number,
    roomTitle?: string
  ) => { won: boolean; multiplier: number; winCoins: number };
  activeModal: 'none' | 'wallet' | 'vip' | 'store' | 'backpack' | 'games' | 'agency' | 'profile' | 'create_room' | 'messages';
  setActiveModal: (modal: 'none' | 'wallet' | 'vip' | 'store' | 'backpack' | 'games' | 'agency' | 'profile' | 'create_room' | 'messages') => void;
  viewingProfileUser: User | null;
  setViewingProfileUser: (u: User | null) => void;

  // Actions
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  takeSeat: (seatIndex: number) => void;
  leaveSeat: () => void;
  toggleMic: () => void;
  toggleSeatLock: (seatIndex: number) => void;
  sendRoomMessage: (text: string) => void;
  sendGift: (giftId: string, count: number, targetType: 'speaker' | 'seat' | 'all', seatIndex?: number, seatIndices?: number[]) => boolean;
  rechargeCoins: (coins: number, paymentMethod: string) => void;
  agentRechargeUser: (agentId: string, targetUserCode: string, coinAmount: number) => { success: boolean; message: string };
  purchaseVip: (level: number, durationMonths: number) => boolean;
  purchaseStoreItem: (itemId: string) => boolean;
  equipInventoryItem: (type: 'frame' | 'entrance' | 'badge' | 'bubble' | 'vip', itemId: string) => void;
  triggerEntranceEffect: (item?: StoreItem) => void;
  clearEntranceBanner: () => void;
  convertDiamondsToCoins: (diamonds: number) => boolean;
  requestWithdrawal: (diamonds: number, bankInfo: string) => boolean;
  createVoiceRoom: (roomData: { title: string; category: VoiceRoom['category']; type: VoiceRoom['type']; seatCount: VoiceRoom['seatCount'] }) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  
  // Admin & Staff Actions
  adminAddBalance: (userId: string, coins: number, diamonds: number, note: string) => void;
  adminToggleBan: (userId: string) => void;
  adminToggleMute: (userId: string) => void;
  adminSetVipLevel: (userId: string, level: number) => void;
  adminCloseRoom: (roomId: string) => void;
  adminCreateGift: (gift: GiftItem) => void;
  adminUpdateGift: (giftId: string, updates: Partial<GiftItem>) => void;
  adminDeleteGift: (giftId: string) => void;
  adminCreateStoreItem: (item: StoreItem) => void;
  adminUpdateStoreItem: (itemId: string, updates: Partial<StoreItem>) => void;
  adminDeleteStoreItem: (itemId: string) => void;
  adminCreateAgent: (agent: Partial<RechargeAgent>) => void;
  adminTopupAgent: (agentId: string, coins: number) => void;
  adminUpdateAgencyStatus: (agencyId: string, status: 'active' | 'pending' | 'suspended') => void;
  switchUserIdentity: (userId: string) => void;
  triggerSoundboard: (type: 'applause' | 'oud' | 'fanfare' | 'roar' | 'magic') => void;

  // Cloud Firebase Connection & Sync & Auth
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  needsProfileCompletion: boolean;
  guestAccessBypass: boolean;
  enterAsGuestDemo: () => void;
  returnToAuthScreen: () => void;
  firebaseStatus: FirebaseConnectionStatus;
  isCloudSyncing: boolean;
  cloudMessage: string | null;
  signInWithGoogleCloud: () => Promise<void>;
  registerWithEmailProfile: (params: {
    displayName: string;
    email: string;
    password: string;
    country: string;
    countryFlag: string;
    age: number;
    gender: 'male' | 'female';
    avatar?: string;
  }) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  completeGoogleOnboardingProfile: (params: {
    displayName: string;
    country: string;
    countryFlag: string;
    age: number;
    gender: 'male' | 'female';
    avatar?: string;
  }) => Promise<boolean>;
  signOutCloud: () => Promise<void>;
  testCloudConnection: () => Promise<void>;
  syncAllDataToCloud: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>('ar');
  const [currentView, setCurrentView] = useState<'user_app' | 'agent_portal' | 'admin_dashboard'>('user_app');
  const [activeTab, setActiveTab] = useState<ActiveScreenTab>('room');
  
  // State loaded from localStorage or default mocks
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('auravoice_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((u: User) => u.userCode === '2026091')) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string>('user_current');

  const [rooms, setRooms] = useState<VoiceRoom[]>(() => {
    const saved = localStorage.getItem('auravoice_rooms_8mic_v4');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((r: VoiceRoom) => r.roomNo === '2026091' && r.seats.length === 8)) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return INITIAL_ROOMS;
  });

  const [gifts, setGifts] = useState<GiftItem[]>(() => {
    const saved = localStorage.getItem('auravoice_gifts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((g: GiftItem) => g.id === 'gift_lollipop_lucky')) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return GIFTS_CATALOG;
  });

  const [vipTiers] = useState<VipTier[]>(VIP_TIERS);
  const [storeItems, setStoreItems] = useState<StoreItem[]>(() => {
    try {
      const saved = localStorage.getItem('auravoice_store_items_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return STORE_ITEMS;
  });

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    const saved = localStorage.getItem('auravoice_agencies');
    return saved ? JSON.parse(saved) : INITIAL_AGENCIES;
  });

  const [agents, setAgents] = useState<RechargeAgent[]>(() => {
    const saved = localStorage.getItem('auravoice_agents');
    return saved ? JSON.parse(saved) : INITIAL_AGENTS;
  });

  const [staff, setStaff] = useState<StaffMember[]>(() => {
    const saved = localStorage.getItem('auravoice_staff');
    return saved ? JSON.parse(saved) : INITIAL_STAFF;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('auravoice_transactions');
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  // Active in-room state
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomMessages, setActiveRoomMessages] = useState<RoomChatMessage[]>([]);
  const [flyingGift, setFlyingGift] = useState<FlyingGiftState | null>(null);
  const [entranceBanner, setEntranceBanner] = useState<EntranceBannerState | null>(null);
  const entranceTimerRef = React.useRef<number | null>(null);

  // Lucky Gifts Configuration (Controlled via Admin Dashboard)
  const [luckyConfig, setLuckyConfig] = useState<LuckyGiftConfig>(() => {
    try {
      const saved = localStorage.getItem('auravoice_lucky_config_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      winRatePercent: 75,
      lowMultiplierWeight: 70,
      midMultiplierWeight: 22,
      highMultiplierWeight: 8,
      megaComboThreshold: 1000000,
    };
  });

  // Persistent Backpack Lucky/Bag Gifts
  const [bagGifts, setBagGifts] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('auravoice_bag_gifts_v1');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      gift_lollipop_lucky: 25,
      gift_halloween_candy: 5,
      gift_rose: 15,
    };
  });

  // Global 3-Second Jackpot Ticker Banner across entire app & all rooms
  const [globalJackpotBanner, setGlobalJackpotBanner] = useState<GlobalJackpotBannerState | null>(null);
  const jackpotTimerRef = React.useRef<number | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<'none' | 'wallet' | 'vip' | 'store' | 'backpack' | 'games' | 'agency' | 'profile' | 'create_room' | 'messages'>('none');
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState<boolean>(false);
  const [guestAccessBypass, setGuestAccessBypass] = useState<boolean>(false);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseConnectionStatus>({
    isConfigured: true,
    isConnected: false,
    isTesting: false,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  });
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const hasBootstrappedRef = React.useRef<boolean>(false);
  const pendingEmailRegistrationRef = React.useRef<boolean>(false);

  const upsertUserIntoState = (userObj: User) => {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === userObj.id);
      if (exists) {
        return prev.map((u) => (u.id === userObj.id ? { ...u, ...userObj } : u));
      }
      return [userObj, ...prev];
    });
  };

  const buildAuthenticatedVoiceUser = (params: {
    uid: string;
    displayName: string;
    country: string;
    countryFlag: string;
    age: number;
    gender: 'male' | 'female';
    avatar?: string;
  }): User => {
    const cleanName = params.displayName.trim() || 'مستخدم صوتي';
    const rawSlug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const username = `${rawSlug || 'voice_user'}_${params.uid.slice(0, 5)}`;
    const userCode = String(Math.floor(1000000 + Math.random() * 8999999));
    const safeAvatar =
      params.avatar && params.avatar.trim().length > 0 && params.avatar.trim().length <= 1024
        ? params.avatar.trim()
        : buildVoiceAvatarSvg(params.gender, cleanName);

    return {
      id: params.uid,
      userCode,
      username,
      displayName: cleanName,
      avatar: safeAvatar,
      coverImage: '',
      bio: 'عضو جديد في غرف الدردشة الصوتية 🎙️',
      age: params.age,
      gender: params.gender,
      level: 1,
      vipLevel: 0,
      coins: 5000,
      diamonds: 0,
      country: params.country,
      countryFlag: params.countryFlag,
      followersCount: 0,
      followingCount: 0,
      friendsCount: 0,
      likesCount: 0,
      visitorsCount: 0,
      isMuted: false,
      isBanned: false,
      online: true,
      createdAt: new Date().toISOString().slice(0, 10),
    };
  };

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];
  const rawActiveRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const activeRoom: VoiceRoom | null = rawActiveRoom
    ? {
        ...rawActiveRoom,
        seatCount: 8,
        seats: Array.from({ length: 8 }, (_, idx) => {
          const existing = rawActiveRoom.seats?.[idx];
          if (existing && (!existing.userId || !existing.userId.startsWith('u_s'))) {
            return {
              ...existing,
              index: idx,
              heartPoints: existing.heartPoints ?? 0,
            };
          }
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
        }),
      }
    : null;
  const t = translations[lang];

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('auravoice_users', JSON.stringify(users));
  }, [users]);
  useEffect(() => {
    localStorage.setItem('auravoice_rooms_8mic_v4', JSON.stringify(rooms));
  }, [rooms]);
  useEffect(() => {
    localStorage.setItem('auravoice_gifts', JSON.stringify(gifts));
  }, [gifts]);
  useEffect(() => {
    localStorage.setItem('auravoice_agencies', JSON.stringify(agencies));
  }, [agencies]);
  useEffect(() => {
    localStorage.setItem('auravoice_agents', JSON.stringify(agents));
  }, [agents]);
  useEffect(() => {
    localStorage.setItem('auravoice_transactions', JSON.stringify(transactions));
  }, [transactions]);
  useEffect(() => {
    localStorage.setItem('auravoice_lucky_config_v1', JSON.stringify(luckyConfig));
  }, [luckyConfig]);
  useEffect(() => {
    localStorage.setItem('auravoice_bag_gifts_v1', JSON.stringify(bagGifts));
  }, [bagGifts]);
  useEffect(() => {
    localStorage.setItem('auravoice_store_items_v1', JSON.stringify(storeItems));
  }, [storeItems]);

  // Subscribe to Firebase connection status & auth state
  useEffect(() => {
    const unsubStatus = subscribeToFirebaseStatus((status) => {
      setFirebaseStatus(status);
    });
    const unsubAuth = subscribeToAuthState((fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);
      if (!fbUser) {
        setNeedsProfileCompletion(false);
        return;
      }
      if (pendingEmailRegistrationRef.current) {
        return;
      }
      void (async () => {
        const remoteProfile = await fetchAuraUserById(fbUser.uid);
        const localSavedUsers: User[] = (() => {
          try {
            const raw = localStorage.getItem('auravoice_users');
            return raw ? (JSON.parse(raw) as User[]) : [];
          } catch {
            return [];
          }
        })();
        const localProfile = localSavedUsers.find((u) => u.id === fbUser.uid) || null;
        const resolved = remoteProfile || localProfile;

        if (resolved && resolved.country && resolved.gender && typeof resolved.age === 'number') {
          upsertUserIntoState({ ...resolved, online: true });
          setCurrentUserId(resolved.id);
          setNeedsProfileCompletion(false);
          setGuestAccessBypass(false);
        } else {
          setNeedsProfileCompletion(true);
        }
      })();
    });
    return () => {
      unsubStatus();
      unsubAuth();
    };
  }, []);

  // Public Firestore real-time listeners (rooms, gifts, store items, agencies, lucky config)
  useEffect(() => {
    const unsubPublic = subscribeToPublicAuraCollections({
      onRooms: (remoteRooms) => setRooms(remoteRooms),
      onGifts: (remoteGifts) => setGifts(remoteGifts),
      onStoreItems: (remoteStore) => setStoreItems(remoteStore),
      onAgencies: (remoteAgencies) => setAgencies(remoteAgencies),
      onLuckyConfig: (remoteLucky) => setLuckyConfig(remoteLucky),
    });
    return () => {
      unsubPublic();
    };
  }, []);

  // Authenticated Firestore bootstrap + real-time listeners (users, agents, staff, transactions, bag gifts)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    let cancelled = false;
    let unsubAuthCols: () => void = () => {};

    const startSync = async () => {
      if (!hasBootstrappedRef.current) {
        hasBootstrappedRef.current = true;
        await bootstrapAuraVoiceFirestoreIfEmpty({
          users,
          rooms,
          gifts,
          storeItems,
          agencies,
          agents,
          staff,
          transactions,
          luckyConfig,
          bagGifts,
        }).catch(() => {});
      }
      if (cancelled) return;
      unsubAuthCols = subscribeToAuthAuraCollections({
        onUsers: (remoteUsers) => {
          setUsers((prev) => {
            const remoteIds = new Set(remoteUsers.map((u) => u.id));
            const localAuthUser = prev.find((u) => u.id === firebaseUser.uid && !remoteIds.has(u.id));
            return localAuthUser ? [localAuthUser, ...remoteUsers] : remoteUsers;
          });
        },
        onAgents: (remoteAgents) => setAgents(remoteAgents),
        onStaff: (remoteStaff) => setStaff(remoteStaff),
        onTransactions: (remoteTxs) => setTransactions(remoteTxs),
        onBagGifts: (remoteBag) => setBagGifts(remoteBag),
      });
    };

    void startSync();

    return () => {
      cancelled = true;
      unsubAuthCols();
    };
  }, [authReady, firebaseUser]);

  // Real-time room messages listener when authenticated and inside a room
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeRoomId) return;
    const unsubMsgs = subscribeToRoomMessages(activeRoomId, (remoteMessages) => {
      setActiveRoomMessages(remoteMessages);
    });
    return () => {
      unsubMsgs();
    };
  }, [authReady, firebaseUser, activeRoomId]);

  const clearAuthError = () => setAuthError(null);

  const enterAsGuestDemo = () => {
    setAuthError(null);
    setGuestAccessBypass(true);
  };

  const returnToAuthScreen = () => {
    setAuthError(null);
    setGuestAccessBypass(false);
    setActiveRoomId(null);
    setCurrentView('user_app');
  };

  const signInWithGoogleCloud = async () => {
    try {
      setAuthError(null);
      setAuthLoading(true);
      setIsCloudSyncing(true);
      const fbUser = await signInWithGoogle();
      const existingRemote = await fetchAuraUserById(fbUser.uid);
      const existingLocal = users.find((u) => u.id === fbUser.uid) || null;
      const profile = existingRemote || existingLocal;

      if (profile && profile.country && profile.gender && typeof profile.age === 'number') {
        upsertUserIntoState({ ...profile, online: true });
        setCurrentUserId(profile.id);
        setNeedsProfileCompletion(false);
        setGuestAccessBypass(false);
      } else {
        setNeedsProfileCompletion(true);
      }
      setCloudMessage('تم تسجيل الدخول عبر Google بنجاح.');
    } catch (err: unknown) {
      const msg = translateFirebaseAuthError(err);
      setAuthError(msg);
      setCloudMessage(msg);
    } finally {
      setAuthLoading(false);
      setIsCloudSyncing(false);
    }
  };

  const registerWithEmailProfile = async (params: {
    displayName: string;
    email: string;
    password: string;
    country: string;
    countryFlag: string;
    age: number;
    gender: 'male' | 'female';
    avatar?: string;
  }): Promise<boolean> => {
    pendingEmailRegistrationRef.current = true;
    try {
      setAuthError(null);
      setAuthLoading(true);
      const fbUser = await registerWithEmailPassword(
        params.email,
        params.password,
        params.displayName
      );
      const newUser = buildAuthenticatedVoiceUser({
        uid: fbUser.uid,
        displayName: params.displayName,
        country: params.country,
        countryFlag: params.countryFlag,
        age: params.age,
        gender: params.gender,
        avatar: params.avatar,
      });
      upsertUserIntoState(newUser);
      setCurrentUserId(newUser.id);
      setNeedsProfileCompletion(false);
      setGuestAccessBypass(false);
      await persistAuraUser(newUser).catch((e) => {
        console.warn('Initial user profile cloud write notice:', e);
      });
      setCloudMessage('تم إنشاء حسابك في الدردشة الصوتية بنجاح.');
      return true;
    } catch (err: unknown) {
      const msg = translateFirebaseAuthError(err);
      setAuthError(msg);
      return false;
    } finally {
      pendingEmailRegistrationRef.current = false;
      setAuthLoading(false);
    }
  };

  const loginWithEmail = async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      setAuthLoading(true);
      const fbUser = await loginWithEmailPassword(email, password);
      const remoteProfile = await fetchAuraUserById(fbUser.uid);
      const localProfile = users.find((u) => u.id === fbUser.uid) || null;
      const resolved = remoteProfile || localProfile;

      if (resolved && resolved.country && resolved.gender && typeof resolved.age === 'number') {
        upsertUserIntoState({ ...resolved, online: true });
        setCurrentUserId(resolved.id);
        setNeedsProfileCompletion(false);
        setGuestAccessBypass(false);
      } else {
        setNeedsProfileCompletion(true);
      }
      setCloudMessage('مرحباً بعودتك! تم تسجيل الدخول بنجاح.');
      return true;
    } catch (err: unknown) {
      const msg = translateFirebaseAuthError(err);
      setAuthError(msg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const completeGoogleOnboardingProfile = async (params: {
    displayName: string;
    country: string;
    countryFlag: string;
    age: number;
    gender: 'male' | 'female';
    avatar?: string;
  }): Promise<boolean> => {
    if (!firebaseUser) return false;
    try {
      setAuthError(null);
      setAuthLoading(true);
      const newUser = buildAuthenticatedVoiceUser({
        uid: firebaseUser.uid,
        displayName: params.displayName || firebaseUser.displayName || 'مستخدم صوتي',
        country: params.country,
        countryFlag: params.countryFlag,
        age: params.age,
        gender: params.gender,
        avatar: params.avatar || firebaseUser.photoURL || undefined,
      });
      upsertUserIntoState(newUser);
      setCurrentUserId(newUser.id);
      setNeedsProfileCompletion(false);
      setGuestAccessBypass(false);
      await persistAuraUser(newUser).catch((e) => {
        console.warn('Google onboarding profile write notice:', e);
      });
      setCloudMessage('تم إكمال ملفك الصوتي بنجاح.');
      return true;
    } catch (err: unknown) {
      const msg = translateFirebaseAuthError(err);
      setAuthError(msg);
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const signOutCloud = async () => {
    await signOutFirebase();
    hasBootstrappedRef.current = false;
    setActiveRoomId(null);
    setNeedsProfileCompletion(false);
    setGuestAccessBypass(false);
    setAuthError(null);
    setCurrentView('user_app');
    setCloudMessage('تم تسجيل الخروج بنجاح.');
  };

  const testCloudConnection = async () => {
    const res = await testFirebaseConnection(true);
    setCloudMessage(res.message || null);
  };

  const syncAllDataToCloud = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await syncAllAuraVoiceToFirestore({
        users,
        rooms,
        gifts,
        storeItems,
        agencies,
        agents,
        staff,
        transactions,
        luckyConfig,
        bagGifts,
      });
      setCloudMessage(res.message);
    } catch (err: any) {
      setCloudMessage(err?.message || 'تعذرت المزامنة مع السحابة');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const updateLuckyConfig = (updates: Partial<LuckyGiftConfig>) => {
    setLuckyConfig((prev) => {
      const next = { ...prev, ...updates };
      void persistLuckyConfig(next).catch(() => {});
      return next;
    });
  };

  const addBagGifts = (items: { giftId: string; count: number }[]) => {
    setBagGifts((prev) => {
      const next = { ...prev };
      items.forEach(({ giftId, count }) => {
        if (count > 0) next[giftId] = (next[giftId] || 0) + count;
      });
      void persistBagGifts(next).catch(() => {});
      return next;
    });
  };

  const consumeBagGift = (giftId: string, count: number): boolean => {
    const owned = bagGifts[giftId] || 0;
    if (owned < count || count <= 0) return false;
    setBagGifts((prev) => {
      const next = { ...prev };
      const rem = (next[giftId] || 0) - count;
      if (rem <= 0) delete next[giftId];
      else next[giftId] = rem;
      void persistBagGifts(next).catch(() => {});
      return next;
    });
    return true;
  };

  const triggerGlobalJackpotBanner = (
    payload: Omit<GlobalJackpotBannerState, 'id' | 'createdAt'>
  ) => {
    const now = Date.now();
    if (jackpotTimerRef.current) {
      window.clearTimeout(jackpotTimerRef.current);
    }
    sound.playLuckySplashJackpot();
    setGlobalJackpotBanner({
      ...payload,
      id: `jackpot_${now}_${Math.random()}`,
      createdAt: now,
    });
    jackpotTimerRef.current = window.setTimeout(() => {
      setGlobalJackpotBanner(null);
      jackpotTimerRef.current = null;
    }, 3000);
  };

  const evaluateLuckyGiftWin = (
    gift: GiftItem,
    count: number,
    comboHits: number,
    comboCumulativeCoins: number,
    roomTitle?: string
  ): { won: boolean; multiplier: number; winCoins: number } => {
    const roll = Math.random() * 100;
    const isWin = roll <= luckyConfig.winRatePercent;

    let multiplier = 0;
    let winCoins = 0;

    if (isWin) {
      const lowW = Math.max(0, luckyConfig.lowMultiplierWeight);
      const midW = Math.max(0, luckyConfig.midMultiplierWeight);
      const highW = Math.max(0, luckyConfig.highMultiplierWeight);
      const totalW = lowW + midW + highW || 100;
      const tierRoll = Math.random() * totalW;

      if (tierRoll < highW) {
        const highPool = comboHits >= 5 ? [188, 250] : [128, 188];
        multiplier = highPool[Math.floor(Math.random() * highPool.length)];
      } else if (tierRoll < highW + midW) {
        const midPool = [50, 66, 88];
        multiplier = midPool[Math.floor(Math.random() * midPool.length)];
      } else {
        const lowPool = [5, 8, 12, 18, 25];
        multiplier = lowPool[Math.floor(Math.random() * lowPool.length)];
      }

      winCoins = Math.round(gift.coinPrice * multiplier * count);

      // Credit lucky winnings to current user + record lucky_win transaction
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === currentUser.id) {
            const updated = { ...u, coins: u.coins + winCoins };
            void persistAuraUser(updated).catch(() => {});
            return updated;
          }
          return u;
        })
      );

      const winTx: Transaction = {
        id: `tx_lucky_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        userId: currentUser.id,
        userName: currentUser.displayName,
        type: 'lucky_win',
        coinsDelta: winCoins,
        diamondsDelta: 0,
        details: `ربح هدية الحظ (${gift.nameAr} ×${count}) بمضاعف ${multiplier}X`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'completed',
      };
      setTransactions((prev) => [winTx, ...prev]);
      void persistAuraTransaction(winTx).catch(() => {});
    }

    const threshold = luckyConfig.megaComboThreshold || 1000000;
    const hitComboMillion = comboCumulativeCoins >= threshold || winCoins >= threshold;
    if (hitComboMillion) {
      const displayWin = winCoins > 0 ? winCoins : comboCumulativeCoins;
      triggerGlobalJackpotBanner({
        winnerName: currentUser.displayName,
        winnerAvatar: currentUser.avatar,
        roomTitle: roomTitle || activeRoom?.title || 'غرفة صوتية',
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftImageUrl: gift.imageUrl,
        amountWon: displayWin,
        comboTotalCoins: comboCumulativeCoins,
        multiplier: multiplier || Math.max(1, comboHits),
      });
    }

    return { won: isWin, multiplier, winCoins };
  };

  // Set RTL or LTR on document
  const setLang = (newLang: Language) => {
    setLangState(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  // Switch identity
  const switchUserIdentity = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUserId(found.id);
    }
  };

  // Join Room
  const joinRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    setActiveRoomId(roomId);
    
    // Increment viewer count
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === roomId) {
          const updated = { ...r, onlineViewersCount: r.onlineViewersCount + 1 };
          void persistAuraRoom(updated).catch(() => {});
          return updated;
        }
        return r;
      })
    );

    // Initial greeting in room chat
    const welcomeMsg: RoomChatMessage = {
      id: `msg_${Date.now()}`,
      roomId,
      senderId: 'system',
      senderName: 'نظام الغرفة',
      senderAvatar: '',
      vipLevel: 0,
      level: 0,
      isSystem: true,
      text: `دخل ${currentUser.displayName} إلى الغرفة (VIP ${currentUser.vipLevel}) ✨`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setActiveRoomMessages([welcomeMsg]);

    // Trigger equipped store entrance effect OR VIP tier entrance on joining room
    const activeStoreEntrance = currentUser.activeEntranceId
      ? storeItems.find((i) => i.id === currentUser.activeEntranceId && i.type === 'entrance')
      : undefined;

    if (activeStoreEntrance || currentUser.vipLevel >= 1) {
      const vipInfo = vipTiers.find((v) => v.level === currentUser.vipLevel) || vipTiers[0];
      const resolved = resolveEntranceStageMedia(activeStoreEntrance);
      if (entranceTimerRef.current) {
        window.clearTimeout(entranceTimerRef.current);
        entranceTimerRef.current = null;
      }
      setEntranceBanner({
        id: `ent_${Date.now()}`,
        userName: currentUser.displayName,
        userAvatar: currentUser.avatar,
        vipLevel: currentUser.vipLevel,
        entranceName: activeStoreEntrance?.nameAr || vipInfo?.entranceName || 'دخولية ملكية',
        entranceIcon: activeStoreEntrance?.icon || vipInfo?.entranceIcon || '🚘',
        entrancePreviewUrl: resolved.previewThumbUrl,
        entranceVideoUrl: activeStoreEntrance?.videoUrl?.trim() || undefined,
        entranceMediaUrl: resolved.primaryUrl,
        preferVideo: resolved.preferVideo,
        isVideoEntrance: resolved.isVideoEntrance,
        durationMs: resolved.durationMs,
      });

      sound.playGiftSound('fanfare');

      // Video entrances play to natural completion via <video onEnded>; non-video uses configurable durationMs
      const timerMs = resolved.isVideoEntrance ? 180000 : resolved.durationMs;
      entranceTimerRef.current = window.setTimeout(() => {
        setEntranceBanner(null);
        entranceTimerRef.current = null;
      }, timerMs);
    }
  };

  // Leave Room
  const leaveRoom = () => {
    if (activeRoomId) {
      // Free up any seat held by currentUser
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === activeRoomId) {
            const updated = {
              ...r,
              onlineViewersCount: Math.max(1, r.onlineViewersCount - 1),
              seats: r.seats.map((s) =>
                s.userId === currentUser.id
                  ? {
                      ...s,
                      userId: null,
                      userName: undefined,
                      userAvatar: undefined,
                      vipLevel: undefined,
                      level: undefined,
                      isSpeaking: false,
                      audioLevel: 0,
                    }
                  : s
              ),
            };
            void persistAuraRoom(updated).catch(() => {});
            return updated;
          }
          return r;
        })
      );
    }
    setActiveRoomId(null);
    setActiveRoomMessages([]);
    setFlyingGift(null);
    setEntranceBanner(null);
  };

  // Take Mic Seat
  const takeSeat = (seatIndex: number) => {
    if (!activeRoom || seatIndex < 0 || seatIndex >= 8) return;
    const currentSeats = activeRoom.seats || [];
    const seat = currentSeats[seatIndex];
    if (seat?.isLocked) {
      return;
    }
    if (seat?.userId && seat.userId !== currentUser.id) {
      return;
    }

    sound.playMicClick(true);

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const expandedSeats: RoomSeat[] = Array.from({ length: 8 }, (_, idx) => {
            if (r.seats && r.seats[idx]) return r.seats[idx];
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

          const updatedRoom = {
            ...r,
            seats: expandedSeats.map((s, idx) => {
              // If user was in another seat, vacate it
              if (s.userId === currentUser.id) {
                return {
                  ...s,
                  userId: null,
                  userName: undefined,
                  userAvatar: undefined,
                  vipLevel: undefined,
                  level: undefined,
                  isSpeaking: false,
                  audioLevel: 0,
                };
              }
              // Occupy chosen seat
              if (idx === seatIndex) {
                return {
                  ...s,
                  userId: currentUser.id,
                  userName: currentUser.displayName,
                  userAvatar: currentUser.avatar,
                  vipLevel: currentUser.vipLevel,
                  level: currentUser.level,
                  activeFrameId: currentUser.activeFrameId,
                  isMuted: false,
                  isSpeaking: true,
                  audioLevel: 65,
                };
              }
              return s;
            }),
          };
          void persistAuraRoom(updatedRoom).catch(() => {});
          return updatedRoom;
        }
        return r;
      })
    );

    // Announce in room chat
    const msg: RoomChatMessage = {
      id: `msg_${Date.now()}`,
      roomId: activeRoom.id,
      senderId: 'system',
      senderName: 'نظام الغرفة',
      senderAvatar: '',
      vipLevel: 0,
      level: 0,
      isSystem: true,
      text: `صعد ${currentUser.displayName} إلى المايك رقم ${seatIndex + 1} 🎙️`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setActiveRoomMessages((prev) => [...prev, msg]);
  };

  // Leave Seat
  const leaveSeat = () => {
    if (!activeRoom) return;
    sound.playMicClick(false);

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const updated = {
            ...r,
            seats: r.seats.map((s) =>
              s.userId === currentUser.id
                ? {
                    ...s,
                    userId: null,
                    userName: undefined,
                    userAvatar: undefined,
                    vipLevel: undefined,
                    level: undefined,
                    isSpeaking: false,
                    audioLevel: 0,
                  }
                : s
            ),
          };
          void persistAuraRoom(updated).catch(() => {});
          return updated;
        }
        return r;
      })
    );
  };

  // Toggle Mic (Mute/Unmute self)
  const toggleMic = () => {
    if (!activeRoom) return;
    const mySeat = activeRoom.seats.find((s) => s.userId === currentUser.id);
    if (!mySeat) return;

    const nextMuted = !mySeat.isMuted;
    sound.playMicClick(!nextMuted);

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const updated = {
            ...r,
            seats: r.seats.map((s) =>
              s.userId === currentUser.id
                ? {
                    ...s,
                    isMuted: nextMuted,
                    isSpeaking: !nextMuted,
                    audioLevel: nextMuted ? 0 : 70,
                  }
                : s
            ),
          };
          void persistAuraRoom(updated).catch(() => {});
          return updated;
        }
        return r;
      })
    );
  };

  // Toggle Seat Lock (by room owner/moderator)
  const toggleSeatLock = (seatIndex: number) => {
    if (!activeRoom || seatIndex < 0 || seatIndex >= 8) return;
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const expandedSeats: RoomSeat[] = Array.from({ length: 8 }, (_, idx) => {
            if (r.seats && r.seats[idx]) return r.seats[idx];
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

          const updated = {
            ...r,
            seats: expandedSeats.map((s, idx) =>
              idx === seatIndex ? { ...s, isLocked: !s.isLocked } : s
            ),
          };
          void persistAuraRoom(updated).catch(() => {});
          return updated;
        }
        return r;
      })
    );
  };

  // Send Room Chat Message
  const sendRoomMessage = (text: string) => {
    if (!activeRoom || !text.trim()) return;
    const newMsg: RoomChatMessage = {
      id: `msg_${Date.now()}`,
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      vipLevel: currentUser.vipLevel,
      level: currentUser.level,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setActiveRoomMessages((prev) => [...prev, newMsg]);
    void persistRoomMessage(newMsg).catch(() => {});
  };

  // Send Gift inside Room
  const sendGift = (
    giftId: string,
    count: number,
    targetType: 'speaker' | 'seat' | 'all',
    seatIndex?: number,
    seatIndices?: number[]
  ): boolean => {
    if (!activeRoom) return false;
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) return false;

    // Identify target users & seat indices — STRICTLY OCCUPIED MICS ONLY (no gifting empty seats!)
    let targets: { id: string; name: string; seatIndex?: number }[] = [];

    if (seatIndices && seatIndices.length > 0) {
      seatIndices.forEach((sIdx) => {
        const seat = activeRoom.seats[sIdx];
        if (seat && seat.userId) {
          targets.push({ id: seat.userId, name: seat.userName || `مايك ${sIdx + 1}`, seatIndex: sIdx });
        }
      });
    } else if (targetType === 'all') {
      const activeSeats = activeRoom.seats.filter((s) => Boolean(s.userId));
      targets = activeSeats.map((s) => ({
        id: s.userId!,
        name: s.userName || `مايك ${s.index + 1}`,
        seatIndex: s.index,
      }));
    } else if (targetType === 'seat' && seatIndex !== undefined) {
      const targetSeat = activeRoom.seats[seatIndex];
      if (targetSeat && targetSeat.userId) {
        targets = [{ id: targetSeat.userId, name: targetSeat.userName || `مايك ${seatIndex + 1}`, seatIndex }];
      }
    } else {
      const speakingSeat = activeRoom.seats.find((s) => s.userId && s.isSpeaking) || activeRoom.seats.find((s) => Boolean(s.userId));
      if (speakingSeat && speakingSeat.userId) {
        targets = [{ id: speakingSeat.userId, name: speakingSeat.userName || 'المتحدث', seatIndex: speakingSeat.index }];
      }
    }

    if (targets.length === 0) {
      return false;
    }

    const totalCoinsNeeded = gift.coinPrice * count * targets.length;

    if (currentUser.coins < totalCoinsNeeded) {
      setActiveModal('wallet');
      return false;
    }

    // Deduct coins from sender
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = {
            ...u,
            coins: u.coins - totalCoinsNeeded,
            level: Math.min(100, u.level + Math.floor(totalCoinsNeeded / 20000)),
          };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        // Add diamonds to recipients
        const isTarget = targets.some((t) => t.id === u.id);
        if (isTarget) {
          const diamondsReward = gift.diamondReward * count;
          const updated = {
            ...u,
            diamonds: u.diamonds + diamondsReward,
            level: Math.min(100, u.level + Math.floor(diamondsReward / 10000)),
          };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    // Update Room total diamonds & seat heartPoints
    const diamondsTotal = gift.diamondReward * count * targets.length;
    const heartPointsPerSeat = gift.coinPrice * count;
    const targetSeatSet = new Set(targets.map((t) => t.seatIndex).filter((x): x is number => x !== undefined));

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const updatedSeats = r.seats.map((s, idx) =>
            targetSeatSet.has(idx)
              ? { ...s, heartPoints: (s.heartPoints || 0) + heartPointsPerSeat }
              : s
          );
          const updatedRoom = {
            ...r,
            totalDiamondsEarned: r.totalDiamondsEarned + diamondsTotal,
            seats: updatedSeats,
          };
          void persistAuraRoom(updatedRoom).catch(() => {});
          return updatedRoom;
        }
        return r;
      })
    );

    // Record Transaction
    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'gift_sent',
      coinsDelta: -totalCoinsNeeded,
      diamondsDelta: 0,
      details: `إرسال هدية (${gift.nameAr}) x${count} إلى ${targets.map((t) => t.name).join(', ')}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
      referenceId: activeRoom.id,
    };
    setTransactions((prev) => [newTx, ...prev]);
    void persistAuraTransaction(newTx).catch(() => {});

    // Trigger Flying Gift Banner Animation
    setFlyingGift({
      id: `fly_${Date.now()}_${Math.random()}`,
      gift,
      count,
      senderName: currentUser.displayName,
      senderVip: currentUser.vipLevel,
      targetName: targets.map((t) => t.name).join(', '),
    });

    setTimeout(() => {
      setFlyingGift(null);
    }, 4500);

    // Post to Room Chat
    const chatGiftMsg: RoomChatMessage = {
      id: `msg_${Date.now()}`,
      roomId: activeRoom.id,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      senderAvatar: currentUser.avatar,
      vipLevel: currentUser.vipLevel,
      level: currentUser.level,
      isSystem: false,
      giftData: {
        giftId: gift.id,
        giftName: gift.nameAr,
        giftIcon: gift.icon,
        giftCount: count,
        targetUserName: targets.map((t) => t.name).join(' & '),
        totalCoins: totalCoinsNeeded,
      },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setActiveRoomMessages((prev) => [...prev, chatGiftMsg]);
    void persistRoomMessage(chatGiftMsg).catch(() => {});
    return true;
  };

  // Recharge Coins
  const rechargeCoins = (coins: number, paymentMethod: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = { ...u, coins: u.coins + coins };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    const newTx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'recharge',
      coinsDelta: coins,
      diamondsDelta: 0,
      details: `شحن رصيد ${coins.toLocaleString()} عملة عبر (${paymentMethod})`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };
    setTransactions((prev) => [newTx, ...prev]);
    void persistAuraTransaction(newTx).catch(() => {});
  };

  // Agent Recharge User
  const agentRechargeUser = (
    agentId: string,
    targetUserCode: string,
    coinAmount: number
  ): { success: boolean; message: string } => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) {
      return { success: false, message: 'وكيل الشحن غير مسجل' };
    }
    if (agent.balanceCoins < coinAmount) {
      return { success: false, message: 'رصيد الوكيل لا يكفي لإتمام هذه العملية' };
    }

    const targetUser = users.find((u) => u.userCode === targetUserCode);
    if (!targetUser) {
      return { success: false, message: 'لم يتم العثور على مستخدم بهذا الرمز ID' };
    }

    const commissionEarned = Math.round(coinAmount * (agent.commissionRate / 100));

    // Deduct coins from agent, add commission
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          const updated = {
            ...a,
            balanceCoins: a.balanceCoins - coinAmount,
            totalRechargedCoins: a.totalRechargedCoins + coinAmount,
            totalOperations: a.totalOperations + 1,
            commissionEarnedCoins: a.commissionEarnedCoins + commissionEarned,
          };
          void persistAuraAgent(updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );

    // Add coins to target user
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === targetUser.id) {
          const updated = { ...u, coins: u.coins + coinAmount };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    // Add transactions
    const txUser: Transaction = {
      id: `tx_${Date.now()}_u`,
      userId: targetUser.id,
      userName: targetUser.displayName,
      type: 'recharge',
      coinsDelta: coinAmount,
      diamondsDelta: 0,
      details: `شحن رصيد ${coinAmount.toLocaleString()} عملة من الوكيل المعتمد (${agent.name})`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
      referenceId: agent.agentCode,
    };

    const txAgent: Transaction = {
      id: `tx_${Date.now()}_a`,
      userId: agent.id,
      userName: agent.name,
      type: 'agent_recharge_payout',
      coinsDelta: -coinAmount,
      diamondsDelta: 0,
      details: `تنفيذ عملية شحن للمستخدم ${targetUser.displayName} (ID: ${targetUser.userCode}) وعمولة +${commissionEarned.toLocaleString()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };

    setTransactions((prev) => [txUser, txAgent, ...prev]);
    void persistAuraTransaction(txUser).catch(() => {});
    void persistAuraTransaction(txAgent).catch(() => {});

    sound.playWinChime();
    return {
      success: true,
      message: `تم شحن ${coinAmount.toLocaleString()} عملة بنجاح للمستخدم ${targetUser.displayName}!`,
    };
  };

  // Purchase VIP
  const purchaseVip = (level: number, durationMonths: number): boolean => {
    const tier = vipTiers.find((v) => v.level === level);
    if (!tier) return false;

    const totalCost = tier.coinCostMonthly * durationMonths;
    if (currentUser.coins < totalCost) {
      setActiveModal('wallet');
      return false;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = {
            ...u,
            coins: u.coins - totalCost,
            vipLevel: Math.max(u.vipLevel, level),
          };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'vip_purchase',
      coinsDelta: -totalCost,
      diamondsDelta: 0,
      details: `اشتراك في عضوية ${tier.nameAr} لمدة ${durationMonths} شهر`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };
    setTransactions((prev) => [tx, ...prev]);
    void persistAuraTransaction(tx).catch(() => {});

    return true;
  };

  // Helper to sync current user's equipped frame onto any active mic seat immediately
  const syncUserFrameToSeats = (frameId: string) => {
    setRooms((prev) =>
      prev.map((r) => {
        const hasSeatedUser = r.seats.some((s) => s.userId === currentUser.id);
        if (!hasSeatedUser) return r;
        const updatedRoom = {
          ...r,
          seats: r.seats.map((s) =>
            s.userId === currentUser.id ? { ...s, activeFrameId: frameId } : s
          ),
        };
        void persistAuraRoom(updatedRoom).catch(() => {});
        return updatedRoom;
      })
    );
  };

  const clearEntranceBanner = () => {
    if (entranceTimerRef.current) {
      window.clearTimeout(entranceTimerRef.current);
      entranceTimerRef.current = null;
    }
    setEntranceBanner(null);
  };

  const triggerEntranceEffect = (item?: StoreItem) => {
    const resolvedItem =
      item ||
      (currentUser.activeEntranceId
        ? storeItems.find((i) => i.id === currentUser.activeEntranceId && i.type === 'entrance')
        : undefined);
    const vipInfo = vipTiers.find((v) => v.level === currentUser.vipLevel) || vipTiers[0];
    if (!resolvedItem && currentUser.vipLevel < 1) return;

    if (entranceTimerRef.current) {
      window.clearTimeout(entranceTimerRef.current);
      entranceTimerRef.current = null;
    }
    const resolved = resolveEntranceStageMedia(resolvedItem);
    setEntranceBanner({
      id: `ent_${Date.now()}`,
      userName: currentUser.displayName,
      userAvatar: currentUser.avatar,
      vipLevel: currentUser.vipLevel,
      entranceName: resolvedItem?.nameAr || vipInfo?.entranceName || 'دخولية ملكية',
      entranceIcon: resolvedItem?.icon || vipInfo?.entranceIcon || '🚘',
      entrancePreviewUrl: resolved.previewThumbUrl,
      entranceVideoUrl: resolvedItem?.videoUrl?.trim() || undefined,
      entranceMediaUrl: resolved.primaryUrl,
      preferVideo: resolved.preferVideo,
      isVideoEntrance: resolved.isVideoEntrance,
      durationMs: resolved.durationMs,
    });
    sound.playGiftSound('fanfare');
    const timerMs = resolved.isVideoEntrance ? 180000 : resolved.durationMs;
    entranceTimerRef.current = window.setTimeout(() => {
      setEntranceBanner(null);
      entranceTimerRef.current = null;
    }, timerMs);
  };

  // Purchase Store Item (Frame, Entrance, Badge, Bubble)
  const purchaseStoreItem = (itemId: string): boolean => {
    const item = storeItems.find((i) => i.id === itemId);
    if (!item) return false;

    if (currentUser.coins < item.priceCoins) {
      setActiveModal('wallet');
      return false;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updates: Partial<User> = {
            coins: u.coins - item.priceCoins,
          };
          if (item.type === 'frame') updates.activeFrameId = item.id;
          if (item.type === 'entrance') updates.activeEntranceId = item.id;
          if (item.type === 'badge') updates.activeBadgeId = item.id;
          if (item.type === 'bubble') updates.activeBubbleId = item.id;
          const updated = { ...u, ...updates };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    if (item.type === 'frame') {
      syncUserFrameToSeats(item.id);
    }
    if (item.type === 'entrance' && activeRoomId) {
      triggerEntranceEffect(item);
    }

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'item_purchase',
      coinsDelta: -item.priceCoins,
      diamondsDelta: 0,
      details: `شراء ${item.nameAr} من المتجر لمدة ${item.durationDays} يوم`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };
    setTransactions((prev) => [tx, ...prev]);
    void persistAuraTransaction(tx).catch(() => {});

    sound.playWinChime();
    return true;
  };

  // Equip Item from Backpack
  const equipInventoryItem = (type: 'frame' | 'entrance' | 'badge' | 'bubble' | 'vip', itemId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          let updated = u;
          if (type === 'frame') updated = { ...u, activeFrameId: itemId };
          if (type === 'entrance') updated = { ...u, activeEntranceId: itemId };
          if (type === 'badge') updated = { ...u, activeBadgeId: itemId };
          if (type === 'bubble') updated = { ...u, activeBubbleId: itemId };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );
    if (type === 'frame') {
      syncUserFrameToSeats(itemId);
    }
    if (type === 'entrance' && activeRoomId) {
      const targetEntrance = storeItems.find((i) => i.id === itemId && i.type === 'entrance');
      if (targetEntrance) triggerEntranceEffect(targetEntrance);
    }
    sound.playMicClick(true);
  };

  // Convert Diamonds to Coins
  const convertDiamondsToCoins = (diamondsToExchange: number): boolean => {
    if (currentUser.diamonds < diamondsToExchange) {
      return false;
    }

    // Exchange rate: 1 Diamond = 2 Coins + 10% bonus
    const coinsReceived = Math.round(diamondsToExchange * 2.1);

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = {
            ...u,
            diamonds: u.diamonds - diamondsToExchange,
            coins: u.coins + coinsReceived,
          };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'exchange_diamonds',
      coinsDelta: coinsReceived,
      diamondsDelta: -diamondsToExchange,
      details: `استبدال ${diamondsToExchange.toLocaleString()} ألماس بـ ${coinsReceived.toLocaleString()} عملة ذهبية`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };
    setTransactions((prev) => [tx, ...prev]);
    void persistAuraTransaction(tx).catch(() => {});

    return true;
  };

  // Request Profit Withdrawal
  const requestWithdrawal = (diamondsAmount: number, bankInfo: string): boolean => {
    if (currentUser.diamonds < diamondsAmount) {
      return false;
    }

    // Deduction
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = { ...u, diamonds: u.diamonds - diamondsAmount };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    // 100,000 Diamonds = 500 USD approx
    const usdValue = Math.round(diamondsAmount / 200);

    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.displayName,
      type: 'withdrawal',
      coinsDelta: 0,
      diamondsDelta: -diamondsAmount,
      details: `طلب سحب أرباح بقيمة $${usdValue.toLocaleString()} (${diamondsAmount.toLocaleString()} ألماس) إلى حساب: ${bankInfo}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'pending',
    };
    setTransactions((prev) => [tx, ...prev]);
    void persistAuraTransaction(tx).catch(() => {});

    return true;
  };

  // Create Voice Room
  const createVoiceRoom = (roomData: {
    title: string;
    category: VoiceRoom['category'];
    type: VoiceRoom['type'];
    seatCount: VoiceRoom['seatCount'];
  }) => {
    const newRoom: VoiceRoom = {
      id: `room_${Date.now()}`,
      roomNo: `${Math.floor(1000 + Math.random() * 9000)}`,
      title: roomData.title,
      description: 'مرحباً بالجميع في غرفتنا الصوتية',
      coverImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
      category: roomData.category,
      type: roomData.type,
      ownerId: currentUser.id,
      ownerName: currentUser.displayName,
      ownerAvatar: currentUser.avatar,
      seatCount: roomData.seatCount,
      seats: Array.from({ length: roomData.seatCount }, (_, i) => ({
        index: i,
        userId: i === 0 ? currentUser.id : null,
        userName: i === 0 ? currentUser.displayName : undefined,
        userAvatar: i === 0 ? currentUser.avatar : undefined,
        vipLevel: i === 0 ? currentUser.vipLevel : 0,
        level: i === 0 ? currentUser.level : 0,
        isMuted: false,
        isLocked: false,
        isReserved: false,
        isSpeaking: i === 0,
        audioLevel: i === 0 ? 50 : 0,
      })),
      moderators: [currentUser.id],
      bannedUserIds: [],
      onlineViewersCount: 1,
      totalDiamondsEarned: 0,
      tags: ['غرفة جديدة', 'ترحيب'],
    };

    setRooms((prev) => [newRoom, ...prev]);
    void persistAuraRoom(newRoom).catch(() => {});
    joinRoom(newRoom.id);
  };

  // Update User Profile (Name, Avatar, Bio, Country, Special ID userCode, etc.)
  const updateUserProfile = (updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          const updated = { ...u, ...updates };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );
  };

  // Admin Actions
  const adminAddBalance = (userId: string, coins: number, diamonds: number, note: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = {
            ...u,
            coins: Math.max(0, u.coins + coins),
            diamonds: Math.max(0, u.diamonds + diamonds),
          };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );

    const targetUser = users.find((u) => u.id === userId);
    const tx: Transaction = {
      id: `tx_${Date.now()}`,
      userId,
      userName: targetUser?.displayName || 'مستخدم',
      type: 'admin_adjustment',
      coinsDelta: coins,
      diamondsDelta: diamonds,
      details: `تعديل رصيد إداري: ${note}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'completed',
    };
    setTransactions((prev) => [tx, ...prev]);
    void persistAuraTransaction(tx).catch(() => {});
  };

  const adminToggleBan = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, isBanned: !u.isBanned };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );
  };

  const adminToggleMute = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, isMuted: !u.isMuted };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );
  };

  const adminSetVipLevel = (userId: string, level: number) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, vipLevel: level };
          void persistAuraUser(updated).catch(() => {});
          return updated;
        }
        return u;
      })
    );
  };

  const adminCloseRoom = (roomId: string) => {
    if (activeRoomId === roomId) {
      leaveRoom();
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    void removeAuraRoom(roomId).catch(() => {});
  };

  const adminCreateGift = (gift: GiftItem) => {
    setGifts((prev) => [gift, ...prev]);
    void persistAuraGift(gift).catch(() => {});
  };

  const adminUpdateGift = (giftId: string, updates: Partial<GiftItem>) => {
    setGifts((prev) =>
      prev.map((g) => {
        if (g.id === giftId) {
          const updated = { ...g, ...updates };
          void persistAuraGift(updated).catch(() => {});
          return updated;
        }
        return g;
      })
    );
  };

  const adminDeleteGift = (giftId: string) => {
    setGifts((prev) => prev.filter((g) => g.id !== giftId));
    void removeAuraGift(giftId).catch(() => {});
  };

  const adminCreateStoreItem = (item: StoreItem) => {
    setStoreItems((prev) => [item, ...prev]);
    void persistAuraStoreItem(item).catch(() => {});
  };

  const adminUpdateStoreItem = (itemId: string, updates: Partial<StoreItem>) => {
    setStoreItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, ...updates };
          void persistAuraStoreItem(updated).catch(() => {});
          return updated;
        }
        return item;
      })
    );
  };

  const adminDeleteStoreItem = (itemId: string) => {
    setStoreItems((prev) => prev.filter((item) => item.id !== itemId));
    void removeAuraStoreItem(itemId).catch(() => {});
  };

  const adminCreateAgent = (agentData: Partial<RechargeAgent>) => {
    const newAgent: RechargeAgent = {
      id: `agent_${Date.now()}`,
      agentCode: `AGENT-${Math.floor(100 + Math.random() * 900)}`,
      name: agentData.name || 'وكيل جديد',
      phone: agentData.phone || '+966 50 000 0000',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
      balanceCoins: agentData.balanceCoins || 1000000,
      totalRechargedCoins: 0,
      totalOperations: 0,
      commissionEarnedCoins: 0,
      commissionRate: agentData.commissionRate || 5,
      status: 'active',
    };
    setAgents((prev) => [newAgent, ...prev]);
    void persistAuraAgent(newAgent).catch(() => {});
  };

  const adminTopupAgent = (agentId: string, coins: number) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          const updated = { ...a, balanceCoins: a.balanceCoins + coins };
          void persistAuraAgent(updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );
  };

  const adminUpdateAgencyStatus = (agencyId: string, status: 'active' | 'pending' | 'suspended') => {
    setAgencies((prev) =>
      prev.map((a) => {
        if (a.id === agencyId) {
          const updated = { ...a, status };
          void persistAuraAgency(updated).catch(() => {});
          return updated;
        }
        return a;
      })
    );
  };

  // Soundboard Trigger
  const triggerSoundboard = (type: 'applause' | 'oud' | 'fanfare' | 'roar' | 'magic') => {
    if (type === 'applause') sound.playApplause();
    else if (type === 'oud') sound.playOudSample();
    else sound.playGiftSound(type);

    if (activeRoom) {
      const msg: RoomChatMessage = {
        id: `msg_${Date.now()}`,
        roomId: activeRoom.id,
        senderId: currentUser.id,
        senderName: currentUser.displayName,
        senderAvatar: currentUser.avatar,
        vipLevel: currentUser.vipLevel,
        level: currentUser.level,
        isSystem: true,
        text: `قام ${currentUser.displayName} بتشغيل مؤثر صوتي (${type === 'applause' ? 'تصفيق حار 👏' : type === 'oud' ? 'تقاسيم عود 🎶' : type})`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setActiveRoomMessages((prev) => [...prev, msg]);
    }
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        t,
        currentView,
        setCurrentView,
        activeTab,
        setActiveTab,
        currentUser,
        users,
        rooms,
        activeRoom,
        activeRoomMessages,
        gifts,
        vipTiers,
        storeItems,
        agencies,
        agents,
        staff,
        transactions,
        flyingGift,
        entranceBanner,
        luckyConfig,
        updateLuckyConfig,
        bagGifts,
        addBagGifts,
        consumeBagGift,
        globalJackpotBanner,
        triggerGlobalJackpotBanner,
        evaluateLuckyGiftWin,
        activeModal,
        setActiveModal,
        viewingProfileUser,
        setViewingProfileUser,
        joinRoom,
        leaveRoom,
        takeSeat,
        leaveSeat,
        toggleMic,
        toggleSeatLock,
        sendRoomMessage,
        sendGift,
        rechargeCoins,
        agentRechargeUser,
        purchaseVip,
        purchaseStoreItem,
        equipInventoryItem,
        triggerEntranceEffect,
        clearEntranceBanner,
        convertDiamondsToCoins,
        requestWithdrawal,
        createVoiceRoom,
        updateUserProfile,
        adminAddBalance,
        adminToggleBan,
        adminToggleMute,
        adminSetVipLevel,
        adminCloseRoom,
        adminCreateGift,
        adminUpdateGift,
        adminDeleteGift,
        adminCreateStoreItem,
        adminUpdateStoreItem,
        adminDeleteStoreItem,
        adminCreateAgent,
        adminTopupAgent,
        adminUpdateAgencyStatus,
        switchUserIdentity,
        triggerSoundboard,
        firebaseUser,
        authReady,
        authLoading,
        authError,
        clearAuthError,
        needsProfileCompletion,
        guestAccessBypass,
        enterAsGuestDemo,
        returnToAuthScreen,
        firebaseStatus,
        isCloudSyncing,
        cloudMessage,
        signInWithGoogleCloud,
        registerWithEmailProfile,
        loginWithEmail,
        completeGoogleOnboardingProfile,
        signOutCloud,
        testCloudConnection,
        syncAllDataToCloud,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
