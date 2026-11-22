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
  handleFirestoreError,
  OperationType,
  stripUndefinedForFirestore,
} from './firebase';
import {
  Agency,
  GiftItem,
  LuckyGiftConfig,
  RechargeAgent,
  RoomBackground,
  RoomChatMessage,
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
  return Boolean(auth.currentUser);
}

export async function fetchAuraUserById(userId: string): Promise<User | null> {
  if (!auth.currentUser || !userId) return null;
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
}): Promise<boolean> {
  if (!auth.currentUser) return false;

  try {
    const roomsSnap = await getDocs(query(collection(db, COLLECTIONS.rooms), limit(1)));
    const usersSnap = await getDocs(query(collection(db, COLLECTIONS.users), limit(1)));
    const giftsSnap = await getDocs(query(collection(db, COLLECTIONS.gifts), limit(1)));

    if (!roomsSnap.empty && !usersSnap.empty && !giftsSnap.empty) {
      return true;
    }

    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();

    if (usersSnap.empty) {
      seed.users.forEach((u) => {
        batch.set(
          doc(db, COLLECTIONS.users, u.id),
          stripUndefinedForFirestore({ ...u, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    if (roomsSnap.empty) {
      seed.rooms.forEach((r) => {
        batch.set(
          doc(db, COLLECTIONS.rooms, r.id),
          stripUndefinedForFirestore({ ...r, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    if (giftsSnap.empty) {
      seed.gifts.forEach((g) => {
        batch.set(
          doc(db, COLLECTIONS.gifts, g.id),
          stripUndefinedForFirestore({ ...g, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    const storeSnap = await getDocs(query(collection(db, COLLECTIONS.storeItems), limit(1)));
    if (storeSnap.empty) {
      seed.storeItems.forEach((item) => {
        batch.set(
          doc(db, COLLECTIONS.storeItems, item.id),
          stripUndefinedForFirestore({ ...item, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    const agenciesSnap = await getDocs(query(collection(db, COLLECTIONS.agencies), limit(1)));
    if (agenciesSnap.empty) {
      seed.agencies.forEach((ag) => {
        batch.set(
          doc(db, COLLECTIONS.agencies, ag.id),
          stripUndefinedForFirestore({ ...ag, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    const agentsSnap = await getDocs(query(collection(db, COLLECTIONS.agents), limit(1)));
    if (agentsSnap.empty) {
      seed.agents.forEach((agent) => {
        batch.set(
          doc(db, COLLECTIONS.agents, agent.id),
          stripUndefinedForFirestore({ ...agent, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    const staffSnap = await getDocs(query(collection(db, COLLECTIONS.staff), limit(1)));
    if (staffSnap.empty) {
      seed.staff.forEach((member) => {
        batch.set(
          doc(db, COLLECTIONS.staff, member.id),
          stripUndefinedForFirestore({ ...member, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    const txSnap = await getDocs(query(collection(db, COLLECTIONS.transactions), limit(1)));
    if (txSnap.empty) {
      seed.transactions.slice(0, 50).forEach((tx) => {
        batch.set(
          doc(db, COLLECTIONS.transactions, tx.id),
          stripUndefinedForFirestore({ ...tx, updatedAt: nowIso }),
          { merge: true }
        );
      });
    }

    batch.set(
      doc(db, COLLECTIONS.config, 'lucky'),
      stripUndefinedForFirestore({ ...seed.luckyConfig, updatedAt: nowIso }),
      { merge: true }
    );
    batch.set(
      doc(db, COLLECTIONS.config, 'bag_gifts'),
      stripUndefinedForFirestore({ items: seed.bagGifts, updatedAt: nowIso }),
      { merge: true }
    );

    await batch.commit();
    return true;
  } catch (error) {
    // Non-admin users may not have write permissions on admin-only catalogs during bootstrap; log cleanly
    console.warn('AuraVoice Firestore bootstrap notice:', error);
    return false;
  }
}

/**
 * Full manual/automatic push of all AuraVoice VIP state into Firestore (shosho-chat-3e571).
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
}): Promise<{ success: boolean; count: number; message: string }> {
  if (!auth.currentUser) {
    return {
      success: false,
      count: 0,
      message: 'يرجى تسجيل الدخول بحساب Google أولاً لتفعيل المزامنة السحابية.',
    };
  }

  try {
    const batch = writeBatch(db);
    const nowIso = new Date().toISOString();
    let count = 0;

    data.users.forEach((u) => {
      batch.set(
        doc(db, COLLECTIONS.users, u.id),
        stripUndefinedForFirestore({ ...u, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.rooms.forEach((r) => {
      batch.set(
        doc(db, COLLECTIONS.rooms, r.id),
        stripUndefinedForFirestore({ ...r, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    (data.roomBackgrounds || []).forEach((bg) => {
      batch.set(
        doc(db, COLLECTIONS.roomBackgrounds, bg.id),
        stripUndefinedForFirestore({ ...bg, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.gifts.forEach((g) => {
      batch.set(
        doc(db, COLLECTIONS.gifts, g.id),
        stripUndefinedForFirestore({ ...g, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.storeItems.forEach((item) => {
      batch.set(
        doc(db, COLLECTIONS.storeItems, item.id),
        stripUndefinedForFirestore({ ...item, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.agencies.forEach((ag) => {
      batch.set(
        doc(db, COLLECTIONS.agencies, ag.id),
        stripUndefinedForFirestore({ ...ag, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.agents.forEach((agent) => {
      batch.set(
        doc(db, COLLECTIONS.agents, agent.id),
        stripUndefinedForFirestore({ ...agent, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.staff.forEach((member) => {
      batch.set(
        doc(db, COLLECTIONS.staff, member.id),
        stripUndefinedForFirestore({ ...member, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    data.transactions.slice(0, 100).forEach((tx) => {
      batch.set(
        doc(db, COLLECTIONS.transactions, tx.id),
        stripUndefinedForFirestore({ ...tx, updatedAt: nowIso }),
        { merge: true }
      );
      count++;
    });

    batch.set(
      doc(db, COLLECTIONS.config, 'lucky'),
      stripUndefinedForFirestore({ ...data.luckyConfig, updatedAt: nowIso }),
      { merge: true }
    );
    batch.set(
      doc(db, COLLECTIONS.config, 'bag_gifts'),
      stripUndefinedForFirestore({ items: data.bagGifts, updatedAt: nowIso }),
      { merge: true }
    );
    count += 2;

    await batch.commit();
    return {
      success: true,
      count,
      message: `تمت مزامنة ${count} سجل بنجاح مع قاعدة بيانات shosho-chat-3e571.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.rooms);
  }
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
}): () => void {
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
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.rooms)
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
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.roomBackgrounds)
  );

  const unsubGifts = onSnapshot(
    collection(db, COLLECTIONS.gifts),
    (snap) => {
      const list: GiftItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as GiftItem;
        if (data?.id && data?.nameAr) list.push(data);
      });
      if (list.length > 0) handlers.onGifts(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.gifts)
  );

  const unsubStore = onSnapshot(
    collection(db, COLLECTIONS.storeItems),
    (snap) => {
      const list: StoreItem[] = [];
      snap.forEach((d) => {
        const data = d.data() as StoreItem;
        if (data?.id && data?.nameAr) list.push(data);
      });
      if (list.length > 0) handlers.onStoreItems(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.storeItems)
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
    (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.agencies)
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
    (error) => handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.config}/lucky`)
  );

  return () => {
    unsubRooms();
    unsubRoomBgs();
    unsubGifts();
    unsubStore();
    unsubAgencies();
    unsubLucky();
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
  if (!auth.currentUser) return () => {};

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
  if (!auth.currentUser || !roomId) return () => {};
  const path = `${COLLECTIONS.rooms}/${roomId}/messages`;
  return onSnapshot(
    query(collection(db, COLLECTIONS.rooms, roomId, 'messages'), orderBy('id', 'asc'), limit(100)),
    (snap) => {
      const list: RoomChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as RoomChatMessage;
        if (data?.id && data?.roomId) list.push(data);
      });
      if (list.length > 0) onMessages(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function persistAuraUser(user: User): Promise<void> {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
  const path = `${COLLECTIONS.rooms}/${roomId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.rooms, roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraRoomBackground(bg: RoomBackground): Promise<void> {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
  const path = `${COLLECTIONS.roomBackgrounds}/${bgId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.roomBackgrounds, bgId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistRoomMessage(msg: RoomChatMessage): Promise<void> {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
  const path = `${COLLECTIONS.gifts}/${giftId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.gifts, giftId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraStoreItem(item: StoreItem): Promise<void> {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
  const path = `${COLLECTIONS.storeItems}/${itemId}`;
  try {
    await deleteDoc(doc(db, COLLECTIONS.storeItems, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function persistAuraAgent(agent: RechargeAgent): Promise<void> {
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
  if (!auth.currentUser) return;
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
