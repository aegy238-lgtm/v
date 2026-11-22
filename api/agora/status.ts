import type { IncomingMessage, ServerResponse } from 'node:http';

const DEFAULT_AGORA_APP_ID = 'd5c272d82b094c2f86ccc75df0819dfe';

function isValidHex32(val: string): boolean {
  return /^[0-9a-fA-F]{32}$/.test(val.trim());
}

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

  const envAppId = (process.env.AGORA_APP_ID || '').trim();
  const appId = isValidHex32(envAppId) ? envAppId : DEFAULT_AGORA_APP_ID;
  const envCert = (process.env.AGORA_APP_CERTIFICATE || '').trim();
  const hasCertificate = isValidHex32(envCert);

  res.statusCode = 200;
  res.end(
    JSON.stringify({
      appId,
      hasCertificate,
      certificateSource: hasCertificate ? 'env' : 'none',
      mode: hasCertificate ? 'secured_token' : 'testing_app_id',
    })
  );
}
