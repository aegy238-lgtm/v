// ============================================================================
// TENCENT VAP (Video Animation Player) & TRANSPARENT VIDEO ENGINE
// Supports:
// 1. Native Tencent VAP MP4 (`vapc` JSON box with exact rgbFrame & aFrame rects)
// 2. Side-by-side / Top-bottom split-alpha MP4s (auto-detected even without `vapc`)
// 3. White-screen ("البرومة البيضاء") & Black-screen smooth chroma-key removal
// 4. Hardware-accelerated 60fps WebGL Shader + Canvas2D fallback
// ============================================================================

export type VideoAlphaMode =
  | 'vap_box'       // Exact coordinates from MP4 `vapc` box
  | 'vap_lr'        // Left = RGB, Right = Alpha mask
  | 'vap_rl'        // Left = Alpha mask, Right = RGB (common Tencent VAP layout)
  | 'vap_tb'        // Top = RGB, Bottom = Alpha mask
  | 'vap_bt'        // Top = Alpha mask, Bottom = RGB
  | 'chroma_white'  // Single-channel video with white background removal
  | 'chroma_black'  // Single-channel video with black background removal
  | 'passthrough';  // Normal/WebM native alpha video

export interface VapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VapConfig {
  mode: VideoAlphaMode;
  width: number;       // Output transparent canvas width
  height: number;      // Output transparent canvas height
  videoWidth: number;  // Encoded MP4 width
  videoHeight: number; // Encoded MP4 height
  rgbFrame: VapRect;
  alphaFrame: VapRect;
  fps?: number;
  source: 'vapc_box' | 'pixel_heuristic' | 'url_hint';
}

const vapCache = new Map<string, VapConfig | null>();
const vapInFlight = new Map<string, Promise<VapConfig | null>>();

export function getMediaProxyUrl(rawUrl: string): string {
  const clean = rawUrl.trim();
  if (!clean) return '';
  if (clean.startsWith('/') || clean.startsWith('blob:') || clean.startsWith('data:')) {
    return clean;
  }
  if (typeof window !== 'undefined' && clean.startsWith(window.location.origin)) {
    return clean;
  }
  return `/api/media-proxy?url=${encodeURIComponent(clean)}`;
}

export function getCachedVapConfig(url?: string | null): VapConfig | null | undefined {
  if (!url) return undefined;
  return vapCache.get(url.trim());
}

/**
 * Scans an MP4 byte buffer for the Tencent VAP `vapc` ISO-BMFF box and parses its JSON payload.
 * Format: [4-byte big-endian size]['v','a','p','c'][UTF-8 JSON]
 */
export function parseVapcBoxFromBuffer(bytes: Uint8Array): VapConfig | null {
  if (!bytes || bytes.length < 16) return null;

  // Locate ASCII 'vapc' (0x76, 0x61, 0x70, 0x63)
  for (let i = 4; i < bytes.length - 8; i++) {
    if (
      bytes[i] === 0x76 &&
      bytes[i + 1] === 0x61 &&
      bytes[i + 2] === 0x70 &&
      bytes[i + 3] === 0x63
    ) {
      const boxSize =
        ((bytes[i - 4] << 24) >>> 0) +
        ((bytes[i - 3] << 16) >>> 0) +
        ((bytes[i - 2] << 8) >>> 0) +
        (bytes[i - 1] >>> 0);

      const jsonStart = i + 4;
      const jsonEnd =
        boxSize >= 12 && jsonStart + (boxSize - 8) <= bytes.length
          ? jsonStart + (boxSize - 8)
          : Math.min(bytes.length, jsonStart + 65536);

      try {
        const slice = bytes.subarray(jsonStart, jsonEnd);
        const rawText = new TextDecoder('utf-8', { fatal: false }).decode(slice);
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace <= firstBrace) continue;

        const parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as {
          info?: {
            w?: number;
            h?: number;
            videoW?: number;
            videoH?: number;
            fps?: number;
            aFrame?: [number, number, number, number];
            rgbFrame?: [number, number, number, number];
          };
        };

        const info = parsed?.info;
        if (
          info &&
          typeof info.w === 'number' &&
          typeof info.h === 'number' &&
          typeof info.videoW === 'number' &&
          typeof info.videoH === 'number' &&
          Array.isArray(info.aFrame) &&
          info.aFrame.length === 4 &&
          Array.isArray(info.rgbFrame) &&
          info.rgbFrame.length === 4 &&
          info.videoW > 0 &&
          info.videoH > 0
        ) {
          return {
            mode: 'vap_box',
            width: info.w,
            height: info.h,
            videoWidth: info.videoW,
            videoHeight: info.videoH,
            rgbFrame: {
              x: info.rgbFrame[0],
              y: info.rgbFrame[1],
              w: info.rgbFrame[2],
              h: info.rgbFrame[3],
            },
            alphaFrame: {
              x: info.aFrame[0],
              y: info.aFrame[1],
              w: info.aFrame[2],
              h: info.aFrame[3],
            },
            fps: info.fps,
            source: 'vapc_box',
          };
        }
      } catch {
        // Keep searching if false-positive 'vapc' bytes appeared inside compressed stream
      }
    }
  }
  return null;
}

async function fetchRangeBytes(url: string, rangeHeader?: string): Promise<Uint8Array | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
      signal: controller.signal,
    });
    window.clearTimeout(timer);
    if (!res.ok && res.status !== 206) return null;
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

/**
 * Inspects an MP4/VAP URL for a `vapc` box (checks head & tail ranges, using proxy fallback on CORS).
 */
export async function inspectVapUrl(rawUrl: string): Promise<VapConfig | null> {
  const url = rawUrl.trim();
  if (!url) return null;
  if (vapCache.has(url)) return vapCache.get(url) ?? null;

  const existing = vapInFlight.get(url);
  if (existing) return existing;

  const task = (async (): Promise<VapConfig | null> => {
    const candidates = [url];
    const proxied = getMediaProxyUrl(url);
    if (proxied && proxied !== url) {
      candidates.push(proxied);
    }

    for (const targetUrl of candidates) {
      // 1. Check first 128KB (where `ftyp` + `vapc` or fast-start `moov` lives)
      const headBytes = await fetchRangeBytes(targetUrl, 'bytes=0-131071');
      if (headBytes) {
        const foundHead = parseVapcBoxFromBuffer(headBytes);
        if (foundHead) {
          vapCache.set(url, foundHead);
          return foundHead;
        }
        // 2. Check last 128KB (many Tencent VAP encoders append `vapc` after `mdat`)
        const tailBytes = await fetchRangeBytes(targetUrl, 'bytes=-131072');
        if (tailBytes) {
          const foundTail = parseVapcBoxFromBuffer(tailBytes);
          if (foundTail) {
            vapCache.set(url, foundTail);
            return foundTail;
          }
        }
        // Successfully fetched & verified no vapc box
        vapCache.set(url, null);
        return null;
      }
    }

    vapCache.set(url, null);
    return null;
  })();

  vapInFlight.set(url, task);
  try {
    return await task;
  } finally {
    vapInFlight.delete(url);
  }
}

/**
 * Analyzes a live decoded video frame on a small offscreen canvas to automatically detect:
 * - Split-alpha VAP MP4 (Left/Right or Top/Bottom where one half is grayscale alpha mask & other is RGB)
 * - White background ("البرومة البيضاء") MP4 needing smooth white chroma removal
 * - Black background MP4 needing smooth luma-alpha removal
 */
export function detectVideoLayoutFromFrame(
  video: HTMLVideoElement,
  urlHintIsVap = false
): VapConfig | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;

  const sampleW = 160;
  const sampleH = 90;
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(video, 0, 0, sampleW, sampleH);
    const img = ctx.getImageData(0, 0, sampleW, sampleH).data;

    interface RegionStats {
      total: number;
      grayscaleRatio: number;
      vividColorRatio: number;
      brightWhiteRatio: number;
      nearBlackRatio: number;
      midGrayRatio: number;
    }

    const measureRegion = (x0: number, y0: number, x1: number, y1: number): RegionStats => {
      let total = 0;
      let grayscale = 0;
      let vivid = 0;
      let white = 0;
      let black = 0;
      let mid = 0;

      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const idx = (y * sampleW + x) * 4;
          const r = img[idx];
          const g = img[idx + 1];
          const b = img[idx + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const chroma = maxC - minC;
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          total++;
          if (chroma <= 10) grayscale++;
          if (chroma >= 26) vivid++;
          if (luma >= 232 && chroma <= 16) white++;
          if (luma <= 18) black++;
          if (luma > 35 && luma < 220) mid++;
        }
      }

      return {
        total: total || 1,
        grayscaleRatio: grayscale / (total || 1),
        vividColorRatio: vivid / (total || 1),
        brightWhiteRatio: white / (total || 1),
        nearBlackRatio: black / (total || 1),
        midGrayRatio: mid / (total || 1),
      };
    };

    const halfW = Math.floor(sampleW / 2);
    const halfH = Math.floor(sampleH / 2);

    const left = measureRegion(0, 0, halfW, sampleH);
    const right = measureRegion(halfW, 0, sampleW, sampleH);

    // Check horizontal split VAP (Left vs Right)
    // An alpha channel half is almost all grayscale (>= 90%) while the RGB half has colored pixels
    const leftLooksAlpha =
      left.grayscaleRatio >= 0.9 &&
      right.vividColorRatio >= 0.015 &&
      right.grayscaleRatio < left.grayscaleRatio - 0.03;
    const rightLooksAlpha =
      right.grayscaleRatio >= 0.9 &&
      left.vividColorRatio >= 0.015 &&
      left.grayscaleRatio < right.grayscaleRatio - 0.03;

    if (leftLooksAlpha) {
      return {
        mode: 'vap_rl',
        width: Math.floor(vw / 2),
        height: vh,
        videoWidth: vw,
        videoHeight: vh,
        alphaFrame: { x: 0, y: 0, w: Math.floor(vw / 2), h: vh },
        rgbFrame: { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh },
        source: 'pixel_heuristic',
      };
    }

    if (rightLooksAlpha) {
      return {
        mode: 'vap_lr',
        width: Math.floor(vw / 2),
        height: vh,
        videoWidth: vw,
        videoHeight: vh,
        rgbFrame: { x: 0, y: 0, w: Math.floor(vw / 2), h: vh },
        alphaFrame: { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh },
        source: 'pixel_heuristic',
      };
    }

    // Check vertical split VAP (Top vs Bottom)
    const top = measureRegion(0, 0, sampleW, halfH);
    const bottom = measureRegion(0, halfH, sampleW, sampleH);
    const topLooksAlpha =
      top.grayscaleRatio >= 0.9 &&
      bottom.vividColorRatio >= 0.015 &&
      bottom.grayscaleRatio < top.grayscaleRatio - 0.03;
    const bottomLooksAlpha =
      bottom.grayscaleRatio >= 0.9 &&
      top.vividColorRatio >= 0.015 &&
      top.grayscaleRatio < bottom.grayscaleRatio - 0.03;

    if (topLooksAlpha) {
      return {
        mode: 'vap_bt',
        width: vw,
        height: Math.floor(vh / 2),
        videoWidth: vw,
        videoHeight: vh,
        alphaFrame: { x: 0, y: 0, w: vw, h: Math.floor(vh / 2) },
        rgbFrame: { x: 0, y: Math.floor(vh / 2), w: vw, h: Math.floor(vh / 2) },
        source: 'pixel_heuristic',
      };
    }

    if (bottomLooksAlpha) {
      return {
        mode: 'vap_tb',
        width: vw,
        height: Math.floor(vh / 2),
        videoWidth: vw,
        videoHeight: vh,
        rgbFrame: { x: 0, y: 0, w: vw, h: Math.floor(vh / 2) },
        alphaFrame: { x: 0, y: Math.floor(vh / 2), w: vw, h: Math.floor(vh / 2) },
        source: 'pixel_heuristic',
      };
    }

    // If the URL explicitly says .vap and aspect ratio is wide (>= 1.4), assume standard Left-RGB/Right-Alpha or Left-Alpha/Right-RGB
    if (urlHintIsVap && vw / vh >= 1.4) {
      const pickRightAlpha = right.grayscaleRatio >= left.grayscaleRatio;
      return {
        mode: pickRightAlpha ? 'vap_lr' : 'vap_rl',
        width: Math.floor(vw / 2),
        height: vh,
        videoWidth: vw,
        videoHeight: vh,
        rgbFrame: pickRightAlpha
          ? { x: 0, y: 0, w: Math.floor(vw / 2), h: vh }
          : { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh },
        alphaFrame: pickRightAlpha
          ? { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh }
          : { x: 0, y: 0, w: Math.floor(vw / 2), h: vh },
        source: 'url_hint',
      };
    }

    // Check border pixels + corners for White-Screen ("البرومة البيضاء") vs Black-Screen!
    const borderCoords: [number, number][] = [];
    for (let x = 2; x < sampleW - 2; x += 5) {
      borderCoords.push([x, 2], [x, sampleH - 3]);
    }
    for (let y = 2; y < sampleH - 2; y += 5) {
      borderCoords.push([2, y], [sampleW - 3, y]);
    }

    let whiteBorder = 0;
    let blackBorder = 0;
    for (const [bx, by] of borderCoords) {
      const idx = (by * sampleW + bx) * 4;
      const r = img[idx];
      const g = img[idx + 1];
      const b = img[idx + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      // Generous threshold so compressed MP4 off-white (#d8d8d8..#ffffff) is caught reliably
      if (luma >= 210 && chroma <= 28) whiteBorder++;
      if (luma <= 26 && chroma <= 22) blackBorder++;
    }

    const totalBorder = borderCoords.length || 1;
    if (whiteBorder / totalBorder >= 0.48) {
      return {
        mode: 'chroma_white',
        width: vw,
        height: vh,
        videoWidth: vw,
        videoHeight: vh,
        rgbFrame: { x: 0, y: 0, w: vw, h: vh },
        alphaFrame: { x: 0, y: 0, w: vw, h: vh },
        source: 'pixel_heuristic',
      };
    }

    if (blackBorder / totalBorder >= 0.55) {
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
    }

    return null;
  } catch {
    // Tainted canvas (CORS blocked) — caller should retry via /api/media-proxy
    return null;
  }
}

export function buildExplicitVapConfig(
  video: HTMLVideoElement,
  mode: 'vap_lr' | 'vap_rl' | 'chroma_white' | 'chroma_black' | 'passthrough'
): VapConfig {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 640;
  if (mode === 'vap_lr') {
    return {
      mode: 'vap_lr',
      width: Math.floor(vw / 2),
      height: vh,
      videoWidth: vw,
      videoHeight: vh,
      rgbFrame: { x: 0, y: 0, w: Math.floor(vw / 2), h: vh },
      alphaFrame: { x: Math.floor(vw / 2), y: 0, w: Math.floor(vw / 2), h: vh },
      source: 'url_hint',
    };
  }
  if (mode === 'vap_rl') {
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
    mode,
    width: vw,
    height: vh,
    videoWidth: vw,
    videoHeight: vh,
    rgbFrame: { x: 0, y: 0, w: vw, h: vh },
    alphaFrame: { x: 0, y: 0, w: vw, h: vh },
    source: 'url_hint',
  };
}

// ============================================================================
// HARDWARE-ACCELERATED WEBGL VAP / CHROMA TRANSPARENCY RENDERER
// ============================================================================
const VERTEX_SHADER = `
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D u_tex;
  uniform int u_mode;         // 1 = VAP Dual-Channel, 2 = White Chroma Key, 3 = Black Chroma Key, 0 = Passthrough
  uniform vec4 u_rgbRect;     // normalized (x, y, w, h)
  uniform vec4 u_alphaRect;   // normalized (x, y, w, h)
  varying vec2 v_uv;

  void main() {
    if (u_mode == 1) {
      // Exact Tencent VAP Dual-Channel Alpha Composite
      vec2 rgbUv = u_rgbRect.xy + v_uv * u_rgbRect.zw;
      vec2 alphaUv = u_alphaRect.xy + v_uv * u_alphaRect.zw;
      vec3 color = texture2D(u_tex, rgbUv).rgb;
      vec3 maskRgb = texture2D(u_tex, alphaUv).rgb;
      float alpha = dot(maskRgb, vec3(0.299, 0.587, 0.114));
      // Clean threshold to eliminate MP4 compression mosquito noise around alpha edges
      alpha = smoothstep(0.04, 0.95, alpha);
      if (alpha < 0.015) discard;
      gl_FragColor = vec4(color * alpha, alpha);
      return;
    }

    vec4 src = texture2D(u_tex, v_uv);

    if (u_mode == 2) {
      // Crisp White-Screen ("البرومة البيضاء") Removal with Anti-Halo Edge Decontamination
      vec3 c = src.rgb;
      float maxC = max(c.r, max(c.g, c.b));
      float minC = min(c.r, min(c.g, c.b));
      float sat = maxC - minC;
      float distToWhite = length(vec3(1.0) - c);
      // Key out near-white / light-gray background while preserving vivid colors & dark lines
      float whiteMask = smoothstep(0.09, 0.34, distToWhite + sat * 1.15);
      float alpha = clamp(whiteMask, 0.0, 1.0);
      if (alpha < 0.02) discard;
      // Remove residual white matte fringe on semi-transparent edges
      vec3 unmatted = clamp((c - vec3(1.0 - alpha)) / max(alpha, 0.25), 0.0, 1.0);
      vec3 cleanColor = mix(unmatted, c, smoothstep(0.35, 0.9, alpha));
      gl_FragColor = vec4(cleanColor * alpha, alpha);
      return;
    }

    if (u_mode == 3) {
      // Smooth Black-Screen Luma-Alpha Removal
      vec3 c = src.rgb;
      float peak = max(c.r, max(c.g, c.b));
      float alpha = smoothstep(0.03, 0.22, peak);
      if (alpha < 0.015) discard;
      gl_FragColor = vec4(c * alpha, alpha);
      return;
    }

    gl_FragColor = src;
  }
`;

export class VapWebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uModeLoc: WebGLUniformLocation | null = null;
  private uRgbRectLoc: WebGLUniformLocation | null = null;
  private uAlphaRectLoc: WebGLUniformLocation | null = null;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initWebGL();
  }

  public isWebGLReady(): boolean {
    return Boolean(this.gl && this.program && this.texture);
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private initWebGL() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return;
    }

    gl.useProgram(prog);

    // Full-quad geometry (pos x,y + uv u,v)
    const verts = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0,
    ]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const aUv = gl.getAttribLocation(prog, 'a_uv');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    this.gl = gl;
    this.program = prog;
    this.texture = tex;
    this.uModeLoc = gl.getUniformLocation(prog, 'u_mode');
    this.uRgbRectLoc = gl.getUniformLocation(prog, 'u_rgbRect');
    this.uAlphaRectLoc = gl.getUniformLocation(prog, 'u_alphaRect');
  }

  public renderFrame(video: HTMLVideoElement, config: VapConfig): boolean {
    if (this.destroyed || !this.gl || !this.program || !this.texture) return false;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;

    const gl = this.gl;
    const targetW = Math.max(2, Math.min(1280, Math.round(config.width || video.videoWidth)));
    const targetH = Math.max(2, Math.min(1600, Math.round(config.height || video.videoHeight)));
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      gl.viewport(0, 0, targetW, targetH);
    }

    try {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      // SecurityError on CORS-tainted video element
      return false;
    }

    const vw = config.videoWidth || video.videoWidth;
    const vh = config.videoHeight || video.videoHeight;

    let shaderMode = 0;
    if (
      config.mode === 'vap_box' ||
      config.mode === 'vap_lr' ||
      config.mode === 'vap_rl' ||
      config.mode === 'vap_tb' ||
      config.mode === 'vap_bt'
    ) {
      shaderMode = 1;
    } else if (config.mode === 'chroma_white') {
      shaderMode = 2;
    } else if (config.mode === 'chroma_black') {
      shaderMode = 3;
    }

    gl.useProgram(this.program);
    gl.uniform1i(this.uModeLoc, shaderMode);
    gl.uniform4f(
      this.uRgbRectLoc,
      config.rgbFrame.x / vw,
      config.rgbFrame.y / vh,
      config.rgbFrame.w / vw,
      config.rgbFrame.h / vh
    );
    gl.uniform4f(
      this.uAlphaRectLoc,
      config.alphaFrame.x / vw,
      config.alphaFrame.y / vh,
      config.alphaFrame.w / vw,
      config.alphaFrame.h / vh
    );

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  public destroy() {
    this.destroyed = true;
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl = null;
      this.program = null;
      this.texture = null;
    }
  }
}
