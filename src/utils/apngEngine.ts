import { detectMediaKind, normalizeMediaUrl } from './mediaFormats';

export interface ApngInfo {
  isApng: boolean;
  numFrames: number;
  numPlays: number;
  cycleDurationMs: number;
  totalDurationMs: number;
  blob?: Blob;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_WARM_BLOB_BYTES = 25 * 1024 * 1024; // 25MB cap for RAM blob caching

const apngCache = new Map<string, ApngInfo | null>();
const inflightRequests = new Map<string, Promise<ApngInfo | null>>();
const preloadedStaticImages = new Set<string>();
const resolvedMediaKindCache = new Map<string, 'video' | 'image'>();
const warmMediaBlobCache = new Map<string, { blob: Blob; kind: 'video' | 'image' }>();
const stableWarmBlobUrls = new Map<string, { blobUrl: string; kind: 'video' | 'image' }>();
const inflightWarmTasks = new Map<string, Promise<'video' | 'image' | null>>();
const warmVideoElements = new Map<string, HTMLVideoElement>();

function hasPngSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

function readChunkType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3]
  );
}

/**
 * Parses PNG binary buffer for APNG acTL & fcTL chunks to determine exact natural animation duration.
 */
export function parseApngBuffer(buffer: ArrayBuffer, mimeType = 'image/png'): ApngInfo {
  const bytes = new Uint8Array(buffer);
  if (!hasPngSignature(bytes)) {
    return {
      isApng: false,
      numFrames: 1,
      numPlays: 0,
      cycleDurationMs: 0,
      totalDurationMs: 0,
    };
  }

  const view = new DataView(buffer);
  let offset = 8;
  let hasActl = false;
  let numFrames = 1;
  let numPlays = 0;
  let cycleDurationMs = 0;
  let fctlCount = 0;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const chunkType = readChunkType(bytes, offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + length + 4 > bytes.length) break;

    if (chunkType === 'acTL' && length >= 8) {
      hasActl = true;
      numFrames = Math.max(1, view.getUint32(dataOffset, false));
      numPlays = view.getUint32(dataOffset + 4, false);
    } else if (chunkType === 'fcTL' && length >= 26) {
      fctlCount += 1;
      const delayNum = view.getUint16(dataOffset + 20, false);
      const delayDen = view.getUint16(dataOffset + 22, false);
      const den = delayDen === 0 ? 100 : delayDen;
      // Standard APNG timing: 0 delay_num is treated as minimal frame step (~33ms)
      const frameMs = delayNum === 0 ? 33 : (delayNum / den) * 1000;
      cycleDurationMs += frameMs;
    } else if (chunkType === 'IEND') {
      break;
    }

    offset = dataOffset + length + 4;
  }

  const isApng = hasActl && (fctlCount > 0 || numFrames > 1);
  if (!isApng) {
    return {
      isApng: false,
      numFrames: 1,
      numPlays: 0,
      cycleDurationMs: 0,
      totalDurationMs: 0,
    };
  }

  const safeCycleMs = Math.max(500, Math.round(cycleDurationMs));
  // If APNG specifies finite repeats > 1 (e.g. 2 short loops), honor up to 60s; otherwise play 1 full cycle cleanly
  const totalDurationMs =
    numPlays > 1
      ? Math.min(60000, Math.round(safeCycleMs * numPlays))
      : safeCycleMs;

  return {
    isApng: true,
    numFrames: Math.max(numFrames, fctlCount),
    numPlays,
    cycleDurationMs: safeCycleMs,
    totalDurationMs,
    blob: new Blob([buffer], { type: mimeType || 'image/png' }),
  };
}

function decodeDataUriToBuffer(dataUri: string): { buffer: ArrayBuffer; mime: string } | null {
  try {
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx < 0) return null;
    const header = dataUri.slice(5, commaIdx);
    const payload = dataUri.slice(commaIdx + 1);
    const mime = header.split(';')[0] || 'image/png';
    if (header.includes(';base64')) {
      const binStr = atob(payload);
      const arr = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        arr[i] = binStr.charCodeAt(i);
      }
      return { buffer: arr.buffer, mime };
    }
    const decoded = decodeURIComponent(payload);
    const arr = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      arr[i] = decoded.charCodeAt(i);
    }
    return { buffer: arr.buffer, mime };
  } catch {
    return null;
  }
}

export function getCachedApngInfo(url?: string | null): ApngInfo | null {
  const clean = normalizeMediaUrl(url);
  if (!clean) return null;
  return apngCache.get(clean) ?? null;
}

export function createFreshApngBlobUrl(url?: string | null): string | null {
  const info = getCachedApngInfo(url);
  if (info?.isApng && info.blob && typeof URL !== 'undefined') {
    return URL.createObjectURL(info.blob);
  }
  return null;
}

export function getCachedResolvedMediaKind(url?: string | null): 'video' | 'image' | null {
  const clean = normalizeMediaUrl(url);
  if (!clean) return null;
  return resolvedMediaKindCache.get(clean) ?? null;
}

export function createFreshMediaBlobUrl(
  url?: string | null
): { blobUrl: string; kind: 'video' | 'image' } | null {
  const clean = normalizeMediaUrl(url);
  if (!clean || typeof URL === 'undefined') return null;

  const apngBlob = createFreshApngBlobUrl(clean);
  if (apngBlob) {
    return { blobUrl: apngBlob, kind: 'image' };
  }

  const warm = warmMediaBlobCache.get(clean);
  if (warm?.blob) {
    return { blobUrl: URL.createObjectURL(warm.blob), kind: warm.kind };
  }

  return null;
}

export function getWarmMediaUrl(
  url?: string | null
): { url: string; kind: 'video' | 'image'; isEphemeralBlob: boolean } | null {
  const clean = normalizeMediaUrl(url);
  if (!clean || typeof URL === 'undefined') return null;

  const apngInfo = getCachedApngInfo(clean);
  if (apngInfo?.isApng && apngInfo.blob) {
    return {
      url: URL.createObjectURL(apngInfo.blob),
      kind: 'image',
      isEphemeralBlob: true,
    };
  }

  const existingStable = stableWarmBlobUrls.get(clean);
  if (existingStable) {
    return {
      url: existingStable.blobUrl,
      kind: existingStable.kind,
      isEphemeralBlob: false,
    };
  }

  const warm = warmMediaBlobCache.get(clean);
  if (warm?.blob) {
    const blobUrl = URL.createObjectURL(warm.blob);
    const entry = { blobUrl, kind: warm.kind };
    stableWarmBlobUrls.set(clean, entry);
    return {
      url: blobUrl,
      kind: warm.kind,
      isEphemeralBlob: false,
    };
  }

  return null;
}

function cacheWarmVideoElement(url: string): void {
  if (typeof document === 'undefined' || warmVideoElements.has(url)) return;
  try {
    const vid = document.createElement('video');
    vid.preload = 'auto';
    vid.muted = true;
    vid.playsInline = true;
    vid.src = url;
    vid.load();
    warmVideoElements.set(url, vid);
  } catch {
    // ignore DOM preload errors
  }
}

function cacheWarmImageElement(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      preloadedStaticImages.add(url);
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(() => resolve(true));
      } else {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function detectBufferKind(buffer: ArrayBuffer, contentType: string): 'video' | 'image' | null {
  const ct = contentType.toLowerCase();
  if (ct.startsWith('video/')) return 'video';
  if (ct.startsWith('image/')) return 'image';

  const bytes = new Uint8Array(buffer.slice(0, 16));
  if (bytes.length >= 4) {
    // PNG / APNG
    if (hasPngSignature(bytes)) return 'image';
    // GIF87a / GIF89a
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image';
    // RIFF....WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes.length >= 12 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image';
    }
    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image';
    // WebM (EBML)
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return 'video';
    }
    // MP4 / MOV ('ftyp' at offset 4)
    if (
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return 'video';
    }
  }
  return null;
}

/**
 * Resolves exact media kind (even for extensionless CDN URLs) and warms the Blob in RAM
 * so throwing gifts / entrances of ANY format (MP4, WebM, APNG, GIF, WebP, PNG) starts at 0ms.
 */
export async function probeAndWarmMediaUrl(
  url?: string | null
): Promise<'video' | 'image' | null> {
  const clean = normalizeMediaUrl(url);
  if (!clean) return null;

  if (warmMediaBlobCache.has(clean)) {
    return warmMediaBlobCache.get(clean)!.kind;
  }

  const inflight = inflightWarmTasks.get(clean);
  if (inflight) return inflight;

  const detected = detectMediaKind(clean);
  const task = (async (): Promise<'video' | 'image' | null> => {
    try {
      // Handle data URI immediately
      if (clean.startsWith('data:')) {
        const kind: 'video' | 'image' = detected === 'video' ? 'video' : 'image';
        resolvedMediaKindCache.set(clean, kind);
        return kind;
      }

      // Attempt CORS fetch so we get exact Content-Type / magic bytes + RAM Blob
      try {
        const resp = await fetch(clean, { mode: 'cors', credentials: 'omit' });
        if (resp.ok) {
          const contentType = resp.headers.get('content-type') || '';
          const contentLength = Number(resp.headers.get('content-length') || '0');
          if (contentLength > MAX_WARM_BLOB_BYTES) {
            const largeKind: 'video' | 'image' =
              contentType.toLowerCase().startsWith('image/')
                ? 'image'
                : contentType.toLowerCase().startsWith('video/') || detected === 'video'
                ? 'video'
                : 'image';
            resolvedMediaKindCache.set(clean, largeKind);
            if (largeKind === 'video') cacheWarmVideoElement(clean);
            else void cacheWarmImageElement(clean);
            return largeKind;
          }

          const buffer = await resp.arrayBuffer();
          const magicKind = detectBufferKind(buffer, contentType);
          const finalKind: 'video' | 'image' =
            magicKind || (detected === 'video' ? 'video' : 'image');

          resolvedMediaKindCache.set(clean, finalKind);

          if (buffer.byteLength <= MAX_WARM_BLOB_BYTES) {
            const mime =
              contentType ||
              (finalKind === 'video' ? 'video/mp4' : 'image/png');
            const blob = new Blob([buffer], { type: mime });
            warmMediaBlobCache.set(clean, { blob, kind: finalKind });

            if (finalKind === 'image') {
              const apngInfo = parseApngBuffer(buffer, mime);
              apngCache.set(clean, apngInfo);
              if (!apngInfo.isApng && typeof URL !== 'undefined') {
                const stableUrl = URL.createObjectURL(blob);
                stableWarmBlobUrls.set(clean, { blobUrl: stableUrl, kind: 'image' });
                void cacheWarmImageElement(stableUrl);
              }
            } else if (typeof URL !== 'undefined') {
              const stableUrl = URL.createObjectURL(blob);
              stableWarmBlobUrls.set(clean, { blobUrl: stableUrl, kind: 'video' });
              cacheWarmVideoElement(stableUrl);
            }
          }
          return finalKind;
        }
      } catch {
        // CORS blocked or offline: probe cleanly via Image / Video elements below
      }

      if (detected === 'video') {
        resolvedMediaKindCache.set(clean, 'video');
        cacheWarmVideoElement(clean);
        return 'video';
      }

      if (detected === 'image' || detected === 'animated_image') {
        resolvedMediaKindCache.set(clean, 'image');
        await cacheWarmImageElement(clean);
        return 'image';
      }

      // Extensionless unknown URL with CORS blocked: test Image first (fast), otherwise warm Video
      const isImg = await cacheWarmImageElement(clean);
      if (isImg) {
        resolvedMediaKindCache.set(clean, 'image');
        return 'image';
      }

      resolvedMediaKindCache.set(clean, 'video');
      cacheWarmVideoElement(clean);
      return 'video';
    } finally {
      inflightWarmTasks.delete(clean);
    }
  })();

  inflightWarmTasks.set(clean, task);
  return task;
}

/**
 * Inspects a URL (or data URI) to detect APNG chunks & cache its Blob + exact duration.
 * Gracefully returns null if URL is video or remote host blocks CORS fetch.
 */
export async function inspectApngUrl(url?: string | null): Promise<ApngInfo | null> {
  const clean = normalizeMediaUrl(url);
  if (!clean) return null;

  if (apngCache.has(clean)) {
    return apngCache.get(clean) ?? null;
  }

  const inflight = inflightRequests.get(clean);
  if (inflight) return inflight;

  const kind = detectMediaKind(clean);
  if (kind === 'video') {
    apngCache.set(clean, null);
    return null;
  }

  // Fast skip for extensions that cannot be APNG
  const pathLower = clean.toLowerCase().split('#')[0].split('?')[0];
  if (
    pathLower.endsWith('.gif') ||
    pathLower.endsWith('.webp') ||
    pathLower.endsWith('.jpg') ||
    pathLower.endsWith('.jpeg') ||
    pathLower.endsWith('.svg')
  ) {
    apngCache.set(clean, null);
    return null;
  }

  const task = (async (): Promise<ApngInfo | null> => {
    try {
      if (clean.startsWith('data:image/')) {
        const decoded = decodeDataUriToBuffer(clean);
        if (!decoded) {
          apngCache.set(clean, null);
          return null;
        }
        const info = parseApngBuffer(decoded.buffer, decoded.mime);
        apngCache.set(clean, info);
        return info;
      }

      const resp = await fetch(clean, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) {
        apngCache.set(clean, null);
        return null;
      }
      const contentType = resp.headers.get('content-type') || 'image/png';
      const buffer = await resp.arrayBuffer();
      const magicKind = detectBufferKind(buffer, contentType);
      if (magicKind) {
        resolvedMediaKindCache.set(clean, magicKind);
      }
      if (buffer.byteLength <= MAX_WARM_BLOB_BYTES && magicKind) {
        warmMediaBlobCache.set(clean, {
          blob: new Blob([buffer], { type: contentType }),
          kind: magicKind,
        });
      }
      const info = parseApngBuffer(buffer, contentType);
      apngCache.set(clean, info);
      return info;
    } catch {
      // CORS-restricted or offline: keep null cleanly so <img> fallback handles display
      apngCache.set(clean, null);
      return null;
    } finally {
      inflightRequests.delete(clean);
    }
  })();

  inflightRequests.set(clean, task);
  return task;
}

/**
 * Warm-loads gift & entrance media assets (MP4, WebM, APNG, GIF, WebP, PNG, and extensionless URLs)
 * in the background so throwing gifts starts at 0ms.
 */
export function preloadMediaAssets(urls: Array<string | undefined | null>): void {
  if (typeof window === 'undefined') return;

  const unique = Array.from(
    new Set(urls.map((u) => normalizeMediaUrl(u)).filter(Boolean))
  );

  unique.forEach((url) => {
    const kind = detectMediaKind(url);
    if (kind === 'image' || kind === 'animated_image') {
      if (!preloadedStaticImages.has(url)) {
        preloadedStaticImages.add(url);
        void cacheWarmImageElement(url);
      }
    }
    void probeAndWarmMediaUrl(url);
  });
}
