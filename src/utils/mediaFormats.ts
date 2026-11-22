export type DetectedMediaKind = 'video' | 'animated_image' | 'image' | 'unknown';

const VIDEO_EXTS = ['mp4', 'vap', 'webm', 'mov', 'm4v', 'ogv', 'mkv'];
const ANIMATED_IMG_EXTS = ['gif', 'webp', 'apng'];
const STATIC_IMG_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'avif', 'bmp', 'ico'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'weba'];

export function isLikelyVapUrl(url?: string | null): boolean {
  const clean = normalizeMediaUrl(url).toLowerCase();
  if (!clean) return false;
  const pathPart = clean.split('#')[0].split('?')[0];
  if (pathPart.endsWith('.vap')) return true;
  if (/[/_.-]vap[/_.-]|[?&]vap=1|[?&]format=vap|[?&]type=vap/.test(clean)) return true;
  return false;
}

export function normalizeMediaUrl(url?: string | null): string {
  if (!url) return '';
  return url.trim();
}

export function detectMediaKind(url?: string | null): DetectedMediaKind {
  const clean = normalizeMediaUrl(url);
  if (!clean) return 'unknown';

  const lower = clean.toLowerCase();

  // Check data URIs first
  if (lower.startsWith('data:')) {
    if (lower.startsWith('data:video/')) return 'video';
    if (
      lower.startsWith('data:image/gif') ||
      lower.startsWith('data:image/webp') ||
      lower.startsWith('data:image/apng')
    ) {
      return 'animated_image';
    }
    if (lower.startsWith('data:image/')) return 'image';
  }

  // Extract extension from pathname (ignore query & hash)
  const pathPart = lower.split('#')[0].split('?')[0];
  const lastSegment = pathPart.split('/').pop() || '';
  const dotIdx = lastSegment.lastIndexOf('.');
  if (dotIdx > 0) {
    const ext = lastSegment.slice(dotIdx + 1);
    if (VIDEO_EXTS.includes(ext)) return 'video';
    if (ANIMATED_IMG_EXTS.includes(ext)) return 'animated_image';
    if (STATIC_IMG_EXTS.includes(ext)) return 'image';
  }

  // Inspect common CDN / storage query parameter hints
  const queryPart = lower.includes('?') ? lower.split('?')[1].split('#')[0] : '';
  if (queryPart) {
    const formatMatch = queryPart.match(/(?:^|&)(?:format|fm|f|ext|type|mime|mime_type)=([^&]+)/);
    if (formatMatch) {
      const val = decodeURIComponent(formatMatch[1]);
      if (VIDEO_EXTS.some((ext) => val.includes(ext)) || val.includes('video')) {
        return 'video';
      }
      if (ANIMATED_IMG_EXTS.some((ext) => val.includes(ext))) {
        return 'animated_image';
      }
      if (STATIC_IMG_EXTS.some((ext) => val.includes(ext)) || val.includes('image')) {
        return 'image';
      }
    }
  }

  if (isLikelyVapUrl(clean)) return 'video';

  return 'unknown';
}

export function getMediaFormatLabel(url?: string | null): string {
  const clean = normalizeMediaUrl(url);
  if (!clean) return '';

  if (isLikelyVapUrl(clean)) return 'VAP';

  const lower = clean.toLowerCase();
  if (lower.startsWith('data:video/')) {
    const mime = lower.slice(11).split(';')[0].toUpperCase();
    return mime || 'VIDEO';
  }
  if (lower.startsWith('data:image/')) {
    const mime = lower.slice(11).split(';')[0].replace('+XML', '').toUpperCase();
    return mime || 'IMG';
  }

  const pathPart = lower.split('#')[0].split('?')[0];
  const lastSegment = pathPart.split('/').pop() || '';
  const dotIdx = lastSegment.lastIndexOf('.');
  if (dotIdx > 0) {
    const ext = lastSegment.slice(dotIdx + 1).toUpperCase();
    if (
      VIDEO_EXTS.includes(ext.toLowerCase()) ||
      ANIMATED_IMG_EXTS.includes(ext.toLowerCase()) ||
      STATIC_IMG_EXTS.includes(ext.toLowerCase()) ||
      AUDIO_EXTS.includes(ext.toLowerCase())
    ) {
      return ext;
    }
  }

  const kind = detectMediaKind(clean);
  if (kind === 'video') return 'VIDEO';
  if (kind === 'animated_image') return 'GIF/WEBP';
  if (kind === 'image') return 'IMG';
  return 'URL';
}

export function clampEffectDurationSec(sec?: number | null, fallbackSec = 5): number {
  if (typeof sec !== 'number' || !Number.isFinite(sec) || sec < 1) {
    return fallbackSec;
  }
  return Math.min(120, Math.round(sec));
}

export interface ResolvedGiftStageMedia {
  mediaUrl?: string;
  fallbackUrl?: string;
  preferVideo: boolean;
  durationMs: number;
  hasExplicitDuration: boolean;
}

export function resolveGiftStageMedia(gift: {
  videoUrl?: string;
  imageUrl?: string;
  effectDurationSec?: number;
}): ResolvedGiftStageMedia {
  const cleanVideo = normalizeMediaUrl(gift.videoUrl);
  const cleanImage = normalizeMediaUrl(gift.imageUrl);
  const hasExplicitDuration =
    typeof gift.effectDurationSec === 'number' &&
    Number.isFinite(gift.effectDurationSec) &&
    gift.effectDurationSec >= 1;
  const durationMs = (hasExplicitDuration ? clampEffectDurationSec(gift.effectDurationSec, 6) : 6) * 1000;

  if (cleanVideo) {
    const videoKind = detectMediaKind(cleanVideo);
    return {
      mediaUrl: cleanVideo,
      fallbackUrl: cleanImage || undefined,
      preferVideo: videoKind === 'video' || videoKind === 'unknown',
      durationMs,
      hasExplicitDuration,
    };
  }

  if (cleanImage) {
    const imgKind = detectMediaKind(cleanImage);
    return {
      mediaUrl: cleanImage,
      preferVideo: imgKind === 'video',
      durationMs,
      hasExplicitDuration,
    };
  }

  return {
    mediaUrl: undefined,
    preferVideo: false,
    durationMs,
    hasExplicitDuration,
  };
}

export interface ResolvedEntranceStageMedia {
  primaryUrl?: string;
  previewThumbUrl?: string;
  preferVideo: boolean;
  isVideoEntrance: boolean;
  durationMs: number;
  hasExplicitDuration: boolean;
}

export function resolveEntranceStageMedia(item?: {
  videoUrl?: string;
  previewUrl?: string;
  effectDurationSec?: number;
} | null): ResolvedEntranceStageMedia {
  if (!item) {
    return {
      primaryUrl: undefined,
      previewThumbUrl: undefined,
      preferVideo: false,
      isVideoEntrance: false,
      durationMs: 4500,
      hasExplicitDuration: false,
    };
  }

  const cleanVideo = normalizeMediaUrl(item.videoUrl);
  const cleanPreview = normalizeMediaUrl(item.previewUrl);
  const hasExplicitDuration =
    typeof item.effectDurationSec === 'number' &&
    Number.isFinite(item.effectDurationSec) &&
    item.effectDurationSec >= 1;

  if (cleanVideo) {
    const kind = detectMediaKind(cleanVideo);
    const isVideo = kind === 'video' || kind === 'unknown';
    return {
      primaryUrl: cleanVideo,
      previewThumbUrl: cleanPreview || undefined,
      preferVideo: isVideo,
      isVideoEntrance: isVideo,
      durationMs: (hasExplicitDuration ? clampEffectDurationSec(item.effectDurationSec, 7) : 7) * 1000,
      hasExplicitDuration,
    };
  }

  if (cleanPreview) {
    const kind = detectMediaKind(cleanPreview);
    const isVideo = kind === 'video';
    return {
      primaryUrl: cleanPreview,
      previewThumbUrl: cleanPreview,
      preferVideo: isVideo,
      isVideoEntrance: isVideo,
      durationMs: (hasExplicitDuration ? clampEffectDurationSec(item.effectDurationSec, 7) : 7) * 1000,
      hasExplicitDuration,
    };
  }

  return {
    primaryUrl: undefined,
    previewThumbUrl: undefined,
    preferVideo: false,
    isVideoEntrance: false,
    durationMs: (hasExplicitDuration ? clampEffectDurationSec(item.effectDurationSec, 5) : 4.5) * 1000,
    hasExplicitDuration,
  };
}
