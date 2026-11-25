import type { IncomingMessage, ServerResponse } from 'node:http';
import serverCatalogSnapshot from '../src/data/serverCatalogSnapshot.json';

const PERMANENT_FIREBASE_PROJECT_ID = 'shosho-chat-3e571';

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

function decodeFirestoreValue(val: FirestoreValue | undefined): unknown {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue?.values || []).map((v) => decodeFirestoreValue(v));
  }
  if ('mapValue' in val) {
    return decodeFirestoreFields(val.mapValue?.fields);
  }
  return undefined;
}

function decodeFirestoreFields(fields: Record<string, FirestoreValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    const decoded = decodeFirestoreValue(v);
    if (decoded !== undefined) out[k] = decoded;
  }
  return out;
}

async function fetchPublicCollection(collectionName: string): Promise<Record<string, unknown>[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const url = `https://firestore.googleapis.com/v1/projects/${PERMANENT_FIREBASE_PROJECT_ID}/databases/(default)/documents/${collectionName}?pageSize=300`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      documents?: Array<{ fields?: Record<string, FirestoreValue> }>;
    };
    return (data.documents || []).map((doc) => decodeFirestoreFields(doc.fields));
  } catch {
    return [];
  }
}

function mergeCatalogByTimestamp(
  snapshotItems: Record<string, unknown>[],
  remoteItems: Record<string, unknown>[],
  deletedIds: string[]
): Record<string, unknown>[] {
  const deletedSet = new Set(deletedIds);
  const byId = new Map<string, Record<string, unknown>>();

  for (const item of snapshotItems) {
    const id = typeof item?.id === 'string' ? item.id : '';
    if (!id || deletedSet.has(id)) continue;
    byId.set(id, item);
  }

  for (const item of remoteItems) {
    const id = typeof item?.id === 'string' ? item.id : '';
    if (!id || deletedSet.has(id)) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, item);
      continue;
    }
    const existingTs = Date.parse(String(existing.updatedAt || '')) || 0;
    const remoteTs = Date.parse(String(item.updatedAt || '')) || 0;
    if (remoteTs >= existingTs) {
      byId.set(id, item);
    }
  }

  return Array.from(byId.values());
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const [fsGifts, fsStoreItems, fsRoomBackgrounds] = await Promise.all([
    fetchPublicCollection('auravoice_gifts'),
    fetchPublicCollection('auravoice_store_items'),
    fetchPublicCollection('auravoice_room_backgrounds'),
  ]);

  const deletedGiftIds = Array.isArray(serverCatalogSnapshot.deletedGiftIds)
    ? serverCatalogSnapshot.deletedGiftIds.map(String)
    : [];
  const deletedStoreIds = Array.isArray(serverCatalogSnapshot.deletedStoreIds)
    ? serverCatalogSnapshot.deletedStoreIds.map(String)
    : [];
  const deletedBackgroundIds = Array.isArray(serverCatalogSnapshot.deletedBackgroundIds)
    ? serverCatalogSnapshot.deletedBackgroundIds.map(String)
    : [];

  const gifts = mergeCatalogByTimestamp(
    (serverCatalogSnapshot.gifts || []) as Record<string, unknown>[],
    fsGifts,
    deletedGiftIds
  );
  const storeItems = mergeCatalogByTimestamp(
    (serverCatalogSnapshot.storeItems || []) as Record<string, unknown>[],
    fsStoreItems,
    deletedStoreIds
  );
  const roomBackgrounds = mergeCatalogByTimestamp(
    (serverCatalogSnapshot.roomBackgrounds || []) as Record<string, unknown>[],
    fsRoomBackgrounds,
    deletedBackgroundIds
  );

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      mode: 'serverless_cloud',
      firebaseProjectId: PERMANENT_FIREBASE_PROJECT_ID,
      gifts,
      storeItems,
      roomBackgrounds,
      deletedGiftIds,
      deletedStoreIds,
      deletedBackgroundIds,
      updatedAt: serverCatalogSnapshot.updatedAt || Date.now(),
    })
  );
}
