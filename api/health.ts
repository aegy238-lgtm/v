import type { IncomingMessage, ServerResponse } from 'node:http';

const PERMANENT_FIREBASE_PROJECT_ID = 'shosho-chat-3e571';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      status: 'ok',
      mode: 'serverless_cloud',
      firebaseProjectId: PERMANENT_FIREBASE_PROJECT_ID,
      firestoreDatabaseId: '(default)',
      timestamp: new Date().toISOString(),
    })
  );
}
