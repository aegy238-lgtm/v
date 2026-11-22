import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { detectMediaKind, isLikelyVapUrl, normalizeMediaUrl } from '../utils/mediaFormats';
import {
  createFreshMediaBlobUrl,
  getCachedApngInfo,
  getCachedResolvedMediaKind,
  getWarmMediaUrl,
  inspectApngUrl,
  probeAndWarmMediaUrl,
} from '../utils/apngEngine';
import {
  detectVideoLayoutFromFrame,
  getCachedVapConfig,
  getMediaProxyUrl,
  inspectVapUrl,
  VapConfig,
  VapWebGLRenderer,
} from '../utils/vapEngine';

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

// ============================================================================
// TRANSPARENT VAP / WHITE-CHROMA / BLACK-CHROMA WEBGL STAGE VIDEO PLAYER
// ============================================================================
interface TransparentStageVideoProps {
  rawUrl: string;
  primaryUrl: string;
  muted: boolean;
  loop: boolean;
  resetKey?: string | number;
  className?: string;
  onReady: () => void;
  onEnded: () => void;
  onFatalError: () => void;
}

const TransparentStageVideo: React.FC<TransparentStageVideoProps> = ({
  rawUrl,
  primaryUrl,
  muted,
  loop,
  resetKey,
  className = '',
  onReady,
  onEnded,
  onFatalError,
}) => {
  const isExternalHttp =
    /^https?:\/\//i.test(primaryUrl) &&
    typeof window !== 'undefined' &&
    !primaryUrl.startsWith(window.location.origin);

  const shouldPreferProxyFirst =
    isExternalHttp && !primaryUrl.startsWith('blob:') && isLikelyVapUrl(rawUrl || primaryUrl);

  const initialSrc = shouldPreferProxyFirst
    ? getMediaProxyUrl(rawUrl || primaryUrl) || primaryUrl
    : primaryUrl;

  const [videoSrc, setVideoSrc] = useState<string>(initialSrc);
  const [useCrossOrigin, setUseCrossOrigin] = useState<boolean>(true);
  const [fallbackRawVideo, setFallbackRawVideo] = useState<boolean>(false);
  const [autoplayMutedFallback, setAutoplayMutedFallback] = useState<boolean>(false);
  const [canvasReady, setCanvasReady] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<VapWebGLRenderer | null>(null);
  const vapConfigRef = useRef<VapConfig | null>(getCachedVapConfig(rawUrl) ?? null);
  const triedProxyRef = useRef<boolean>(shouldPreferProxyFirst);
  const triedDirectCorsRef = useRef<boolean>(!shouldPreferProxyFirst);
  const triedNoCorsRef = useRef<boolean>(false);
  const detectAttemptsRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const prevResetKeyRef = useRef<string | number | undefined>(resetKey);
  const readyEmittedForKeyRef = useRef<string | number | undefined>(undefined);

  const onReadyRef = useRef(onReady);
  const onEndedRef = useRef(onEnded);
  const onFatalErrorRef = useRef(onFatalError);
  onReadyRef.current = onReady;
  onEndedRef.current = onEnded;
  onFatalErrorRef.current = onFatalError;

  const emitReadyOnce = () => {
    setCanvasReady(true);
    if (readyEmittedForKeyRef.current !== resetKey) {
      readyEmittedForKeyRef.current = resetKey;
      onReadyRef.current();
    }
  };

  // Reset source & inspect Tencent VAP `vapc` box whenever URL changes
  useEffect(() => {
    let cancelled = false;
    const preferProxy =
      isExternalHttp && !primaryUrl.startsWith('blob:') && isLikelyVapUrl(rawUrl || primaryUrl);
    const nextSrc = preferProxy ? getMediaProxyUrl(rawUrl || primaryUrl) || primaryUrl : primaryUrl;
    triedProxyRef.current = preferProxy;
    triedDirectCorsRef.current = !preferProxy;
    triedNoCorsRef.current = false;
    detectAttemptsRef.current = 0;
    readyEmittedForKeyRef.current = undefined;
    vapConfigRef.current = getCachedVapConfig(rawUrl) ?? null;
    setVideoSrc(nextSrc);
    setUseCrossOrigin(true);
    setFallbackRawVideo(false);
    setAutoplayMutedFallback(false);
    setCanvasReady(false);

    if (rawUrl && vapConfigRef.current === null) {
      void inspectVapUrl(rawUrl).then((cfg) => {
        if (!cancelled && cfg) {
          vapConfigRef.current = cfg;
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [rawUrl, primaryUrl, isExternalHttp]);

  // Initialize WebGL renderer on canvas mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallbackRawVideo) return;
    const renderer = new VapWebGLRenderer(canvas);
    if (!renderer.isWebGLReady()) {
      renderer.destroy();
      setFallbackRawVideo(true);
      return;
    }
    rendererRef.current = renderer;

    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, [fallbackRawVideo]);

  const trySwitchToProxyForCors = (): boolean => {
    if (!triedProxyRef.current && isExternalHttp) {
      triedProxyRef.current = true;
      const proxied = getMediaProxyUrl(rawUrl || primaryUrl);
      if (proxied && proxied !== videoSrc) {
        detectAttemptsRef.current = 0;
        setUseCrossOrigin(true);
        setVideoSrc(proxied);
        return true;
      }
    }
    if (!triedDirectCorsRef.current && primaryUrl && primaryUrl !== videoSrc) {
      triedDirectCorsRef.current = true;
      detectAttemptsRef.current = 0;
      setUseCrossOrigin(true);
      setVideoSrc(primaryUrl);
      return true;
    }
    if (!triedNoCorsRef.current) {
      triedNoCorsRef.current = true;
      setUseCrossOrigin(false);
      setFallbackRawVideo(true);
      setVideoSrc(primaryUrl);
      return true;
    }
    return false;
  };

  // 60fps WebGL render loop with automatic VAP / White-Chroma / Black-Chroma detection
  useEffect(() => {
    if (fallbackRawVideo) return;
    let active = true;

    const buildFallbackConfig = (vid: HTMLVideoElement): VapConfig => {
      const vw = vid.videoWidth || 640;
      const vh = vid.videoHeight || 640;
      if (isLikelyVapUrl(rawUrl) && vw / vh >= 1.45) {
        return {
          mode: 'vap_rl',
          width: Math.floor(vw / 2),
          height: vh,
          videoWidth: vw,
          videoHeight: vh,
          alphaFrame: { x: 0, y: 0, w: Math.floor(vw / 2), h: vh },
          rgbFrame: { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh },
          source: 'url_hint',
        };
      }
      return {
        mode: 'chroma_black',
        width: vw,
        height: vh,
        videoWidth: vw,
        videoHeight: vh,
        rgbFrame: { x: 0, y: 0, w: vw, h: vh },
        alphaFrame: { x: 0, y: 0, w: vw, h: vh },
        source: 'pixel_heuristic',
      };
    };

    const tick = () => {
      if (!active) return;
      const vid = videoRef.current;
      const renderer = rendererRef.current;

      if (vid && renderer && vid.readyState >= 2 && vid.videoWidth > 0 && vid.videoHeight > 0) {
        let cfg = vapConfigRef.current;

        // If no `vapc` box yet, run live pixel heuristic across the first ~60 frames (~2s)
        // so videos with dark/blank fade-in frames still accurately lock onto VAP split-alpha or white-background removal
        if (
          !cfg ||
          (cfg.source === 'pixel_heuristic' &&
            detectAttemptsRef.current < 60 &&
            (cfg.mode === 'chroma_black' || cfg.mode === 'passthrough'))
        ) {
          detectAttemptsRef.current += 1;
          const detected = detectVideoLayoutFromFrame(vid, isLikelyVapUrl(rawUrl));
          if (detected) {
            cfg = detected;
            vapConfigRef.current = detected;
          } else if (!cfg) {
            cfg = buildFallbackConfig(vid);
          }
        }

        const rendered = renderer.renderFrame(vid, cfg);
        if (!rendered) {
          // CORS-tainted video element -> transparently retry via /api/media-proxy
          if (trySwitchToProxyForCors()) {
            return;
          }
        } else {
          emitReadyOnce();
        }
      }

      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    rafIdRef.current = window.requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [fallbackRawVideo, videoSrc, rawUrl, resetKey]);

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
        if (fallbackRawVideo && vid.readyState >= 2 && !vid.paused) {
          emitReadyOnce();
        }
      }).catch(() => {
        if (!vid.muted) {
          vid.muted = true;
          setAutoplayMutedFallback(true);
          vid
            .play()
            .then(() => {
              if (fallbackRawVideo && vid.readyState >= 2 && !vid.paused) {
                emitReadyOnce();
              }
            })
            .catch(() => {});
        }
      });
    }
  };

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    ensureVideoPlay(true);
    if (canvasReady) {
      emitReadyOnce();
    }
  }, [resetKey, canvasReady]);

  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none overflow-hidden flex items-center justify-center ${className}`}
    >
      {/* Hidden or fallback source video element */}
      <video
        ref={videoRef}
        key={`${videoSrc}_${useCrossOrigin ? 'cors' : 'nocors'}`}
        src={videoSrc}
        crossOrigin={useCrossOrigin ? 'anonymous' : undefined}
        autoPlay
        playsInline
        loop={loop}
        preload="auto"
        muted={muted || autoplayMutedFallback}
        onLoadedData={() => ensureVideoPlay(false)}
        onCanPlay={() => ensureVideoPlay(false)}
        onCanPlayThrough={() => ensureVideoPlay(false)}
        onPlaying={() => {
          if (fallbackRawVideo) emitReadyOnce();
        }}
        onEnded={() => {
          if (!loop) {
            setCanvasReady(false);
            onEndedRef.current();
          }
        }}
        onError={() => {
          if (trySwitchToProxyForCors()) return;
          onFatalErrorRef.current();
        }}
        style={{
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
        className={
          fallbackRawVideo
            ? `w-full h-full object-cover object-center mix-blend-screen brightness-[1.06] contrast-[1.12] ${
                canvasReady ? 'opacity-100' : 'opacity-0'
              }`
            : 'absolute w-px h-px opacity-0 pointer-events-none'
        }
      />

      {/* Hardware-accelerated Transparent VAP / Chroma-Keyed Canvas — Full Room Dimensions */}
      {!fallbackRawVideo && (
        <canvas
          ref={canvasRef}
          style={{
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
          }}
          className={`w-full h-full object-cover object-center transition-opacity duration-150 ${
            canvasReady ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
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
  const [imgReplayNonce, setImgReplayNonce] = useState<number>(0);

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

  const targetImageDurationMs =
    !hasExplicitDuration && apngAutoDurationMs
      ? apngAutoDurationMs
      : Math.max(1000, durationMs);

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

  // Video stall guard
  useEffect(() => {
    if (loop || renderAs !== 'video' || !activeUrl || ready) return;
    const stallMs = detectMediaKind(cleanPrimary) === 'unknown' ? 2800 : 12000;
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
    }
  }, [renderAs, activeUrl, ready, imgReplayNonce]);

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;

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
      <TransparentStageVideo
        rawUrl={cleanPrimary}
        primaryUrl={activeUrl}
        muted={muted}
        loop={loop}
        resetKey={resetKey}
        className={className}
        onReady={signalReadyOnce}
        onEnded={() => {
          setReady(false);
          onEndedRef.current?.();
        }}
        onFatalError={() => {
          triedVideoFallbackRef.current = true;
          setReady(false);
          setRenderAs('image');
          void inspectApngUrl(cleanPrimary || activeUrl).then((info) => {
            if (info?.isApng) {
              setApngAutoDurationMs(info.totalDurationMs + 150);
            }
          });
        }}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 z-40 pointer-events-none overflow-hidden flex items-center justify-center ${className}`}
    >
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
        className={`relative w-full h-full object-cover object-center drop-shadow-[0_18px_44px_rgba(0,0,0,0.6)] ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
