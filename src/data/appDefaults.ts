import {
  Agency,
  GiftItem,
  RechargeAgent,
  RoomBackground,
  RoomSeat,
  StaffMember,
  StoreItem,
  Transaction,
  User,
  VipTier,
  VoiceRoom,
} from '../types';
import serverCatalogSnapshot from './serverCatalogSnapshot.json';

export const SNAPSHOT_GIFTS: GiftItem[] = Array.isArray(serverCatalogSnapshot.gifts)
  ? (serverCatalogSnapshot.gifts as unknown as GiftItem[])
  : [];

export const SNAPSHOT_STORE_ITEMS: StoreItem[] = Array.isArray(serverCatalogSnapshot.storeItems)
  ? serverCatalogSnapshot.storeItems.map((raw) => {
      const item = raw as Record<string, unknown>;
      const nameAr = String(item.nameAr || item.name || '');
      const nameEn = String(item.nameEn || item.name || nameAr);
      return {
        id: String(item.id || ''),
        type: (item.type as StoreItem['type']) || 'frame',
        nameAr,
        nameEn,
        priceCoins: Number(item.priceCoins) || 0,
        durationDays: Number(item.durationDays) || 30,
        previewUrl: typeof item.previewUrl === 'string' ? item.previewUrl : '',
        videoUrl: typeof item.videoUrl === 'string' ? item.videoUrl : undefined,
        effectDurationSec:
          typeof item.effectDurationSec === 'number' ? item.effectDurationSec : undefined,
        previewGradient:
          typeof item.previewGradient === 'string' ? item.previewGradient : 'from-amber-500 to-yellow-600',
        icon: typeof item.icon === 'string' ? item.icon : '✨',
        descriptionAr: typeof item.descriptionAr === 'string' ? item.descriptionAr : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      };
    })
  : [];

export const SNAPSHOT_ROOM_BACKGROUNDS: RoomBackground[] = Array.isArray(
  serverCatalogSnapshot.roomBackgrounds
)
  ? (serverCatalogSnapshot.roomBackgrounds as RoomBackground[])
  : [];

export interface RechargePackage {
  coins: number;
  bonus: number;
  priceUSD: string;
  popular?: boolean;
}

export const STARTER_DEFAULT_GIFT_ID = 'gift_starter_default';

export const STARTER_DEFAULT_GIFT: GiftItem = {
  id: STARTER_DEFAULT_GIFT_ID,
  name: 'Royal Rose',
  nameAr: 'وردة الترحيب',
  category: 'classic',
  coinPrice: 10,
  diamondReward: 5,
  icon: '🌹',
  accentColor: '#f43f5e',
  animationType: 'particle',
  soundEffect: 'chime',
  isStarterDefault: true,
  descriptionAr: 'هدية ترحيبية افتراضية تظهر تلقائياً حتى إضافة هدايا جديدة من لوحة المدير.',
};

export const LEGACY_MOCK_GIFT_IDS: string[] = [
  'g_rose',
  'g_coffee',
  'g_heart',
  'g_perfume',
  'g_ring',
  'g_crown',
  'g_sports_car',
  'g_yacht',
  'g_castle',
  'g_dragon',
  'g_falcon',
  'g_jet',
  'g_lollipop',
  'g_lucky_box',
  'g_lucky_clover',
  'g_lucky_star',
];

export const LEGACY_MOCK_STORE_IDS: string[] = [
  'f_gold',
  'f_diamond',
  'f_dragon',
  'f_royal',
  'f_neon',
  'f_phoenix',
  'e_sports_car',
  'e_dragon',
  'e_falcon',
  'e_yacht',
  'e_royal_carriage',
  'e_jet',
];

export const RECHARGE_PACKAGES: RechargePackage[] = [
  { coins: 1000, bonus: 0, priceUSD: '1.49' },
  { coins: 5000, bonus: 250, priceUSD: '6.99' },
  { coins: 15000, bonus: 1500, priceUSD: '19.99', popular: true },
  { coins: 35000, bonus: 4500, priceUSD: '44.99' },
  { coins: 75000, bonus: 12000, priceUSD: '89.99' },
  { coins: 150000, bonus: 30000, priceUSD: '169.99', popular: true },
  { coins: 350000, bonus: 85000, priceUSD: '379.99' },
  { coins: 1000000, bonus: 300000, priceUSD: '999.99' },
];

export const VIP_TIERS: VipTier[] = [
  {
    level: 1,
    nameAr: 'فارس برونزي',
    nameEn: 'Bronze Knight',
    coinCostMonthly: 5000,
    badgeIcon: '🛡️',
    frameColor: '#cd7f32',
    entranceName: 'دخول الفارس البرونزي',
    entranceIcon: '🛡️',
    chatColor: '#fbbf24',
    perks: ['شارة VIP 1 بجانب الاسم', 'أولوية الجلوس على المايك', 'مكافأة يومية 100 كوينز'],
  },
  {
    level: 2,
    nameAr: 'فارس فضي',
    nameEn: 'Silver Knight',
    coinCostMonthly: 15000,
    badgeIcon: '⚔️',
    frameColor: '#cbd5e1',
    entranceName: 'موكب الفضة الملكي',
    entranceIcon: '⚔️',
    chatColor: '#e2e8f0',
    perks: ['شارة VIP 2 الفضية', 'رسائل دردشة مميزة', 'حماية ضد الكتم العادي'],
  },
  {
    level: 3,
    nameAr: 'نبيل ذهبي',
    nameEn: 'Golden Noble',
    coinCostMonthly: 35000,
    badgeIcon: '🏅',
    frameColor: '#f59e0b',
    entranceName: 'دخول النبيل الذهبي',
    entranceIcon: '✨',
    chatColor: '#fcd34d',
    perks: ['إعلان دخول خاص للغرف', 'خصم 5% في المتجر الملكي', 'أولوية الدعم الفني'],
  },
  {
    level: 4,
    nameAr: 'أمير الياقوت',
    nameEn: 'Sapphire Prince',
    coinCostMonthly: 75000,
    badgeIcon: '💎',
    frameColor: '#38bdf8',
    entranceName: 'عاصفة الياقوت',
    entranceIcon: '💎',
    chatColor: '#7dd3fc',
    perks: ['إطار ياقوتي متوهج', 'منع الطرد من المشرفين العاديين', 'فتح جميع ألوان الدردشة'],
  },
  {
    level: 5,
    nameAr: 'سلطان الزمرد',
    nameEn: 'Emerald Sultan',
    coinCostMonthly: 150000,
    badgeIcon: '👑',
    frameColor: '#10b981',
    entranceName: 'موكب الزمرد الملكي',
    entranceIcon: '👑',
    chatColor: '#6ee7b7',
    perks: ['تأثير دخول فاخر في الغرف', 'خصم 10% في المتجر', 'ظهور في قائمة كبار الشخصيات'],
  },
  {
    level: 6,
    nameAr: 'إمبراطور اللهب',
    nameEn: 'Flame Emperor',
    coinCostMonthly: 300000,
    badgeIcon: '🔥',
    frameColor: '#f97316',
    entranceName: 'تنين اللهب الأسطوري',
    entranceIcon: '🔥',
    chatColor: '#fdba74',
    perks: ['تأثير دخول ناري على كامل الغرفة', 'حماية شاملة للحساب', 'هدايا حصرية لمستوى VIP 6'],
  },
  {
    level: 7,
    nameAr: 'ملك الألماس',
    nameEn: 'Diamond King',
    coinCostMonthly: 600000,
    badgeIcon: '💠',
    frameColor: '#818cf8',
    entranceName: 'قصر الألماس السماوي',
    entranceIcon: '💠',
    chatColor: '#c7d2fe',
    perks: ['دخول خفي للغرف عند الرغبة', 'رقم ID مميز قصير', 'خصم 15% على كل العناصر'],
  },
  {
    level: 8,
    nameAr: 'قيصر السماء',
    nameEn: 'Sky Caesar',
    coinCostMonthly: 1200000,
    badgeIcon: '🦅',
    frameColor: '#e879f9',
    entranceName: 'صقر القيصر الذهبي',
    entranceIcon: '🦅',
    chatColor: '#f5d0fe',
    perks: ['بنر دخول ملكي عام', 'مضاعفة نقاط الخبرة x2', 'دعم مخصص على مدار الساعة'],
  },
  {
    level: 9,
    nameAr: 'أسطورة فوكاشات',
    nameEn: 'FokaChat Legend',
    coinCostMonthly: 2500000,
    badgeIcon: '🌟',
    frameColor: '#fb7185',
    entranceName: 'موكب الأساطير الذهبي',
    entranceIcon: '🌟',
    chatColor: '#fecdd3',
    perks: ['أعلى أولوية في البحث والغرف', 'خصم 20% في المتجر الملكي', 'تخصيص كامل للغرفة الشخصية'],
  },
  {
    level: 10,
    nameAr: 'تاج الإمبراطور الأعظم',
    nameEn: 'Supreme Emperor',
    coinCostMonthly: 5000000,
    badgeIcon: '🏆',
    frameColor: '#facc15',
    entranceName: 'عرش الإمبراطور الأعظم',
    entranceIcon: '🏆',
    chatColor: '#fef08a',
    perks: ['لقب الإمبراطور الحصري', 'إعلان عالمي عند الدخول', 'جميع مزايا VIP المفتوحة بالكامل'],
  },
];

function createEmptySeats(count: number): RoomSeat[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    userId: null,
    isMuted: false,
    isLocked: false,
    isReserved: false,
    isSpeaking: false,
    audioLevel: 0,
  }));
}

export const INITIAL_USERS: User[] = [
  {
    id: 'user_current',
    userCode: '2026091',
    username: 'fokachat_guest',
    displayName: 'زائر فوكاشات',
    avatar: '/logo.png',
    coverImage: '/logo.png',
    bio: 'أهلاً بك في منصة فوكاشات للدردشة الصوتية المباشرة.',
    level: 1,
    vipLevel: 0,
    coins: 5000,
    diamonds: 0,
    country: 'مصر',
    countryFlag: '🇪🇬',
    followersCount: 0,
    followingCount: 0,
    friendsCount: 0,
    likesCount: 0,
    visitorsCount: 0,
    isMuted: false,
    isBanned: false,
    online: true,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_ROOMS: VoiceRoom[] = [
  {
    id: 'room_official_lobby',
    roomNo: '2026091',
    title: 'الديوانية الملكية - فوكاشات',
    description: 'الغرفة الرسمية للترحيب والتعارف الصوتي المباشر في فوكاشات.',
    coverImage: '/logo.png',
    category: 'official',
    type: 'official',
    ownerId: 'user_current',
    ownerName: 'إدارة فوكاشات',
    ownerAvatar: '/logo.png',
    seatCount: 8,
    seats: createEmptySeats(8),
    moderators: [],
    bannedUserIds: [],
    onlineViewersCount: 1,
    totalDiamondsEarned: 0,
    tags: ['رسمي', 'دردشة', 'فوكاشات'],
    announcement: 'مرحباً بكم في فوكاشات! التزموا بالاحترام المتبادل واستمتعوا بالبث الصوتي المباشر.',
  },
];

export const INITIAL_AGENCIES: Agency[] = [];
export const INITIAL_AGENTS: RechargeAgent[] = [];
export const INITIAL_STAFF: StaffMember[] = [];
export const INITIAL_TRANSACTIONS: Transaction[] = [];
