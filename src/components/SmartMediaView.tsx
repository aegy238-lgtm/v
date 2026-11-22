import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectMediaKind, normalizeMediaUrl } from '../utils/mediaFormats';
import {
  createFreshMediaBlobUrl,
  getCachedApngInfo,
  getCachedResolvedMediaKind,
  getWarmMediaUrl,
  inspectApngUrl,
  probeAndWarmMediaUrl,
} from '../utils/apngEngine';

interface SmartMediaStageProps {
  mode: 'stage';
  url: string;
  fallbackUrl?: string;
  preferVideo?: boolean;
  alt?: string;
  muted?: boolean;
  loop?: boolean;
  durationMs?: number;
  hasExplicitDuration?: boolean;
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
  const cachedKind = getCachedResolvedMediaKind(url);
  if (cachedKind) return cachedKind;
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
    let cancelled = false;
    if (!cleanUrl) {
      setRenderAs('failed');
      return;
    }
    const init = computeInitialKind(cleanUrl, preferVideo);
    setRenderAs(init);

    if (detectMediaKind(cleanUrl) === 'unknown' && !getCachedResolvedMediaKind(cleanUrl)) {
      void probeAndWarmMediaUrl(cleanUrl).then((probed) => {
        if (!cancelled && probed) {
          setRenderAs(probed);
        }
      });
    }

    return () => {
      cancelled = true;
    };
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
  durationMs = 6000,
  hasExplicitDuration = false,
  resetKey,
  onReady,
  onEnded,
  className = '',
}) => {
  const cleanPrimary = normalizeMediaUrl(url);
  const cleanFallback = normalizeMediaUrl(fallbackUrl);

  const [renderAs, setRenderAs] = useState<'video' | 'image'>(() =>
    computeInitialKind(cleanPrimary, preferVideo)
  );
  const [activeUrl, setActiveUrl] = useState<string>(cleanPrimary);
  const [apngAutoDurationMs, setApngAutoDurationMs] = useState<number | null>(() => {
    const cached = getCachedApngInfo(cleanPrimary);
    return cached?.isApng ? cached.totalDurationMs + 150 : null;
  });
  const [ready, setReady] = useState<boolean>(false);
  const [autoplayMutedFallback, setAutoplayMutedFallback] = useState<boolean>(false);
  const [imgReplayNonce, setImgReplayNonce] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const loadedAtRef = useRef<number>(0);
  const readySignaledKeyRef = useRef<string | number | undefined>(undefined);
  const triedVideoFallbackRef = useRef<boolean>(false);
  const prevResetKeyRef = useRef<string | number | undefined>(resetKey);
  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;

  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      try {
        URL.revokeObjectURL(blobUrlRef.current);
      } catch {
        // ignore revoke error
      }
      blobUrlRef.current = null;
    }
  };

  const signalReadyOnce = () => {
    setReady(true);
    if (readySignaledKeyRef.current !== resetKey) {
      readySignaledKeyRef.current = resetKey;
      onReadyRef.current?.();
    }
  };

  // Setup source synchronously before paint & swap in RAM-cached Blob URL (APNG/GIF/WebP/Video) at 0ms
  useLayoutEffect(() => {
    let cancelled = false;
    revokeBlobUrl();
    loadedAtRef.current = 0;
    readySignaledKeyRef.current = undefined;
    triedVideoFallbackRef.current = false;
    setAutoplayMutedFallback(false);
    setReady(false);

    if (!cleanPrimary) {
      setActiveUrl('');
      return;
    }

    const warmMedia = getWarmMediaUrl(cleanPrimary);
    const initialKind = warmMedia ? warmMedia.kind : computeInitialKind(cleanPrimary, preferVideo);
    setRenderAs(initialKind);

    if (warmMedia) {
      if (warmMedia.isEphemeralBlob) {
        blobUrlRef.current = warmMedia.url;
      }
      setActiveUrl(warmMedia.url);
    } else {
      setActiveUrl(cleanPrimary);
    }

    if (initialKind === 'image') {
      const cached = getCachedApngInfo(cleanPrimary);
      if (cached?.isApng) {
        setApngAutoDurationMs(cached.totalDurationMs + 150);
      } else {
        setApngAutoDurationMs(null);
        void inspectApngUrl(cleanPrimary).then((info) => {
          if (cancelled || !info?.isApng) return;
          setApngAutoDurationMs(info.totalDurationMs + 150);
        });
      }
    } else {
      setApngAutoDurationMs(null);
    }

    // If URL is extensionless & not yet probed, probe Content-Type / magic bytes immediately
    if (
      !warmMedia &&
      detectMediaKind(cleanPrimary) === 'unknown' &&
      !getCachedResolvedMediaKind(cleanPrimary)
    ) {
      void probeAndWarmMediaUrl(cleanPrimary).then((probedKind) => {
        if (cancelled || !probedKind) return;
        setRenderAs((curr) => {
          if (curr !== probedKind) {
            loadedAtRef.current = 0;
            setReady(false);
          }
          return probedKind;
        });
        const freshlyWarmed = getWarmMediaUrl(cleanPrimary);
        if (freshlyWarmed) {
          revokeBlobUrl();
          if (freshlyWarmed.isEphemeralBlob) {
            blobUrlRef.current = freshlyWarmed.url;
          }
          setActiveUrl(freshlyWarmed.url);
        }
      });
    }

    return () => {
      cancelled = true;
      revokeBlobUrl();
    };
  }, [cleanPrimary, preferVideo]);

  // Effective stage duration for image/GIF/WebP/APNG:
  // If admin didn't manually set a duration, automatically honor full parsed APNG duration!
  const targetImageDurationMs =
    !hasExplicitDuration && apngAutoDurationMs
      ? apngAutoDurationMs
      : Math.max(1000, durationMs);

  // Schedule auto-dismiss timer AFTER image/APNG finishes loading (`ready === true`)
  // so 0ms of animation time is lost to network download, and reset timer on combo `resetKey`!
  useEffect(() => {
    if (loop || renderAs !== 'image' || !activeUrl) return;

    if (!ready) {
      const stallTimer = window.setTimeout(() => {
        onEndedRef.current?.();
      }, 20000);
      return () => window.clearTimeout(stallTimer);
    }

    if (loadedAtRef.current === 0) {
      loadedAtRef.current = Date.now();
    }

    const elapsed = Date.now() - loadedAtRef.current;
    const remainingMs = Math.max(150, targetImageDurationMs - elapsed);
    const timer = window.setTimeout(() => {
      onEndedRef.current?.();
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [renderAs, activeUrl, ready, targetImageDurationMs, loop, resetKey]);

  // Video stall guard so an incompatible/extensionless stream never hangs invisible
  useEffect(() => {
    if (loop || renderAs !== 'video' || !activeUrl || ready) return;
    const stallMs = detectMediaKind(cleanPrimary) === 'unknown' ? 2200 : 12000;
    const stallTimer = window.setTimeout(() => {
      triedVideoFallbackRef.current = true;
      if (cleanFallback && activeUrl !== cleanFallback) {
        setActiveUrl(cleanFallback);
        setRenderAs(computeInitialKind(cleanFallback, false));
      } else {
        setRenderAs('image');
      }
    }, stallMs);
    return () => window.clearTimeout(stallTimer);
  }, [renderAs, activeUrl, ready, loop, cleanFallback, cleanPrimary]);

  // Handle cached <img> elements synchronously and start warm <video> immediately before paint
  useLayoutEffect(() => {
    if (!activeUrl) return;
    if (renderAs === 'image' && !ready) {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) {
        if (loadedAtRef.current === 0) {
          loadedAtRef.current = Date.now();
        }
        signalReadyOnce();
      }
      return;
    }
    if (renderAs === 'video' && !ready) {
      const vid = videoRef.current;
      if (vid && vid.readyState >= 2) {
        ensureVideoPlay(false);
      }
    }
  }, [renderAs, activeUrl, ready, imgReplayNonce]);

  // Ensure <video> starts playing reliably (falling back to muted play if browser blocks unmuted autoplay)
  const ensureVideoPlay = (restart = false) => {
    const vid = videoRef.current;
    if (!vid) return;
    if (restart) {
      try {
        vid.currentTime = 0;
      } catch {
        // ignore seek error before metadata
      }
    }
    const p = vid.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (vid.readyState >= 2 && !vid.paused) {
          signalReadyOnce();
        }
      }).catch(() => {
        if (!vid.muted) {
          vid.muted = true;
          setAutoplayMutedFallback(true);
          vid
            .play()
            .then(() => {
              if (vid.readyState >= 2 && !vid.paused) {
                signalReadyOnce();
              }
            })
            .catch(() => {});
        }
      });
    }
  };

  // Reset loaded clock & replay media from Frame 0 when combo bump updates resetKey
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;

    if (renderAs === 'video') {
      ensureVideoPlay(true);
      if (ready) {
        signalReadyOnce();
      }
      return;
    }

    if (renderAs === 'image' && cleanPrimary) {
      const freshBlob = createFreshMediaBlobUrl(cleanPrimary);
      if (freshBlob && freshBlob.kind === 'image') {
        revokeBlobUrl();
        blobUrlRef.current = freshBlob.blobUrl;
        loadedAtRef.current = Date.now();
        setActiveUrl(freshBlob.blobUrl);
        if (ready) {
          signalReadyOnce();
        }
        return;
      }

      if (ready) {
        loadedAtRef.current = Date.now();
        setImgReplayNonce((n) => n + 1);
        signalReadyOnce();
      }
    }
  }, [resetKey, ready, renderAs, cleanPrimary]);

  if (!activeUrl) return null;

  if (renderAs === 'video') {
    return (
      <div className={`absolute inset-0 z-40 pointer-events-none overflow-hidden ${className}`}>
        <video
          ref={videoRef}
          key={activeUrl}
          src={activeUrl}
          autoPlay
          playsInline
          loop={loop}
          preload="auto"
          muted={muted || autoplayMutedFallback}
          onLoadedData={() => {
            ensureVideoPlay(false);
          }}
          onCanPlay={() => {
            ensureVideoPlay(false);
          }}
          onCanPlayThrough={() => {
            ensureVideoPlay(false);
          }}
          onPlaying={() => {
            signalReadyOnce();
          }}
          onEnded={() => {
            if (!loop) {
              setReady(false);
              onEndedRef.current?.();
            }
          }}
          onError={() => {
            // Automatic fallback: extensionless URL might actually be APNG/GIF/WebP/PNG
            triedVideoFallbackRef.current = true;
            setReady(false);
            setRenderAs('image');
            void inspectApngUrl(cleanPrimary || activeUrl).then((info) => {
              if (info?.isApng) {
                setApngAutoDurationMs(info.totalDurationMs + 150);
              }
            });
          }}
          style={{
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
          className={`w-full h-full object-cover mix-blend-screen brightness-[1.06] contrast-[1.12] ${
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
      {/* Subtle radial stage glow for transparent APNG / PNG / GIF / WebP gifts & entrances */}
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.16),transparent_70%)]"
        style={{ opacity: ready ? 1 : 0 }}
      />
      <img
        ref={imgRef}
        key={`${activeUrl}_${imgReplayNonce}`}
        src={activeUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => {
          if (loadedAtRef.current === 0) {
            loadedAtRef.current = Date.now();
          }
          signalReadyOnce();
        }}
        onError={() => {
          if (!triedVideoFallbackRef.current && detectMediaKind(activeUrl) === 'unknown') {
            triedVideoFallbackRef.current = true;
            setReady(false);
            setRenderAs('video');
            return;
          }
          if (cleanFallback && activeUrl !== cleanFallback) {
            setReady(false);
            loadedAtRef.current = 0;
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
        className={`relative w-full h-full object-contain drop-shadow-[0_18px_44px_rgba(0,0,0,0.6)] ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
