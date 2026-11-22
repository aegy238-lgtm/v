import type { IncomingMessage, ServerResponse } from 'node:http';
import agoraTokenPkg from 'agora-token';

const { RtcRole, RtcTokenBuilder } = agoraTokenPkg;
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

  const reqUrl = new URL(req.url || '/', 'https://localhost');
  const queryAppId = (reqUrl.searchParams.get('appId') || '').trim();
  const envAppId = (process.env.AGORA_APP_ID || '').trim();
  const appId = isValidHex32(queryAppId)
    ? queryAppId
    : isValidHex32(envAppId)
    ? envAppId
    : DEFAULT_AGORA_APP_ID;
  const envCert = (process.env.AGORA_APP_CERTIFICATE || '').trim();
  const channel = (reqUrl.searchParams.get('channel') || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64);
  const uid = (reqUrl.searchParams.get('uid') || '0').trim().slice(0, 64) || '0';

  if (!channel) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'channel is required' }));
    return;
  }

  if (!isValidHex32(envCert)) {
    res.statusCode = 200;
    res.end(JSON.stringify({ mode: 'testing', appId, token: null }));
    return;
  }

  const tokenExpire = 86400;
  const privilegeExpire = 86400;
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    envCert,
    channel,
    uid,
    RtcRole.PUBLISHER,
    tokenExpire,
    privilegeExpire
  );

  res.statusCode = 200;
  res.end(JSON.stringify({ mode: 'secured', appId, token }));
}
