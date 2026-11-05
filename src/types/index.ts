export type Language = 'ar' | 'en' | 'zh' | 'hi' | 'id' | 'fil';

export type UserRole = 'user' | 'host' | 'moderator' | 'agent' | 'admin' | 'superadmin';

export type StaffRole = 
  | 'Super Admin'
  | 'Admin'
  | 'Room Manager'
  | 'Agency Manager'
  | 'Recharge Manager'
  | 'Finance Manager'
  | 'Customer Service'
  | 'Moderator';

export type ActiveScreenTab = 'room' | 'game' | 'chat' | 'me';

export interface User {
  id: string;
  userCode: string; // e.g. "6919142"
  username: string;
  displayName: string;
  avatar: string;
  coverImage: string;
  bio: string;
  age?: number;
  gender?: 'male' | 'female';
  level: number;
  vipLevel: number; // 0 to 15
  coins: number; // الكونز
  diamonds: number; // الماس
  country: string;
  countryFlag: string;
  followersCount: number;
  followingCount: number;
  friendsCount: number;
  likesCount?: number;
  visitorsCount?: number;
  agencyId?: string;
  agencyName?: string;
  agencyRole?: 'none' | 'host' | 'manager' | 'owner';
  activeFrameId?: string;
  activeEntranceId?: string;
  activeBadgeId?: string;
  isMuted: boolean;
  isBanned: boolean;
  online: boolean;
  createdAt: string;
}

export type RoomCategory = 
  | 'all'
  | 'chat'
  | 'music'
  | 'games'
  | 'vip'
  | 'official'
  | 'agency'
  | 'celebrity';

export type RoomType = 'public' | 'password' | 'vip' | 'official';

export interface RoomSeat {
  index: number;
  userId: string | null;
  userName?: string;
  userAvatar?: string;
  vipLevel?: number;
  level?: number;
  activeFrameId?: string;
  heartPoints?: number;
  isMuted: boolean;
  isLocked: boolean;
  isReserved: boolean;
  reservedForName?: string;
  isSpeaking: boolean;
  audioLevel: number; // 0 to 100
}

export interface VoiceRoom {
  id: string;
  roomNo: string;
  title: string;
  description: string;
  coverImage: string;
  category: RoomCategory;
  type: RoomType;
  password?: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  seatCount: 4 | 6 | 8 | 9 | 12 | 16 | 20 | 24;
  seats: RoomSeat[];
  moderators: string[];
  bannedUserIds: string[];
  onlineViewersCount: number;
  totalDiamondsEarned: number;
  tags: string[];
  currentMusicTrack?: string;
  isLocked?: boolean;
  announcement?: string;
}

export type GiftCategory = 'classic' | 'luxury' | 'romantic' | 'magic' | 'vip' | 'lucky' | 'cp' | 'celebrity';
export type SoundEffectType = 'chime' | 'fanfare' | 'roar' | 'magic' | 'laser' | 'applause' | 'slot' | 'dice';

export interface GiftItem {
  id: string;
  name: string;
  nameAr: string;
  category: GiftCategory;
  coinPrice: number;
  diamondReward: number;
  icon: string; // Emoji / SVG / Visual representation
  accentColor: string;
  animationType: 'particle' | 'svga' | 'luxury_banner' | 'explosion' | 'lollipop_matrix';
  soundEffect: SoundEffectType;
  vipMinLevel?: number;
  isLucky?: boolean;
  descriptionAr: string;
}

export interface VipTier {
  level: number;
  nameAr: string;
  nameEn: string;
  coinCostMonthly: number;
  badgeIcon: string;
  frameColor: string;
  entranceName: string;
  entranceIcon: string;
  perks: string[];
  chatColor: string;
}

export interface StoreItem {
  id: string;
  type: 'frame' | 'entrance' | 'badge' | 'bubble';
  nameAr: string;
  nameEn: string;
  priceCoins: number;
  durationDays: number;
  previewUrl: string;
  previewGradient: string;
  icon: string;
  vipLevelReq?: number;
  descriptionAr: string;
}

export interface UserInventoryItem {
  id: string;
  itemId: string;
  type: 'frame' | 'entrance' | 'badge' | 'vip';
  nameAr: string;
  icon: string;
  gradient?: string;
  acquiredAt: string;
  expiresAt: string;
  isEquipped: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  type: 
    | 'recharge'
    | 'gift_sent'
    | 'gift_received'
    | 'vip_purchase'
    | 'item_purchase'
    | 'exchange_diamonds'
    | 'withdrawal'
    | 'agent_recharge_payout'
    | 'agency_commission'
    | 'admin_adjustment';
  coinsDelta: number;
  diamondsDelta: number;
  details: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'rejected';
  referenceId?: string;
}

export interface Agency {
  id: string;
  agencyNo: string;
  name: string;
  logo: string;
  ownerId: string;
  ownerName: string;
  hostCount: number;
  activeHostsCount: number;
  totalDiamondsEarned: number;
  netProfitsUSD: number;
  commissionRate: number; // e.g. 25 (%)
  status: 'active' | 'pending' | 'suspended';
  targetDiamondsMonthly: number;
  createdAt: string;
}

export interface RechargeAgent {
  id: string;
  agentCode: string;
  name: string;
  phone: string;
  avatar: string;
  balanceCoins: number;
  totalRechargedCoins: number;
  totalOperations: number;
  commissionEarnedCoins: number;
  commissionRate: number; // e.g. 5 (%)
  status: 'active' | 'paused';
}

export interface RoomChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  vipLevel: number;
  level: number;
  text?: string;
  isSystem?: boolean;
  giftData?: {
    giftId: string;
    giftName: string;
    giftIcon: string;
    giftCount: number;
    targetUserName: string;
    totalCoins: number;
  };
  timestamp: string;
}

export interface PrivateMessage {
  id: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  giftIcon?: string;
  timestamp: string;
  isRead: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  permissions: string[];
  status: 'active' | 'suspended';
  lastActive: string;
}
