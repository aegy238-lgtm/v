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
import confetti from 'canvas-confetti';

interface FlyingGiftState {
  gift: GiftItem;
  count: number;
  senderName: string;
  senderVip: number;
  targetName: string;
}

interface EntranceBannerState {
  userName: string;
  vipLevel: number;
  entranceName: string;
  entranceIcon: string;
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
  equipInventoryItem: (type: 'frame' | 'entrance' | 'badge' | 'vip', itemId: string) => void;
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
  adminCreateAgent: (agent: Partial<RechargeAgent>) => void;
  adminTopupAgent: (agentId: string, coins: number) => void;
  adminUpdateAgencyStatus: (agencyId: string, status: 'active' | 'pending' | 'suspended') => void;
  switchUserIdentity: (userId: string) => void;
  triggerSoundboard: (type: 'applause' | 'oud' | 'fanfare' | 'roar' | 'magic') => void;
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
    const saved = localStorage.getItem('auravoice_rooms_clean_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.some((r: VoiceRoom) => r.roomNo === '2026091' && r.seats.length === 24)) {
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
  const [storeItems] = useState<StoreItem[]>(STORE_ITEMS);

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

  // Modals
  const [activeModal, setActiveModal] = useState<'none' | 'wallet' | 'vip' | 'store' | 'backpack' | 'games' | 'agency' | 'profile' | 'create_room' | 'messages'>('none');
  const [viewingProfileUser, setViewingProfileUser] = useState<User | null>(null);

  const currentUser = users.find((u) => u.id === currentUserId) || users[0];
  const rawActiveRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const activeRoom: VoiceRoom | null = rawActiveRoom
    ? {
        ...rawActiveRoom,
        seats: Array.from({ length: Math.max(24, rawActiveRoom.seats?.length || 0) }, (_, idx) => {
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
    localStorage.setItem('auravoice_rooms_clean_v3', JSON.stringify(rooms));
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
      prev.map((r) => (r.id === roomId ? { ...r, onlineViewersCount: r.onlineViewersCount + 1 } : r))
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

    // If user has VIP >= 1, trigger animated entrance banner
    if (currentUser.vipLevel >= 1) {
      const vipInfo = vipTiers.find((v) => v.level === currentUser.vipLevel) || vipTiers[0];
      setEntranceBanner({
        userName: currentUser.displayName,
        vipLevel: currentUser.vipLevel,
        entranceName: vipInfo.entranceName,
        entranceIcon: vipInfo.entranceIcon,
      });

      sound.playGiftSound('fanfare');

      setTimeout(() => {
        setEntranceBanner(null);
      }, 4000);
    }
  };

  // Leave Room
  const leaveRoom = () => {
    if (activeRoomId) {
      // Free up any seat held by currentUser
      setRooms((prev) =>
        prev.map((r) => {
          if (r.id === activeRoomId) {
            return {
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
    if (!activeRoom) return;
    const currentSeats = activeRoom.seats || [];
    const seat = currentSeats[seatIndex];
    if (seat?.isLocked) {
      alert('المقعد مقفل من قِبل المشرف');
      return;
    }
    if (seat?.userId && seat.userId !== currentUser.id) {
      alert('المقعد مشغول بالفعل');
      return;
    }

    sound.playMicClick(true);

    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const targetLength = Math.max(24, seatIndex + 1, r.seats?.length || 0);
          const expandedSeats: RoomSeat[] = Array.from({ length: targetLength }, (_, idx) => {
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

          return {
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
          return {
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
          return {
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
        }
        return r;
      })
    );
  };

  // Toggle Seat Lock (by room owner/moderator)
  const toggleSeatLock = (seatIndex: number) => {
    if (!activeRoom) return;
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id === activeRoom.id) {
          const targetLength = Math.max(24, seatIndex + 1, r.seats?.length || 0);
          const expandedSeats: RoomSeat[] = Array.from({ length: targetLength }, (_, idx) => {
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

          return {
            ...r,
            seats: expandedSeats.map((s, idx) =>
              idx === seatIndex ? { ...s, isLocked: !s.isLocked } : s
            ),
          };
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

    // Identify target users & seat indices
    let targets: { id: string; name: string; seatIndex?: number }[] = [];

    if (seatIndices && seatIndices.length > 0) {
      seatIndices.forEach((sIdx) => {
        const seat = activeRoom.seats[sIdx];
        if (seat && seat.userId) {
          targets.push({ id: seat.userId, name: seat.userName || `مقعد ${sIdx + 1}`, seatIndex: sIdx });
        } else {
          targets.push({ id: activeRoom.ownerId, name: `مقعد ${sIdx + 1}`, seatIndex: sIdx });
        }
      });
    } else if (targetType === 'all') {
      const activeSeats = activeRoom.seats.filter((s) => s.userId);
      if (activeSeats.length === 0) {
        targets = [{ id: activeRoom.ownerId, name: activeRoom.ownerName, seatIndex: 0 }];
      } else {
        targets = activeSeats.map((s) => ({ id: s.userId!, name: s.userName || 'مستخدم', seatIndex: s.index }));
      }
    } else if (targetType === 'seat' && seatIndex !== undefined) {
      const targetSeat = activeRoom.seats[seatIndex];
      if (targetSeat && targetSeat.userId) {
        targets = [{ id: targetSeat.userId, name: targetSeat.userName || 'مستخدم', seatIndex }];
      } else {
        targets = [{ id: activeRoom.ownerId, name: activeRoom.ownerName, seatIndex }];
      }
    } else {
      const speakingSeat = activeRoom.seats.find((s) => s.isSpeaking && s.userId);
      if (speakingSeat && speakingSeat.userId) {
        targets = [{ id: speakingSeat.userId, name: speakingSeat.userName || 'المتحدث', seatIndex: speakingSeat.index }];
      } else {
        targets = [{ id: activeRoom.ownerId, name: activeRoom.ownerName, seatIndex: 0 }];
      }
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
          return {
            ...u,
            coins: u.coins - totalCoinsNeeded,
            level: Math.min(100, u.level + Math.floor(totalCoinsNeeded / 20000)),
          };
        }
        // Add diamonds to recipients
        const isTarget = targets.some((t) => t.id === u.id);
        if (isTarget) {
          const diamondsReward = gift.diamondReward * count;
          return {
            ...u,
            diamonds: u.diamonds + diamondsReward,
            level: Math.min(100, u.level + Math.floor(diamondsReward / 10000)),
          };
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
          return {
            ...r,
            totalDiamondsEarned: r.totalDiamondsEarned + diamondsTotal,
            seats: updatedSeats,
          };
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

    // Trigger Flying Gift Banner Animation
    setFlyingGift({
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
    return true;
  };

  // Recharge Coins
  const rechargeCoins = (coins: number, paymentMethod: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, coins: u.coins + coins } : u))
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

    sound.playWinChime();
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
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
      prev.map((a) =>
        a.id === agentId
          ? {
              ...a,
              balanceCoins: a.balanceCoins - coinAmount,
              totalRechargedCoins: a.totalRechargedCoins + coinAmount,
              totalOperations: a.totalOperations + 1,
              commissionEarnedCoins: a.commissionEarnedCoins + commissionEarned,
            }
          : a
      )
    );

    // Add coins to target user
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, coins: u.coins + coinAmount } : u))
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
      alert(`رصيدك من العملات لا يكفي للاشتراك في VIP ${level}. التكلفة: ${totalCost.toLocaleString()} عملة`);
      return false;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              coins: u.coins - totalCost,
              vipLevel: Math.max(u.vipLevel, level),
            }
          : u
      )
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

    sound.playGiftSound('fanfare');
    confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
    return true;
  };

  // Purchase Store Item (Frame, Entrance, Badge)
  const purchaseStoreItem = (itemId: string): boolean => {
    const item = storeItems.find((i) => i.id === itemId);
    if (!item) return false;

    if (currentUser.coins < item.priceCoins) {
      alert(`رصيدك من العملات لا يكفي لشراء ${item.nameAr}.`);
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
          return { ...u, ...updates };
        }
        return u;
      })
    );

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

    sound.playWinChime();
    return true;
  };

  // Equip Item from Backpack
  const equipInventoryItem = (type: 'frame' | 'entrance' | 'badge' | 'vip', itemId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === currentUser.id) {
          if (type === 'frame') return { ...u, activeFrameId: itemId };
          if (type === 'entrance') return { ...u, activeEntranceId: itemId };
          if (type === 'badge') return { ...u, activeBadgeId: itemId };
        }
        return u;
      })
    );
    sound.playMicClick(true);
  };

  // Convert Diamonds to Coins
  const convertDiamondsToCoins = (diamondsToExchange: number): boolean => {
    if (currentUser.diamonds < diamondsToExchange) {
      alert('رصيدك من الألماس لا يكفي للاستبدال');
      return false;
    }

    // Exchange rate: 1 Diamond = 2 Coins + 10% bonus
    const coinsReceived = Math.round(diamondsToExchange * 2.1);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              diamonds: u.diamonds - diamondsToExchange,
              coins: u.coins + coinsReceived,
            }
          : u
      )
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

    sound.playWinChime();
    return true;
  };

  // Request Profit Withdrawal
  const requestWithdrawal = (diamondsAmount: number, bankInfo: string): boolean => {
    if (currentUser.diamonds < diamondsAmount) {
      alert('رصيد الألماس غير كافٍ');
      return false;
    }

    // Deduction
    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id ? { ...u, diamonds: u.diamonds - diamondsAmount } : u
      )
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

    alert(`تم استلام طلب السحب بنجاح بقيمة $${usdValue.toLocaleString()}! سيتم التحويل بعد مراجعة الإدارة المالية.`);
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
    joinRoom(newRoom.id);
  };

  // Update User Profile (Name, Avatar, Bio, Country, Special ID userCode, etc.)
  const updateUserProfile = (updates: Partial<User>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...updates } : u))
    );
  };

  // Admin Actions
  const adminAddBalance = (userId: string, coins: number, diamonds: number, note: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            coins: Math.max(0, u.coins + coins),
            diamonds: Math.max(0, u.diamonds + diamonds),
          };
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
  };

  const adminToggleBan = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isBanned: !u.isBanned } : u))
    );
  };

  const adminToggleMute = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isMuted: !u.isMuted } : u))
    );
  };

  const adminSetVipLevel = (userId: string, level: number) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, vipLevel: level } : u))
    );
  };

  const adminCloseRoom = (roomId: string) => {
    if (activeRoomId === roomId) {
      leaveRoom();
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const adminCreateGift = (gift: GiftItem) => {
    setGifts((prev) => [gift, ...prev]);
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
  };

  const adminTopupAgent = (agentId: string, coins: number) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, balanceCoins: a.balanceCoins + coins } : a))
    );
  };

  const adminUpdateAgencyStatus = (agencyId: string, status: 'active' | 'pending' | 'suspended') => {
    setAgencies((prev) =>
      prev.map((a) => (a.id === agencyId ? { ...a, status } : a))
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
        adminCreateAgent,
        adminTopupAgent,
        adminUpdateAgencyStatus,
        switchUserIdentity,
        triggerSoundboard,
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
