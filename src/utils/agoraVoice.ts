import type {
  IAgoraRTC,
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import type { AgoraVoiceConfig } from '../types';

export const DEFAULT_AGORA_APP_ID = 'd5c272d82b094c2f86ccc75df0819dfe';
const LEGACY_PLACEHOLDER_APP_ID = '467d6372146f4670b6c37a0364fb5fdd';
const AGORA_CONFIG_STORAGE_KEY = 'auravoice_agora_config_v1';

export interface ParsedAgoraTokenInfo {
  valid: boolean;
  version: string;
  appId?: string;
  issueTs?: number;
  expireSeconds?: number;
  expiresAtIso?: string;
  isExpired?: boolean;
  serviceType?: number;
  serviceLabel?: string;
  channelName?: string;
  uid?: string;
  isRtcToken: boolean;
  error?: string;
}

export interface AgoraConnectionStatus {
  state: 'idle' | 'connecting' | 'connected' | 'error';
  appId: string;
  channel: string | null;
  remoteUsersCount: number;
  autoplayBlocked: boolean;
  micActive: boolean;
  micError: string | null;
  errorMessage: string | null;
  requiresToken?: boolean;
}

export function isValidAgoraAppId(value: string): boolean {
  return /^[a-f0-9]{32}$/i.test(value.trim());
}

function normalizeAppId(value?: string | null): string {
  const clean = (value || '').trim();
  if (!clean || !isValidAgoraAppId(clean) || clean.toLowerCase() === LEGACY_PLACEHOLDER_APP_ID) {
    return '';
  }
  return clean;
}

function readStoredAgoraConfig(): Partial<AgoraVoiceConfig> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(AGORA_CONFIG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AgoraVoiceConfig>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredAgoraConfig(cfg: AgoraVoiceConfig | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!cfg) {
      window.localStorage.removeItem(AGORA_CONFIG_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AGORA_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

async function inflateDeflateBytes(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    const copy = new Uint8Array(compressed.byteLength);
    copy.set(compressed);
    await writer.write(copy);
    await writer.close();
    const ab = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new Error('DecompressionStream unavailable');
}

export async function parseAgoraTokenInfo(rawToken: string): Promise<ParsedAgoraTokenInfo> {
  const token = rawToken.trim();
  if (!token) {
    return { valid: false, version: 'unknown', isRtcToken: false, error: 'التوكن فارغ' };
  }

  if (!token.startsWith('007')) {
    return {
      valid: false,
      version: token.slice(0, 3),
      isRtcToken: token.startsWith('006'),
      error: token.startsWith('006')
        ? 'توكن بصيغة 006 قديمة'
        : 'صيغة التوكن غير مدعومة (يجب أن يبدأ بـ 007)',
    };
  }

  try {
    const b64 = token.slice(3);
    const binStr = atob(b64);
    const compressed = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      compressed[i] = binStr.charCodeAt(i);
    }
    const buf = await inflateDeflateBytes(compressed);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const decoder = new TextDecoder();
    let off = 0;

    const readU16 = () => {
      if (off + 2 > buf.length) throw new Error('truncated');
      const v = view.getUint16(off, true);
      off += 2;
      return v;
    };
    const readU32 = () => {
      if (off + 4 > buf.length) throw new Error('truncated');
      const v = view.getUint32(off, true);
      off += 4;
      return v;
    };
    const readStr = () => {
      const len = readU16();
      if (off + len > buf.length) throw new Error('truncated');
      const s = decoder.decode(buf.subarray(off, off + len));
      off += len;
      return s;
    };

    const sigLen = readU16();
    off += sigLen;
    const appId = readStr();
    const issueTs = readU32();
    const expireSeconds = readU32();
    readU32(); // salt
    const serviceCount = readU16();

    let serviceType: number | undefined;
    let channelName: string | undefined;
    let uid: string | undefined;

    for (let i = 0; i < serviceCount; i++) {
      const sType = readU16();
      if (i === 0) serviceType = sType;
      const privCount = readU16();
      for (let j = 0; j < privCount; j++) {
        readU16();
        readU32();
      }
      if (sType === 1) {
        channelName = readStr();
        uid = readStr();
      } else if (sType === 2 || sType === 5) {
        if (off + 2 <= buf.length) {
          uid = readStr();
        }
      }
    }

    const expiresAtMs = (issueTs + expireSeconds) * 1000;
    const expiresAtIso = new Date(expiresAtMs).toISOString();
    const isExpired = Date.now() > expiresAtMs;

    const serviceLabels: Record<number, string> = {
      1: 'RTC Voice/Video Token',
      2: 'RTM Signaling Token',
      4: 'FPA Token',
      5: 'Agora Chat App Token',
      7: 'APAAS Token',
    };

    return {
      valid: isValidAgoraAppId(appId),
      version: '007',
      appId,
      issueTs,
      expireSeconds,
      expiresAtIso,
      isExpired,
      serviceType,
      serviceLabel: (serviceType !== undefined && serviceLabels[serviceType]) || `Service #${serviceType}`,
      channelName,
      uid,
      isRtcToken: serviceType === 1,
    };
  } catch (err) {
    return {
      valid: false,
      version: '007',
      isRtcToken: false,
      error: err instanceof Error ? err.message : 'تعذر فك التوكن',
    };
  }
}

export function getAgoraAppId(): string {
  const stored = readStoredAgoraConfig();
  const storedId = normalizeAppId(stored.appId);
  if (storedId) return storedId;

  const envRaw =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_APP_ID
      ? String(import.meta.env.VITE_AGORA_APP_ID).trim()
      : '';
  const envId = normalizeAppId(envRaw);
  return envId || DEFAULT_AGORA_APP_ID;
}

export function getAgoraConfig(): AgoraVoiceConfig {
  const stored = readStoredAgoraConfig();
  const envToken =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_TOKEN
      ? String(import.meta.env.VITE_AGORA_TOKEN).trim() || undefined
      : undefined;
  return {
    appId: getAgoraAppId(),
    rtcToken: stored.rtcToken?.trim() || envToken,
    note: stored.note,
    updatedAt: stored.updatedAt,
  };
}

export function formatAgoraChannelName(roomId: string): string {
  const cleaned = roomId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
  return `auravoice_${cleaned || 'main'}`;
}

export function sanitizeAgoraUid(userId: string): string {
  const cleaned = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned || 'guest_user';
}

type VolumeListener = (volumes: Record<string, number>) => void;
type NoticeListener = (message: string) => void;
type MicStatusListener = (isLiveMicActive: boolean) => void;
type ConnectionStatusListener = (status: AgoraConnectionStatus) => void;

class AgoraVoiceEngine {
  private sdk: IAgoraRTC | null = null;
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private probeAudioTrack: IMicrophoneAudioTrack | null = null;
  private probeTimer: number | null = null;

  // Lightweight local browser mic meter fallback when Agora project requires an RTC Token
  private localFallbackStream: MediaStream | null = null;
  private localFallbackAudioCtx: AudioContext | null = null;
  private localFallbackTimer: number | null = null;

  private remoteTracks = new Map<string, IRemoteAudioTrack>();
  private remoteUserIds = new Set<string>();
  private tokenRequiredCache = new Map<string, string>();

  private runtimeConfig: AgoraVoiceConfig = getAgoraConfig();
  private activeChannel: string | null = null;
  private activeRoomId: string | null = null;
  private activeRawUserId: string | null = null;
  private activeUid: string | null = null;
  private currentRole: 'audience' | 'host' = 'audience';
  private remoteMuted = false;

  private desiredOnSeat = false;
  private desiredMuted = false;

  private joinEpoch = 0;
  private opChain: Promise<void> = Promise.resolve();

  private volumeListeners = new Set<VolumeListener>();
  private noticeListeners = new Set<NoticeListener>();
  private micStatusListeners = new Set<MicStatusListener>();
  private statusListeners = new Set<ConnectionStatusListener>();

  private isLiveMicActive = false;
  private autoplayBlocked = false;
  private lastJoinFailureMsg: string | null = null;
  private status: AgoraConnectionStatus = {
    state: 'idle',
    appId: getAgoraAppId(),
    channel: null,
    remoteUsersCount: 0,
    autoplayBlocked: false,
    micActive: false,
    micError: null,
    errorMessage: null,
    requiresToken: false,
  };

  private updateStatus(patch: Partial<AgoraConnectionStatus>) {
    this.status = {
      ...this.status,
      ...patch,
      appId: this.runtimeConfig.appId || getAgoraAppId(),
      micActive: this.isLiveMicActive,
      autoplayBlocked: this.autoplayBlocked,
      remoteUsersCount: this.remoteUserIds.size,
    };
    this.statusListeners.forEach((cb) => cb({ ...this.status }));
  }

  private emitVolumes(volumes: Record<string, number>) {
    this.volumeListeners.forEach((cb) => cb(volumes));
  }

  private emitNotice(message: string) {
    this.noticeListeners.forEach((cb) => cb(message));
  }

  private setLiveMicActive(active: boolean) {
    if (this.isLiveMicActive === active) return;
    this.isLiveMicActive = active;
    this.micStatusListeners.forEach((cb) => cb(active));
    this.updateStatus({});
  }

  public getConfig(): AgoraVoiceConfig {
    return { ...this.runtimeConfig };
  }

  public setConfig(next: Partial<AgoraVoiceConfig>, persistLocal = true): AgoraVoiceConfig {
    const validNextId = normalizeAppId(next.appId);
    const cleanAppId = validNextId || this.runtimeConfig.appId || DEFAULT_AGORA_APP_ID;
    const cleanToken =
      next.rtcToken !== undefined
        ? next.rtcToken.trim() || undefined
        : this.runtimeConfig.rtcToken;

    const prevAppId = this.runtimeConfig.appId;
    const prevToken = this.runtimeConfig.rtcToken;

    this.tokenRequiredCache.clear();
    this.runtimeConfig = {
      appId: cleanAppId,
      rtcToken: cleanToken,
      note: next.note ?? this.runtimeConfig.note,
      updatedAt: next.updatedAt || new Date().toISOString(),
    };

    if (persistLocal) {
      writeStoredAgoraConfig(this.runtimeConfig);
    }

    this.updateStatus({ appId: cleanAppId, requiresToken: false });

    if (
      (prevAppId !== cleanAppId || prevToken !== cleanToken) &&
      this.activeRoomId &&
      this.activeRawUserId
    ) {
      void this.reconnectActiveRoom();
    }

    return { ...this.runtimeConfig };
  }

  public resetConfig(): AgoraVoiceConfig {
    writeStoredAgoraConfig(null);
    this.tokenRequiredCache.clear();
    this.runtimeConfig = {
      appId: getAgoraAppId(),
      rtcToken: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.updateStatus({ appId: this.runtimeConfig.appId, requiresToken: false });
    if (this.activeRoomId && this.activeRawUserId) {
      void this.reconnectActiveRoom();
    }
    return { ...this.runtimeConfig };
  }

  public subscribeVolumes(listener: VolumeListener): () => void {
    this.volumeListeners.add(listener);
    return () => {
      this.volumeListeners.delete(listener);
    };
  }

  public subscribeNotices(listener: NoticeListener): () => void {
    this.noticeListeners.add(listener);
    return () => {
      this.noticeListeners.delete(listener);
    };
  }

  public subscribeMicStatus(listener: MicStatusListener): () => void {
    this.micStatusListeners.add(listener);
    listener(this.isLiveMicActive);
    return () => {
      this.micStatusListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: ConnectionStatusListener): () => void {
    this.statusListeners.add(listener);
    listener({ ...this.status });
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private async ensureSdk(): Promise<IAgoraRTC> {
    if (this.sdk) return this.sdk;
    const mod = await import('agora-rtc-sdk-ng');
    const sdk = mod.default;
    // Level 4 (NONE) suppresses raw SDK console.error spam; all failures are caught and surfaced cleanly in UI.
    sdk.setLogLevel(4);
    sdk.onAutoplayFailed = () => {
      this.autoplayBlocked = true;
      this.updateStatus({});
      this.emitNotice('اضغط في أي مكان داخل الغرفة لتفعيل سماع الصوت المباشر.');
    };
    this.sdk = sdk;
    return sdk;
  }

  private isTokenRequirementError(err: unknown): boolean {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    const combined = `${code} ${msg}`.toLowerCase();
    return (
      combined.includes('dynamic use static key') ||
      combined.includes('dynamic_use_static_key') ||
      combined.includes('invalid_token') ||
      combined.includes('token_expired')
    );
  }

  private translateAgoraJoinError(err: unknown): string {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    const combined = `${code} ${msg}`;

    if (this.isTokenRequirementError(err)) {
      return 'مشروع Agora مفعّل عليه وضع الشهادة (Token). فعّل Testing Mode (App ID فقط) في لوحة Agora أو أضف RTC Token في لوحة الإدارة ← الصوت المباشر Agora.';
    }
    if (combined.includes('UID_CONFLICT')) {
      return 'نفس الحساب متصل حالياً من جهاز أو تبويب آخر (UID_CONFLICT). سجّل بحساب مختلف للتجربة.';
    }
    if (combined.includes('INVALID_VENDOR_KEY') || combined.includes('INVALID_PARAMS')) {
      return 'معرّف Agora App ID غير صالح (تأكد من وضع App ID وليس App Certificate).';
    }
    if (combined.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
      return 'تعذر الوصول إلى خوادم Agora (تحقق من صحة App ID أو تفعيل Testing Mode أو الشبكة).';
    }
    return `تعذر الاتصال بغرفة الصوت المباشر (${code || 'خطأ اتصال'}).`;
  }

  private async resolveJoinParams(
    appId: string,
    channel: string,
    uid: string
  ): Promise<{ token: string | null; joinUid: string | null }> {
    const manualToken = this.runtimeConfig.rtcToken?.trim();
    if (manualToken) {
      const parsed = await parseAgoraTokenInfo(manualToken);
      if (parsed.valid && parsed.isRtcToken && !parsed.isExpired) {
        if (!parsed.appId || parsed.appId.toLowerCase() === appId.toLowerCase()) {
          if (!parsed.channelName || parsed.channelName === channel) {
            const joinUid = !parsed.uid || parsed.uid === '0' ? null : parsed.uid;
            return { token: manualToken, joinUid };
          }
        }
      } else if (manualToken.startsWith('006')) {
        return { token: manualToken, joinUid: null };
      }
    }

    if (typeof fetch !== 'undefined' && typeof window !== 'undefined') {
      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 1600);
        const res = await fetch(
          `/api/agora/token?channel=${encodeURIComponent(channel)}&uid=${encodeURIComponent(uid)}`,
          { signal: controller.signal }
        );
        window.clearTimeout(timer);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = (await res.json()) as { token?: string | null };
          if (data?.token && typeof data.token === 'string') {
            return { token: data.token, joinUid: uid };
          }
        }
      } catch {
        // Static Vite / Vercel build without Express token server -> Testing Mode (null)
      }
    }

    return { token: null, joinUid: uid };
  }

  private attachClientEvents(client: IAgoraRTCClient, uidStr: string) {
    client.on('user-joined', (user: IAgoraRTCRemoteUser) => {
      this.remoteUserIds.add(String(user.uid));
      this.updateStatus({});
    });

    client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
      if (mediaType !== 'audio') return;
      try {
        await client.subscribe(user, mediaType);
        const track = user.audioTrack;
        if (track) {
          this.remoteUserIds.add(String(user.uid));
          this.remoteTracks.set(String(user.uid), track);
          track.setVolume(this.remoteMuted ? 0 : 100);
          track.play();
          this.updateStatus({});
        }
      } catch (err) {
        console.warn('[AgoraVoice] remote audio subscribe/play failed:', err);
      }
    });

    client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType) => {
      if (mediaType !== 'audio') return;
      this.remoteTracks.delete(String(user.uid));
    });

    client.on('user-left', (user: IAgoraRTCRemoteUser) => {
      const id = String(user.uid);
      this.remoteTracks.delete(id);
      this.remoteUserIds.delete(id);
      this.updateStatus({});
    });

    client.on('connection-state-change', (curState, _revState, reason) => {
      if (curState === 'DISCONNECTED' && reason === 'UID_BANNED') {
        const msg = 'تم فصل الاتصال الصوتي بسبب حظر الجلسة أو تعارض المعرف.';
        this.emitNotice(msg);
        this.updateStatus({ state: 'error', errorMessage: msg });
      } else if (curState === 'CONNECTED') {
        this.updateStatus({ state: 'connected', errorMessage: null, requiresToken: false });
      } else if (curState === 'DISCONNECTED' && reason && reason !== 'LEAVE') {
        console.warn('[AgoraVoice] disconnected:', reason);
      }
    });

    client.on('exception', (evt) => {
      console.warn('[AgoraVoice] exception:', evt);
    });

    client.on('volume-indicator', (volumes) => {
      const next: Record<string, number> = {};
      const sanitizedLocalUid = sanitizeAgoraUid(uidStr);
      volumes.forEach((item) => {
        const remoteId = String(item.uid);
        const key =
          item.uid === 0 || remoteId === uidStr || remoteId === sanitizedLocalUid
            ? uidStr
            : remoteId;
        next[key] = item.level;
      });
      this.emitVolumes(next);
    });
  }

  private async startLocalFallbackMic(uidStr: string): Promise<void> {
    this.stopLocalFallbackMic();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.localFallbackStream = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        this.localFallbackAudioCtx = ctx;
        this.localFallbackTimer = window.setInterval(() => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const level = Math.min(100, Math.round(rms * 260));
          this.emitVolumes({ [uidStr]: level });
        }, 120);
      }
      this.updateStatus({ micError: null });
      this.setLiveMicActive(true);
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        this.updateStatus({
          micError: 'يرجى السماح بصلاحية الميكروفون في المتصفح لتشغيل الصوت.',
        });
      }
      this.setLiveMicActive(false);
    }
  }

  private stopLocalFallbackMic(): void {
    if (this.localFallbackTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.localFallbackTimer);
      this.localFallbackTimer = null;
    }
    if (this.localFallbackAudioCtx) {
      this.localFallbackAudioCtx.close().catch(() => {});
      this.localFallbackAudioCtx = null;
    }
    if (this.localFallbackStream) {
      this.localFallbackStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      this.localFallbackStream = null;
    }
  }

  private async teardownLocalMic(client: IAgoraRTCClient | null): Promise<void> {
    this.stopLocalFallbackMic();
    const track = this.localAudioTrack;
    this.localAudioTrack = null;
    this.setLiveMicActive(false);

    if (track) {
      if (client && this.activeChannel) {
        try {
          await client.unpublish([track]);
        } catch {
          // Ignore if already unpublished or left
        }
      }
      try {
        track.stop();
        track.close();
      } catch {
        // Ignore cleanup errors
      }
    }

    if (client && this.activeChannel && this.currentRole !== 'audience') {
      try {
        await client.setClientRole('audience');
        this.currentRole = 'audience';
      } catch {
        // Ignore role revert errors
      }
    }
  }

  private async applyMicState(onSeat: boolean, muted: boolean, capturedEpoch: number): Promise<void> {
    if (capturedEpoch !== this.joinEpoch) return;

    // If Agora channel isn't connected yet (e.g. token required), still activate local mic meter cleanly when unmuted
    if (!this.client || !this.activeChannel) {
      if (!onSeat || muted) {
        this.stopLocalFallbackMic();
        this.setLiveMicActive(false);
        return;
      }
      if (this.status.state === 'error' && this.activeRawUserId) {
        await this.startLocalFallbackMic(this.activeRawUserId);
      }
      return;
    }

    if (!onSeat) {
      this.updateStatus({ micError: null });
      await this.teardownLocalMic(this.client);
      return;
    }

    try {
      if (this.currentRole !== 'host') {
        await this.client.setClientRole('host');
        this.currentRole = 'host';
      }
      if (capturedEpoch !== this.joinEpoch || !this.client || !this.activeChannel) return;

      if (!this.localAudioTrack) {
        if (muted) {
          this.updateStatus({ micError: null });
          this.setLiveMicActive(false);
          return;
        }
        const AgoraRTC = await this.ensureSdk();
        if (capturedEpoch !== this.joinEpoch || !this.client || !this.activeChannel) return;

        const track = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true,
          ANS: true,
          AGC: true,
        });

        if (capturedEpoch !== this.joinEpoch || !this.client || !this.activeChannel) {
          track.stop();
          track.close();
          return;
        }

        track.on('track-ended', () => {
          if (this.localAudioTrack === track) {
            this.setLiveMicActive(false);
            const msg = 'تم فصل الميكروفون من المتصفح أو النظام.';
            this.updateStatus({ micError: msg });
            this.emitNotice(msg);
          }
        });

        this.localAudioTrack = track;
        await this.client.publish([track]);
        this.updateStatus({ micError: null });
        this.setLiveMicActive(true);
      } else {
        await this.localAudioTrack.setMuted(muted);
        this.updateStatus({ micError: null });
        this.setLiveMicActive(!muted);
      }
    } catch (err: unknown) {
      console.warn('[AgoraVoice] mic/publish failed:', err);
      const errName = (err as { code?: string; name?: string })?.code || (err instanceof Error ? err.name : '');
      let msg = `تعذر تشغيل الميكروفون المباشر (${errName || 'خطأ بث'}).`;
      if (
        errName === 'PERMISSION_DENIED' ||
        errName === 'NotAllowedError' ||
        errName === 'DEVICE_NOT_FOUND' ||
        errName === 'NotFoundError'
      ) {
        msg = 'يرجى السماح بصلاحية الميكروفون أو التأكد من توصيله (افتح الرابط في نافذة مستقلة إذا كان محجوباً داخل المعاينة).';
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        msg = 'الميكروفون مستخدم من تطبيق آخر حالياً.';
      } else if (errName === 'NOT_SUPPORTED' || errName === 'SecurityError') {
        msg = 'المتصفح يمنع الميكروفون في هذا الإطار؛ افتح التطبيق في تبويب مستقل عبر HTTPS.';
      }
      this.emitNotice(msg);
      this.updateStatus({ micError: msg });
      this.setLiveMicActive(false);
    }
  }

  public joinRoom(roomId: string, userId: string): Promise<void> {
    const channel = formatAgoraChannelName(roomId);
    const uid = sanitizeAgoraUid(userId);
    const rawUserId = userId.trim() || uid;
    const myEpoch = ++this.joinEpoch;

    this.activeRoomId = roomId;
    this.activeRawUserId = rawUserId;

    this.opChain = this.opChain.then(async () => {
      if (myEpoch !== this.joinEpoch) return;
      if (this.activeChannel === channel && this.activeUid === uid && this.client) return;

      await this.internalLeave(false);
      if (myEpoch !== this.joinEpoch) return;

      const appId = normalizeAppId(this.runtimeConfig.appId) || getAgoraAppId();
      if (!appId) return;

      const { token: joinToken, joinUid } = await this.resolveJoinParams(appId, channel, uid);
      if (myEpoch !== this.joinEpoch) return;

      // Avoid repeating gateway join requests if this App ID already reported Secured Mode without a token
      const cacheKey = `${appId}:${joinToken ? 'tok' : 'notok'}`;
      const cachedNotice = this.tokenRequiredCache.get(cacheKey);
      if (cachedNotice) {
        this.lastJoinFailureMsg = cachedNotice;
        this.updateStatus({
          state: 'error',
          appId,
          channel,
          requiresToken: true,
          errorMessage: cachedNotice,
        });
        if (this.desiredOnSeat && !this.desiredMuted) {
          await this.startLocalFallbackMic(rawUserId);
        }
        return;
      }

      this.updateStatus({
        state: 'connecting',
        appId,
        channel,
        micError: null,
        errorMessage: null,
        requiresToken: false,
      });

      try {
        const AgoraRTC = await this.ensureSdk();
        if (myEpoch !== this.joinEpoch) return;

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        this.client = client;
        this.attachClientEvents(client, rawUserId);

        await client.setClientRole('audience');
        this.currentRole = 'audience';

        await client.join(appId, channel, joinToken, joinUid);
        if (myEpoch !== this.joinEpoch) {
          await client.leave().catch(() => {});
          if (this.client === client) this.client = null;
          return;
        }

        this.activeChannel = channel;
        this.activeUid = uid;
        this.lastJoinFailureMsg = null;
        this.stopLocalFallbackMic();
        client.enableAudioVolumeIndicator();
        this.updateStatus({
          state: 'connected',
          appId,
          channel,
          requiresToken: false,
          errorMessage: null,
        });

        if (this.desiredOnSeat) {
          await this.applyMicState(this.desiredOnSeat, this.desiredMuted, myEpoch);
        }
      } catch (err: unknown) {
        console.warn('[AgoraVoice] joinRoom notice:', err);
        const notice = this.translateAgoraJoinError(err);
        const requiresToken = this.isTokenRequirementError(err);
        if (requiresToken) {
          this.tokenRequiredCache.set(cacheKey, notice);
        }
        this.lastJoinFailureMsg = notice;
        this.emitNotice(notice);
        await this.internalLeave(false);
        this.updateStatus({
          state: 'error',
          channel,
          requiresToken,
          errorMessage: notice,
        });
        if (this.desiredOnSeat && !this.desiredMuted) {
          await this.startLocalFallbackMic(rawUserId);
        }
      }
    });

    return this.opChain;
  }

  public reconnectActiveRoom(): Promise<void> {
    if (!this.activeRoomId || !this.activeRawUserId) {
      return Promise.resolve();
    }
    this.tokenRequiredCache.clear();
    const roomId = this.activeRoomId;
    const userId = this.activeRawUserId;
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.internalLeave(false);
    });
    return this.joinRoom(roomId, userId);
  }

  public retryMicPublish(): Promise<void> {
    const capturedEpoch = this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      if (this.desiredOnSeat) {
        await this.applyMicState(true, this.desiredMuted, capturedEpoch);
      }
    });
    return this.opChain;
  }

  public syncMicState(onSeat: boolean, muted: boolean): Promise<void> {
    this.desiredOnSeat = onSeat;
    this.desiredMuted = muted;
    const capturedEpoch = this.joinEpoch;

    this.opChain = this.opChain.then(async () => {
      await this.applyMicState(onSeat, muted, capturedEpoch);
    });

    return this.opChain;
  }

  public setRemoteAudioMuted(muted: boolean): void {
    this.remoteMuted = muted;
    this.remoteTracks.forEach((track) => {
      try {
        track.setVolume(muted ? 0 : 100);
      } catch {
        // Ignore remote volume update errors
      }
    });
  }

  public resumeRemoteAudio(force = false): void {
    if (this.remoteMuted) return;
    if (!force && !this.autoplayBlocked) return;
    this.autoplayBlocked = false;
    this.remoteTracks.forEach((track) => {
      try {
        track.setVolume(100);
        track.play();
      } catch {
        // Ignore remote play resume errors
      }
    });
    this.updateStatus({});
  }

  public async testConnection(roomId = 'room_1', userId = 'admin_tester'): Promise<{
    ok: boolean;
    message: string;
    appId: string;
    channel: string;
    requiresToken?: boolean;
  }> {
    const appId = normalizeAppId(this.runtimeConfig.appId) || getAgoraAppId();
    const channel = formatAgoraChannelName(roomId);
    const uid = sanitizeAgoraUid(`${userId}_${Date.now() % 10000}`);

    try {
      const AgoraRTC = await this.ensureSdk();
      const testClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await testClient.setClientRole('audience');
      const { token, joinUid } = await this.resolveJoinParams(appId, channel, uid);
      await testClient.join(appId, channel, token, joinUid);
      await testClient.leave().catch(() => {});
      return {
        ok: true,
        message: `تم الاتصال بنجاح بسيرفرات Agora الصوتية (${appId}) على القناة ${channel}.`,
        appId,
        channel,
      };
    } catch (err) {
      return {
        ok: false,
        message: this.translateAgoraJoinError(err),
        appId,
        channel,
        requiresToken: this.isTokenRequirementError(err),
      };
    }
  }

  public async startMicProbe(onLevel: (level: number) => void): Promise<{ ok: boolean; message: string }> {
    this.stopMicProbe();
    try {
      const AgoraRTC = await this.ensureSdk();
      const track = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        ANS: true,
        AGC: true,
      });
      this.probeAudioTrack = track;
      this.probeTimer = window.setInterval(() => {
        if (!this.probeAudioTrack) return;
        const raw = this.probeAudioTrack.getVolumeLevel();
        onLevel(Math.min(100, Math.round(raw * 100)));
      }, 100);
      return {
        ok: true,
        message: 'الميكروفون يعمل بنجاح! تحدث الآن لمشاهدة مؤشر الصوت الحي.',
      };
    } catch (err) {
      const errName = (err as { code?: string; name?: string })?.code || (err instanceof Error ? err.name : '');
      return {
        ok: false,
        message:
          errName === 'PERMISSION_DENIED' || errName === 'NotAllowedError'
            ? 'تم رفض إذن الميكروفون في المتصفح — اسمح بالوصول للميكروفون من شريط العنوان.'
            : `تعذر الوصول للميكروفون (${errName || 'تأكد من توصيل المايك'}).`,
      };
    }
  }

  public stopMicProbe(): void {
    if (this.probeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.probeAudioTrack) {
      try {
        this.probeAudioTrack.stop();
        this.probeAudioTrack.close();
      } catch {
        // Ignore probe cleanup
      }
      this.probeAudioTrack = null;
    }
  }

  private async internalLeave(resetRoomTracking = true): Promise<void> {
    const client = this.client;
    await this.teardownLocalMic(client);

    this.remoteTracks.forEach((track) => {
      try {
        track.stop();
      } catch {
        // Ignore stop errors
      }
    });
    this.remoteTracks.clear();
    this.remoteUserIds.clear();

    if (client) {
      try {
        client.removeAllListeners();
        await client.leave();
      } catch {
        // Ignore leave errors
      }
    }

    this.client = null;
    this.activeChannel = null;
    this.activeUid = null;
    if (resetRoomTracking) {
      this.activeRoomId = null;
      this.activeRawUserId = null;
      this.desiredOnSeat = false;
      this.desiredMuted = false;
    }
    this.currentRole = 'audience';
    this.autoplayBlocked = false;
    this.emitVolumes({});
    this.updateStatus({
      state: 'idle',
      channel: null,
      micError: null,
      errorMessage: null,
    });
  }

  public leaveRoom(): Promise<void> {
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.internalLeave(true);
    });
    return this.opChain;
  }
}

export const agoraVoice = new AgoraVoiceEngine();
