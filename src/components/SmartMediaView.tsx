import React, { useEffect, useRef, useState } from 'react';
import { detectMediaKind, normalizeMediaUrl } from '../utils/mediaFormats';

interface SmartMediaStageProps {
  mode: 'stage';
  url: string;
  fallbackUrl?: string;
  preferVideo?: boolean;
  alt?: string;
  muted?: boolean;
  loop?: boolean;
  durationMs?: number;
  resetKey?: string | number;
  onReady?: () => void;
  onEnded?: () => void;
  className?: string;
}

interface SmartMediaThumbnailProps {
  mode: 'thumbnail';
  url?: string;
  preferVideo?: boolean;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
}

export type SmartMediaViewProps = SmartMediaStageProps | SmartMediaThumbnailProps;

function computeInitialKind(url: string, preferVideo?: boolean): 'video' | 'image' {
  const kind = detectMediaKind(url);
  if (kind === 'video') return 'video';
  if (kind === 'animated_image' || kind === 'image') return 'image';
  return preferVideo ? 'video' : 'image';
}

export const SmartMediaView: React.FC<SmartMediaViewProps> = (props) => {
  if (props.mode === 'thumbnail') {
    return <SmartMediaThumbnail {...props} />;
  }
  return <SmartMediaStage {...props} />;
};

const SmartMediaThumbnail: React.FC<SmartMediaThumbnailProps> = ({
  url,
  preferVideo,
  alt = '',
  className = 'w-12 h-12 rounded-xl object-cover',
  fallback = null,
}) => {
  const cleanUrl = normalizeMediaUrl(url);
  const [renderAs, setRenderAs] = useState<'video' | 'image' | 'failed'>(() =>
    cleanUrl ? computeInitialKind(cleanUrl, preferVideo) : 'failed'
  );

  useEffect(() => {
    if (!cleanUrl) {
      setRenderAs('failed');
      return;
    }
    setRenderAs(computeInitialKind(cleanUrl, preferVideo));
  }, [cleanUrl, preferVideo]);

  if (!cleanUrl || renderAs === 'failed') {
    return <>{fallback}</>;
  }

  if (renderAs === 'video') {
    return (
      <video
        key={cleanUrl}
        src={cleanUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        onError={() => setRenderAs('image')}
        className={className}
      />
    );
  }

  return (
    <img
      key={cleanUrl}
      src={cleanUrl}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setRenderAs('failed')}
      className={className}
    />
  );
};

const SmartMediaStage: React.FC<SmartMediaStageProps> = ({
  url,
  fallbackUrl,
  preferVideo = false,
  alt = '',
  muted = false,
  loop = false,
  durationMs = 5000,
  resetKey,
  onReady,
  onEnded,
  className = '',
}) => {
  const cleanPrimary = normalizeMediaUrl(url);
  const cleanFallback = normalizeMediaUrl(fallbackUrl);

  const [activeUrl, setActiveUrl] = useState<string>(cleanPrimary);
  const [renderAs, setRenderAs] = useState<'video' | 'image'>(() =>
    computeInitialKind(cleanPrimary, preferVideo)
  );
  const [ready, setReady] = useState<boolean>(false);

  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;

  // Reset when primary URL changes
  useEffect(() => {
    setActiveUrl(cleanPrimary);
    setRenderAs(computeInitialKind(cleanPrimary, preferVideo));
    setReady(false);
  }, [cleanPrimary, preferVideo]);

  // Schedule auto-dismiss timer for GIF / WebP / PNG / static images (and refresh on combo resetKey)
  useEffect(() => {
    if (loop || renderAs !== 'image' || !activeUrl) return;
    const ms = Math.max(1000, durationMs);
    const timer = window.setTimeout(() => {
      onEndedRef.current?.();
    }, ms);
    return () => window.clearTimeout(timer);
  }, [renderAs, activeUrl, durationMs, loop, resetKey]);

  if (!activeUrl) return null;

  if (renderAs === 'video') {
    return (
      <div className={`absolute inset-0 z-40 pointer-events-none overflow-hidden ${className}`}>
        <video
          key={activeUrl}
          src={activeUrl}
          autoPlay
          playsInline
          loop={loop}
          preload="auto"
          muted={muted}
          onCanPlay={() => {
            setReady(true);
            onReadyRef.current?.();
          }}
          onEnded={() => {
            if (!loop) {
              setReady(false);
              onEndedRef.current?.();
            }
          }}
          onError={() => {
            // Automatic fallback: an extensionless URL might actually be GIF/WebP/PNG
            setReady(false);
            setRenderAs('image');
          }}
          style={{
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
          className={`w-full h-full object-cover mix-blend-screen brightness-[1.06] contrast-[1.12] transition-opacity duration-200 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none overflow-hidden flex items-center justify-center ${className}`}
    >
      {/* Subtle radial stage glow for transparent PNG / GIF / WebP gifts & entrances */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_70%)] transition-opacity duration-300"
        style={{ opacity: ready ? 1 : 0 }}
      />
      <img
        key={activeUrl}
        src={activeUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => {
          setReady(true);
          onReadyRef.current?.();
        }}
        onError={() => {
          if (cleanFallback && activeUrl !== cleanFallback) {
            setReady(false);
            setActiveUrl(cleanFallback);
            setRenderAs(computeInitialKind(cleanFallback, false));
          } else {
            onEndedRef.current?.();
          }
        }}
        style={{
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
        className={`relative w-full h-full object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.6)] transition-all duration-300 ${
          ready ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      />
    </div>
  );
};
