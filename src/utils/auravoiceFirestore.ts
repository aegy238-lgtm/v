import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  firebaseConfig,
  handleFirestoreError,
  OperationType,
  stripUndefinedForFirestore,
} from './firebase';
import {
  Agency,
  AgoraVoiceConfig,
  GiftItem,
  GlobalJackpotBannerState,
  LuckyGiftConfig,
  RechargeAgent,
  RoomBackground,
  RoomChatMessage,
  RoomLiveEvent,
  StaffMember,
  StoreItem,
  Transaction,
  User,
  VoiceRoom,
} from '../types';

export const COLLECTIONS = {
  users: 'auravoice_users',
  rooms: 'auravoice_rooms',
  roomBackgrounds: 'auravoice_room_backgrounds',
  gifts: 'auravoice_gifts',
  storeItems: 'auravoice_store_items',
  agencies: 'auravoice_agencies',
  agents: 'auravoice_agents',
  staff: 'auravoice_staff',
  transactions: 'auravoice_transactions',
  config: 'auravoice_config',
} as const;

export function isCloudWriteReady(): boolean {
  return Boolean(db && auth?.currentUser);
}

export async function fetchAuraUserById(userId: string): Promise<User | null> {
  if (!db || !auth?.currentUser || !userId) return null;
  const path = `${COLLECTIONS.users}/${userId}`;
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.users, userId));
    if (snap.exists()) {
      const data = snap.data() as User;
      if (data?.id && data?.userCode) {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.warn(`fetchAuraUserById notice (${path}):`, error);
    return null;
  }
}

/**
 * Seeds initial AuraVoice VIP collections into Firestore if they are currently empty.
 * Only executes when a verified user is authenticated.
 */
export async function bootstrapAuraVoiceFirestoreIfEmpty(seed: {
  users: User[];
  rooms: VoiceRoom[];
  gifts: GiftItem[];
  storeItems: StoreItem[];
  agencies: Agency[];
  agents: RechargeAgent[];
  staff: StaffMember[];
  transactions: Transaction[];
  luckyConfig: LuckyGiftConfig;
  bagGifts: Record<string, number>;
  agoraConfig?: AgoraVoiceConfig;
}): Promise<boolean> {
  if (!db || !auth?.currentUser) return false;
  const firestore = db;

  try {
    const roomsSnap = await getDocs(query(collection(firestore, COLLECTIONS.rooms), limit(1)));
    const usersSnap = await getDocs(query(collection(firestore, COLLECTIONS.users), limit(1)));
    if (!roomsSnap.empty && !usersSnap.empty) {
      return true;
    }

    const memberBatch = writeBatch(firestore);
    let hasMemberOps = false;
    const nowIso = new Date().toISOString();

    if (usersSnap.empty) {
      seed.users.forEach((u) => {
        memberBatch.set(
          doc(firestore, COLLECTIONS.users, u.id),
          stripUndefinedForFirestore({ ...u, updatedAt: nowIso }),
          { merge: true }
        );
        hasMemberOps = true;
      });
    }

    if (roomsSnap.empty) {
      seed.rooms.forEach((r) => {
        memberBatch.set(
          doc(firestore, COLLECTIONS.rooms, r.id),
          stripUndefinedForFirestore({ ...r, updatedAt: nowIso }),
          { merge: true }
        );
        hasMemberOps = true;
      });
    }

    if (hasMemberOps) {
      await memberBatch.commit();
    }

    // Seed only operational admin collections (agencies, agents, staff, transactions, lucky/agora configs)
    // NEVER seed mock gifts, mock store items, or mock bag items.
    try {
      const adminBatch = writeBatch(firestore);
      let hasAdminOps = false;

      const agenciesSnap = await getDocs(query(collection(firestore, COLLECTIONS.agencies), limit(1)));
      if (agenciesSnap.empty) {
        seed.agencies.forEach((ag) => {
          adminBatch.set(
            doc(firestore, COLLECTIONS.agencies, ag.id),
            stripUndefinedForFirestore({ ...ag, updatedAt: nowIso }),
            { merge: true }
          );
          hasAdminOps = true;
        });
      }

      const agentsSnap = await getDocs(query(collection(firestore, COLLECTIONS.agents), limit(1)));
      if (agentsSnap.empty) {
        seed.agents.forEach((agent) => {
          adminBatch.set(
            doc(firestore, COLLECTIONS.agents, agent.id),
            stripUndefinedForFirestore({ ...agent, updatedAt: nowIso }),
            { merge: true }
          );
          hasAdminOps = true;
        });
      }

      const staffSnap = await getDocs(query(collection(firestore, COLLECTIONS.staff), limit(1)));
      if (staffSnap.empty) {
        seed.staff.forEach((member) => {
          adminBatch.set(
            doc(firestore, COLLECTIONS.staff, member.id),
            stripUndefinedForFirestore({ ...member, updatedAt: nowIso }),
            { merge: true }
          );
          hasAdminOps = true;
        });
      }

      const txSnap = await getDocs(query(collection(firestore, COLLECTIONS.transactions), limit(1)));
      if (txSnap.empty) {
        seed.transactions.slice(0, 50).forEach((tx) => {
          adminBatch.set(
            doc(firestore, COLLECTIONS.transactions, tx.id),
            stripUndefinedForFirestore({ ...tx, updatedAt: nowIso }),
            { merge: true }
          );
          hasAdminOps = true;
        });
      }

      adminBatch.set(
        doc(firestore, COLLECTIONS.config, 'lucky'),
        stripUndefinedForFirestore({ ...seed.luckyConfig, updatedAt: nowIso }),
        { merge: true }
      );
      hasAdminOps = true;

      if (seed.agoraConfig?.appId) {
        adminBatch.set(
          doc(firestore, COLLECTIONS.config, 'agora'),
          stripUndefinedForFirestore({ ...seed.agoraConfig, updatedAt: nowIso }),
          { merge: true }
        );
      }

      if (hasAdminOps) {
        await adminBatch.commit();
      }
    } catch (adminSeedErr) {
      console.warn('AuraVoice admin catalog bootstrap notice:', adminSeedErr);
    }

    return true;
  } catch (error) {
    console.warn('AuraVoice Firestore bootstrap notice:', error);
    return false;
  }
}

/**
 * Full manual/automatic push of all AuraVoice VIP state into Firestore.
 */
export async function syncAllAuraVoiceToFirestore(data: {
  users: User[];
  rooms: VoiceRoom[];
  roomBackgrounds?: RoomBackground[];
  gifts: GiftItem[];
  storeItems: StoreItem[];
  agencies: Agency[];
  agents: RechargeAgent[];
  staff: StaffMember[];
  transactions: Transaction[];
  luckyConfig: LuckyGiftConfig;
  bagGifts: Record<string, number>;
  agoraConfig?: AgoraVoiceConfig;
}): Promise<{ success: boolean; count: number; message: string }> {
  if (!db || !auth?.currentUser) {
    return {
      success: false,
      count: 0,
      message: 'يرجى تسجيل الدخول بحساب Google أولاً لتفعيل المزامنة السحابية.',
    };
  }
  const firestore = db;

  try {
    const batch = writeBatch(firestore);
    const nowIso = new Date().toISOString();
    let count = 0;

    data.users.forEach((u) => {
      batch.set(
        doc(firestore, COLLECTIONS.users, u.id),
        stripUndefinedForFirestore({ ...u, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.rooms.forEach((r) => {
      batch.set(
        doc(firestore, COLLECTIONS.rooms, r.id),
        stripUndefinedForFirestore({ ...r, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    (data.roomBackgrounds || []).forEach((bg) => {
      batch.set(
        doc(firestore, COLLECTIONS.roomBackgrounds, bg.id),
        stripUndefinedForFirestore({ ...bg, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.gifts
      .filter((g) => !g.isStarterDefault && g.id !== 'gift_starter_default')
      .forEach((g) => {
        batch.set(
          doc(firestore, COLLECTIONS.gifts, g.id),
          stripUndefinedForFirestore({ ...g, updatedAt: nowIso }),
          { merge: true }
        );
        count++;
      });

    data.storeItems.forEach((item) => {
      batch.set(
        doc(firestore, COLLECTIONS.storeItems, item.id),
        stripUndefinedForFirestore({ ...item, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.agencies.forEach((ag) => {
      batch.set(
        doc(firestore, COLLECTIONS.agencies, ag.id),
        stripUndefinedForFirestore({ ...ag, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.agents.forEach((agent) => {
      batch.set(
        doc(firestore, COLLECTIONS.agents, agent.id),
        stripUndefinedForFirestore({ ...agent, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.staff.forEach((member) => {
      batch.set(
        doc(firestore, COLLECTIONS.staff, member.id),
        stripUndefinedForFirestore({ ...member, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.transactions.slice(0, 100).forEach((tx) => {
      batch.set(
        doc(firestore, COLLECTIONS.transactions, tx.id),
        stripUndefinedForFirestore({ ...tx, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    batch.set(
      doc(firestore, COLLECTIONS.config, 'lucky'),
      stripUndefinedForFirestore({ ...data.luckyConfig, updatedAt: nowIso }),
      { merge: true }
    );
    batch.set(
      doc(firestore, COLLECTIONS.config, 'bag_gifts'),
      stripUndefinedForFirestore({ items: data.bagGifts, updatedAt: nowIso }),
      { merge: true }
    );
    count += 2;

    if (data.agoraConfig?.appId) {
      batch.set(
        doc(firestore, COLLECTIONS.config, 'agora'),
        stripUndefinedForFirestore({ ...data.agoraConfig, updatedAt: nowIso }),
        { merge: true }
      );
      count += 1;
    }

    await batch.commit();
    return {
      success: true,
      count,
      message: `تمت مزامنة ${count} سجل بنجاح مع قاعدة بيانات ${firebaseConfig.projectId}.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.rooms);
  }
}

export interface DashboardSyncPulse {
  commandId: string;
  type: string;
  payload: Record<string, unknown>;
  issuedBy: string;
  createdAt: number;
  updatedAt: string;
}

/**
 * Public non-PII collection listeners (rooms, gifts, store, agencies, lucky config).
 */
export function subscribeToPublicAuraCollections(handlers: {
  onRooms: (rooms: VoiceRoom[]) => void;
  onRoomBackgrounds?: (backgrounds: RoomBackground[]) => void;
  onGifts: (gifts: GiftItem[]) => void;
  onStoreItems: (items: StoreItem[]) => void;
  onAgencies: (agencies: Agency[]) => void;
  onLuckyConfig: (cfg: LuckyGiftConfig) => void;
  onAgoraConfig?: (cfg: AgoraVoiceConfig) => void;
  onJackpotBanner?: (banner: GlobalJackpotBannerState) => void;
  onDashboardSync?: (pulse: DashboardSyncPulse) => void;
}): () => void {
  if (!db) return () => {};
  const unsubRooms = onSnapshot(
    collection(db, COLLECTIONS.rooms),
    (snap) => {
      const list: VoiceRoom[] = [];
      snap.forEach((d) => {
        const data = d.data() as VoiceRoom;
        if (data?.id && data?.title) list.push(data);
      });
      if (list.length > 0) handlers.onRooms(list);
    },
    (error) => console.warn('subscribeRooms notice:', error)
  );

  const unsubRoomBgs = onSnapshot(
    collection(db, COLLECTIONS.roomBackgrounds),
    (snap) => {
      const list: RoomBackground[] = [];
      snap.forEach((d) => {
        const data = d.data() as RoomBackground;
        if (data?.id && data?.imageUrl) list.push(data);
      });
      handlers.onRoomBackgrounds?.(list);
    },
    (error) => console.warn('subscribeRoomBackgrounds notice:', error)
  );

  const unsubGifts = onSnapshot(
    collection(db, COLLECTIONS.gifts),
    (snap) => {
      const list: GiftItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as GiftItem;
        if (data?.id && data?.nameAr && !data.isStarterDefault && data.id !== 'gift_starter_default') {
          list.push(data);
        }
      });
      handlers.onGifts(list);
    },
    (error) => console.warn('subscribeGifts notice:', error)
  );

  const unsubStore = onSnapshot(
    collection(db, COLLECTIONS.storeItems),
    (snap) => {
      const list: StoreItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as StoreItem;
        if (data?.id && data?.nameAr) list.push(data);
      });
      handlers.onStoreItems(list);
    },
    (error) => console.warn('subscribeStoreItems notice:', error)
  );

  const unsubAgencies = onSnapshot(
    collection(db, COLLECTIONS.agencies),
    (snap) => {
      const list: Agency[] = [];
      snap.forEach((d) => {
        const data = d.data() as Agency;
        if (data?.id && data?.name) list.push(data);
      });
      if (list.length > 0) handlers.onAgencies(list);
    },
    (error) => console.warn('subscribeAgencies notice:', error)
  );

  const unsubLucky = onSnapshot(
    doc(db, COLLECTIONS.config, 'lucky'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as LuckyGiftConfig;
        if (typeof data.winRatePercent === 'number') {
          handlers.onLuckyConfig(data);
        }
      }
    },
    (error) => console.warn('subscribeLucky notice:', error)
  );

  const unsubAgora = onSnapshot(
    doc(db, COLLECTIONS.config, 'agora'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AgoraVoiceConfig;
        if (data?.appId && typeof data.appId === 'string') {
          handlers.onAgoraConfig?.(data);
        }
      }
    },
    (error) => console.warn('subscribeAgora notice:', error)
  );

  const unsubJackpot = onSnapshot(
    doc(db, COLLECTIONS.config, 'jackpot'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GlobalJackpotBannerState;
        if (data?.id && typeof data.createdAt === 'number' && Date.now() - data.createdAt < 10000) {
          handlers.onJackpotBanner?.(data);
        }
      }
    },
    (error) => console.warn('subscribeJackpot notice:', error)
  );

  const unsubDashboardSync = onSnapshot(
    doc(db, COLLECTIONS.config, 'dashboard_sync'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as DashboardSyncPulse;
        if (data?.commandId && data?.type) {
          handlers.onDashboardSync?.(data);
        }
      }
    },
    (error) => {
      console.warn('subscribeDashboardSync notice:', error);
    }
  );

  return () => {
    unsubRooms();
    unsubRoomBgs();
    unsubGifts();
    unsubStore();
    unsubAgencies();
    unsubLucky();
    unsubAgora();
    unsubJackpot();
    unsubDashboardSync();
  };
}

/**
 * Authenticated collection listeners (users, agents, staff, transactions, bag_gifts).
 * Only attach when auth.currentUser is present.
 */
export function subscribeToAuthAuraCollections(handlers: {
  onUsers: (users: User[]) => void;
  onAgents: (agents: RechargeAgent[]) => void;
  onStaff: (staff: StaffMember[]) => void;
  onTransactions: (txs: Transaction[]) => void;
  onBagGifts: (bag: Record<string, number>) => void;
}): () => void {
  if (!db || !auth?.currentUser) return () => {};

  const unsubUsers = onSnapshot(
    collection(db, COLLECTIONS.users),
    (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        const data = d.data() as User;
        if (data?.id && data?.userCode) list.push(data);
      });
      if (list.length > 0) handlers.onUsers(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.users)
  );

  const unsubAgents = onSnapshot(
    collection(db, COLLECTIONS.agents),
    (snap) => {
      const list: RechargeAgent[] = [];
      snap.forEach((d) => {
        const data = d.data() as RechargeAgent;
        if (data?.id && data?.agentCode) list.push(data);
      });
      if (list.length > 0) handlers.onAgents(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.agents)
  );

  const unsubStaff = onSnapshot(
    collection(db, COLLECTIONS.staff),
    (snap) => {
      const list: StaffMember[] = [];
      snap.forEach((d) => {
        const data = d.data() as StaffMember;
        if (data?.id && data?.name) list.push(data);
      });
      if (list.length > 0) handlers.onStaff(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.staff)
  );

  const unsubTx = onSnapshot(
    query(collection(db, COLLECTIONS.transactions), orderBy('timestamp', 'desc'), limit(100)),
    (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        const data = d.data() as Transaction;
        if (data?.id && data?.type) list.push(data);
      });
      if (list.length > 0) handlers.onTransactions(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.transactions)
  );

  const unsubBag = onSnapshot(
    doc(db, COLLECTIONS.config, 'bag_gifts'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { items?: Record<string, number> };
        if (data?.items && typeof data.items === 'object') {
          handlers.onBagGifts(data.items);
        }
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.config}/bag_gifts`)
  );

  return () => {
    unsubUsers();
    unsubAgents();
    unsubStaff();
    unsubTx();
    unsubBag();
  };
}

export function subscribeToRoomMessages(
  roomId: string,
  onMessages: (messages: RoomChatMessage[]) => void
): () => void {
  if (!db || !auth?.currentUser || !roomId) return () => {};
  const path = `${COLLECTIONS.rooms}/${roomId}/messages`;
  return onSnapshot(
    query(collection(db, COLLECTIONS.rooms, roomId, 'messages'), orderBy('id', 'desc'), limit(80)),
    (snap) => {
      const list: RoomChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as RoomChatMessage;
        if (data?.id && data?.roomId && !data.isRtcSignal) list.push(data);
      });
      list.reverse();
      if (list.length > 0) onMessages(list);
    },
    (error) => {
      console.warn(`subscribeToRoomMessages notice (${path}):`, error);
    }
  );
}

export interface FirestoreRtcSignalPayload {
  id: string;
  roomId: string;
  signalType: 'hello' | 'offer' | 'answer' | 'ice' | 'mic_state' | 'leave';
  fromPeerId: string;
  fromUserId: string;
  displayName: string;
  targetPeerId?: string;
  onSeat?: boolean;
  muted?: boolean;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  rtcCreatedAt: number;
}

export async function publishFirestoreRtcSignal(
  payload: Omit<FirestoreRtcSignalPayload, 'id' | 'rtcCreatedAt'>
): Promise<void> {
  if (!db || !auth?.currentUser || !payload.roomId) return;
  const now = Date.now();
  const safeId = `0rtc_${now}_${Math.random().toString(36).slice(2, 8)}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    await setDoc(
      doc(db, COLLECTIONS.rooms, payload.roomId, 'messages', safeId),
      stripUndefinedForFirestore({
        id: safeId,
        roomId: payload.roomId,
        senderId: payload.fromUserId || auth.currentUser.uid,
        senderName: (payload.displayName || 'مستخدم').slice(0, 80),
        senderAvatar: '',
        vipLevel: 0,
        level: 0,
        isSystem: true,
        isRtcSignal: true,
        timestamp: new Date(now).toISOString().slice(11, 19),
        rtcCreatedAt: now,
        rtcSignal: {
          ...payload,
          id: safeId,
          rtcCreatedAt: now,
        },
      })
    );
  } catch (err) {
    console.warn('publishFirestoreRtcSignal notice:', err);
  }
}

export function subscribeToFirestoreRtcSignals(
  roomId: string,
  sinceMs: number,
  onSignal: (signal: FirestoreRtcSignalPayload) => void
): () => void {
  if (!db || !auth?.currentUser || !roomId) return () => {};
  const seen = new Set<string>();
  return onSnapshot(
    query(
      collection(db, COLLECTIONS.rooms, roomId, 'messages'),
      orderBy('rtcCreatedAt', 'desc'),
      limit(60)
    ),
    (snap) => {
      const items: FirestoreRtcSignalPayload[] = [];
      snap.forEach((d) => {
        const data = d.data() as { rtcSignal?: FirestoreRtcSignalPayload; rtcCreatedAt?: number };
        const sig = data?.rtcSignal;
        if (!sig || !sig.id || seen.has(sig.id)) return;
        const ts = sig.rtcCreatedAt || data.rtcCreatedAt || 0;
        if (ts < sinceMs) return;
        items.push(sig);
      });
      // Deliver in chronological order
      items.sort((a, b) => a.rtcCreatedAt - b.rtcCreatedAt);
      items.forEach((sig) => {
        seen.add(sig.id);
        onSignal(sig);
      });
    },
    (err) => {
      console.warn('subscribeToFirestoreRtcSignals notice:', err);
    }
  );
}

export async function publishRoomLiveEventToFirestore(event: RoomLiveEvent): Promise<void> {
  if (!db || !auth?.currentUser || !event.roomId) return;
  const safeId = `msg_${event.createdAt}_${event.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}`;
  const msgDoc: RoomChatMessage = {
    id: safeId,
    roomId: event.roomId,
    senderId: event.senderId || auth.currentUser.uid,
    senderName: (event.senderName || 'مستخدم').slice(0, 80),
    senderAvatar: event.senderAvatar || '',
    vipLevel: event.senderVipLevel || 0,
    level: event.senderLevel || 1,
    isSystem: event.kind !== 'gift_throw' && event.kind !== 'chat_message',
    text: event.kind === 'chat_message' ? event.text : undefined,
    giftData:
      event.kind === 'gift_throw' && event.gift
        ? {
            giftId: event.gift.id,
            giftName: event.gift.nameAr,
            giftIcon: event.gift.icon,
            giftCount: event.count || 1,
            targetUserName: event.targetNames || 'الغرفة',
            totalCoins: (event.gift.coinPrice || 0) * (event.count || 1) * Math.max(1, event.targetSeats?.length || 1),
          }
        : undefined,
    liveEvent: event,
    timestamp: new Date(event.createdAt).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  try {
    await setDoc(
      doc(db, COLLECTIONS.rooms, event.roomId, 'messages', safeId),
      stripUndefinedForFirestore(msgDoc),
      { merge: true }
    );
  } catch (error) {
    console.warn('publishRoomLiveEventToFirestore notice:', error);
  }
}

export async function persistAuraUser(user: User): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.users}/${user.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.users, user.id),
      stripUndefinedForFirestore({ ...user, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAuraRoom(room: VoiceRoom): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.rooms}/${room.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.rooms, room.id),
      stripUndefinedForFirestore({ ...room, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuraRoom(roomId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.rooms}/${roomId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.rooms, roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraRoomBackground(bg: RoomBackground): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.roomBackgrounds}/${bg.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.roomBackgrounds, bg.id),
      stripUndefinedForFirestore({ ...bg, updatedAt: new Date().toISOString() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuraRoomBackground(bgId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.roomBackgrounds}/${bgId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.roomBackgrounds, bgId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistRoomMessage(msg: RoomChatMessage): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const safeId = msg.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${COLLECTIONS.rooms}/${msg.roomId}/messages/${safeId}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.rooms, msg.roomId, 'messages', safeId),
      stripUndefinedForFirestore({ ...msg, id: safeId }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAuraGift(gift: GiftItem): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.gifts}/${gift.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.gifts, gift.id),
      stripUndefinedForFirestore({ ...gift, updatedAt: new Date().toISOString() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuraGift(giftId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.gifts}/${giftId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.gifts, giftId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraStoreItem(item: StoreItem): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.storeItems}/${item.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.storeItems, item.id),
      stripUndefinedForFirestore({ ...item, updatedAt: new Date().toISOString() })
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuraStoreItem(itemId: string): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.storeItems}/${itemId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.storeItems, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraAgent(agent: RechargeAgent): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.agents}/${agent.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.agents, agent.id),
      stripUndefinedForFirestore({ ...agent, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAuraAgency(agency: Agency): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.agencies}/${agency.id}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.agencies, agency.id),
      stripUndefinedForFirestore({ ...agency, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAuraTransaction(tx: Transaction): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const safeId = tx.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${COLLECTIONS.transactions}/${safeId}`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.transactions, safeId),
      stripUndefinedForFirestore({ ...tx, id: safeId, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistLuckyConfig(cfg: LuckyGiftConfig): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.config}/lucky`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.config, 'lucky'),
      stripUndefinedForFirestore({ ...cfg, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistBagGifts(items: Record<string, number>): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.config}/bag_gifts`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.config, 'bag_gifts'),
      stripUndefinedForFirestore({ items, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistAgoraConfig(cfg: AgoraVoiceConfig): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.config}/agora`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.config, 'agora'),
      stripUndefinedForFirestore({ ...cfg, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistJackpotBanner(banner: GlobalJackpotBannerState): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const path = `${COLLECTIONS.config}/jackpot`;
  try {
    await setDoc(
      doc(db, COLLECTIONS.config, 'jackpot'),
      stripUndefinedForFirestore({ ...banner, updatedAt: new Date().toISOString() }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function persistDashboardSyncPulse(
  pulse: Omit<DashboardSyncPulse, 'updatedAt'>
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  try {
    await setDoc(
      doc(db, COLLECTIONS.config, 'dashboard_sync'),
      stripUndefinedForFirestore({ ...pulse, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Non-fatal best-effort pulse for serverless clients
  }
}

export async function purgeLegacyMockCatalogFromFirestore(
  legacyGiftIds: string[],
  legacyStoreIds: string[]
): Promise<{ removedGifts: number; removedStore: number }> {
  if (!db || !auth?.currentUser) {
    throw new Error('يرجى تسجيل الدخول بحساب المسؤول أولاً.');
  }

  let removedGifts = 0;
  let removedStore = 0;
  const batch = writeBatch(db);
  const legacyGiftSet = new Set(legacyGiftIds);
  const legacyStoreSet = new Set(legacyStoreIds);

  const giftsSnap = await getDocs(collection(db, COLLECTIONS.gifts));
  giftsSnap.forEach((d) => {
    if (legacyGiftSet.has(d.id) || d.id === 'gift_starter_default') {
      batch.delete(d.ref);
      removedGifts++;
    }
  });

  const storeSnap = await getDocs(collection(db, COLLECTIONS.storeItems));
  storeSnap.forEach((d) => {
    if (legacyStoreSet.has(d.id)) {
      batch.delete(d.ref);
      removedStore++;
    }
  });

  batch.set(
    doc(db, COLLECTIONS.config, 'bag_gifts'),
    stripUndefinedForFirestore({ items: {}, updatedAt: new Date().toISOString() }),
    { merge: true }
  );

  await batch.commit();
  return { removedGifts, removedStore };
}
