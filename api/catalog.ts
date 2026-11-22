import type { IncomingMessage, ServerResponse } from 'node:http';

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

  const [gifts, storeItems, roomBackgrounds] = await Promise.all([
    fetchPublicCollection('auravoice_gifts'),
    fetchPublicCollection('auravoice_store_items'),
    fetchPublicCollection('auravoice_room_backgrounds'),
  ]);

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      mode: 'serverless_cloud',
      firebaseProjectId: PERMANENT_FIREBASE_PROJECT_ID,
      gifts,
      storeItems,
      roomBackgrounds,
      updatedAt: Date.now(),
    })
  );
}
