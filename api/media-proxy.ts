import type { IncomingMessage, ServerResponse } from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';

const ALLOWED_MEDIA_PREFIXES = [
  'video/',
  'image/',
  'audio/',
  'application/octet-stream',
  'binary/octet-stream',
];

function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')) return true;
  if (lower.startsWith('::ffff:')) {
    return isPrivateOrReservedIp(lower.slice(7));
  }
  return false;
}

async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('unsupported_protocol');
  }
  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('blocked_host');
  }
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) throw new Error('blocked_ip');
    return parsed;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length || records.some((r) => isPrivateOrReservedIp(r.address))) {
    throw new Error('blocked_dns_ip');
  }
  return parsed;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, Content-Type'
  );

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return;
  }

  try {
    const reqUrl = new URL(req.url || '/', 'https://localhost');
    const rawTarget = (reqUrl.searchParams.get('url') || '').trim();
    if (!rawTarget || rawTarget.length > 2048) {
      res.statusCode = 400;
      res.end('Invalid media url');
      return;
    }

    const safeTarget = await assertSafePublicUrl(rawTarget);
    const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 18000);

    const upstream = await fetch(safeTarget.toString(), {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        ...(rangeHeader ? { Range: rangeHeader } : {}),
        'User-Agent': 'AuraVoice-MediaProxy/1.0',
        Accept: '*/*',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (upstream.url && upstream.url !== safeTarget.toString()) {
      await assertSafePublicUrl(upstream.url);
    }

    if (!upstream.ok && upstream.status !== 206) {
      res.statusCode = upstream.status || 502;
      res.end('Upstream media fetch failed');
      return;
    }

    const contentType = (upstream.headers.get('content-type') || 'application/octet-stream').toLowerCase();
    const isAllowed = ALLOWED_MEDIA_PREFIXES.some((prefix) => contentType.startsWith(prefix));
    if (!isAllowed) {
      res.statusCode = 415;
      res.end('Unsupported media content type');
      return;
    }

    const lowerUrl = safeTarget.pathname.toLowerCase();
    const resolvedContentType =
      contentType.includes('octet-stream') && (lowerUrl.endsWith('.vap') || lowerUrl.endsWith('.mp4') || lowerUrl.includes('vap'))
        ? 'video/mp4'
        : contentType;

    res.statusCode = upstream.status;
    res.setHeader('Content-Type', resolvedContentType);
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
    res.setHeader('Accept-Ranges', acceptRanges);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (req.method === 'HEAD' || !upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    let totalBytes = 0;
    const maxBytes = 40 * 1024 * 1024;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          break;
        }
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (
      code === 'unsupported_protocol' ||
      code === 'blocked_host' ||
      code === 'blocked_ip' ||
      code === 'blocked_dns_ip'
    ) {
      res.statusCode = 403;
      res.end('Blocked media target');
      return;
    }
    res.statusCode = 502;
    res.end('Media proxy error');
  }
}
