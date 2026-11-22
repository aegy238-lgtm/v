import type { IncomingMessage, ServerResponse } from 'node:http';

const PERMANENT_FIREBASE_PROJECT_ID = 'shosho-chat-3e571';

async function countActiveFirestoreRooms(): Promise<number> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const url = `https://firestore.googleapis.com/v1/projects/${PERMANENT_FIREBASE_PROJECT_ID}/databases/(default)/documents/auravoice_rooms?pageSize=20`;
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) return 0;
    const data = (await r.json()) as { documents?: unknown[] };
    return Array.isArray(data.documents) ? data.documents.length : 0;
  } catch {
    return 0;
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

  const activeRoomsCount = await countActiveFirestoreRooms();

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: 'online',
      engine: 'firestore_rtc',
      mode: 'serverless_cloud',
      wsPath: 'Firestore Realtime WebRTC',
      firebaseProjectId: PERMANENT_FIREBASE_PROJECT_ID,
      activeRoomsCount,
      activePeersCount: 0,
      activeSpeakersCount: 0,
      uptimeSec: 0,
      rooms: [],
    })
  );
}
