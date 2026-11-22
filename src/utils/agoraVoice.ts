import type {
  IAgoraRTC,
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import type { AgoraVoiceConfig } from '../types';
import {
  selfHostedVoice,
  fetchVoiceServerStatus,
  VoiceServerStatusSnapshot,
} from './selfHostedVoice';

export { fetchVoiceServerStatus, type VoiceServerStatusSnapshot };

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
  provider?: 'self_hosted' | 'agora';
  appId: string;
  channel: string | null;
  remoteUsersCount: number;
  autoplayBlocked: boolean;
  micActive: boolean;
  micError: string | null;
  errorMessage: string | null;
  requiresToken?: boolean;
  transport?: 'websocket' | 'firestore_rtc' | 'idle';
  relayActive?: boolean;
}

export interface ServerAgoraStatus {
  appId: string;
  hasCertificate: boolean;
  certificateSource: 'env' | 'runtime' | 'none';
  mode: 'secured_token' | 'testing_app_id';
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
    provider: stored.provider === 'agora' ? 'agora' : 'self_hosted',
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

export async function fetchServerAgoraStatus(): Promise<ServerAgoraStatus | null> {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/agora/status');
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return null;
    return (await res.json()) as ServerAgoraStatus;
  } catch {
    return null;
  }
}

export async function saveServerAgoraCertificate(
  firebaseIdToken: string,
  appCertificate: string,
  appId?: string
): Promise<{ ok: boolean; status?: ServerAgoraStatus; error?: string }> {
  if (typeof fetch === 'undefined') {
    return { ok: false, error: 'Fetch API unavailable' };
  }
  try {
    const res = await fetch('/api/agora/certificate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${firebaseIdToken}`,
      },
      body: JSON.stringify({
        appCertificate: appCertificate.trim(),
        appId: appId?.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data?.error || 'تعذر حفظ الشهادة على الخادم.' };
    }
    return { ok: true, status: data as ServerAgoraStatus };
  } catch {
    return { ok: false, error: 'تعذر الاتصال بالخادم.' };
  }
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

  private remoteTracks = new Map<string, IRemoteAudioTrack>();
  private remoteUserIds = new Set<string>();
  private tokenRequiredCache = new Map<string, string>();

  private runtimeConfig: AgoraVoiceConfig = getAgoraConfig();
  private activeChannel: string | null = null;
  private activeRoomId: string | null = null;
  private activeRawUserId: string | null = null;
  private activeDisplayName: string | undefined = undefined;
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
  private status: AgoraConnectionStatus = {
    state: 'idle',
    provider: this.runtimeConfig.provider || 'self_hosted',
    appId: this.runtimeConfig.provider === 'agora' ? getAgoraAppId() : 'self_hosted_webrtc',
    channel: null,
    remoteUsersCount: 0,
    autoplayBlocked: false,
    micActive: false,
    micError: null,
    errorMessage: null,
    requiresToken: false,
  };

  constructor() {
    selfHostedVoice.subscribeVolumes((vols) => {
      if (this.isSelfHosted()) {
        this.emitVolumes(vols);
      }
    });
    selfHostedVoice.subscribeNotices((msg) => {
      if (this.isSelfHosted()) {
        this.emitNotice(msg);
      }
    });
    selfHostedVoice.subscribeMicStatus((active) => {
      if (this.isSelfHosted()) {
        this.setLiveMicActive(active);
      }
    });
    selfHostedVoice.subscribeStatus((st) => {
      if (this.isSelfHosted()) {
        this.status = {
          ...st,
          provider: 'self_hosted',
        };
        this.statusListeners.forEach((cb) => cb({ ...this.status }));
      }
    });
  }

  private isSelfHosted(): boolean {
    return (this.runtimeConfig.provider || 'self_hosted') === 'self_hosted';
  }

  private updateStatus(patch: Partial<AgoraConnectionStatus>) {
    this.status = {
      ...this.status,
      ...patch,
      provider: this.runtimeConfig.provider || 'self_hosted',
      appId: this.isSelfHosted()
        ? 'self_hosted_webrtc'
        : this.runtimeConfig.appId || getAgoraAppId(),
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
    if (!this.isSelfHosted()) {
      this.updateStatus({});
    }
  }

  public getConfig(): AgoraVoiceConfig {
    return { ...this.runtimeConfig };
  }

  public setConfig(next: Partial<AgoraVoiceConfig>, persistLocal = true): AgoraVoiceConfig {
    const prevProvider = this.runtimeConfig.provider || 'self_hosted';
    // Only switch to Agora if explicitly requested; otherwise keep Self-Hosted Voice Server active
    const nextProvider =
      next.provider === 'agora' || next.provider === 'self_hosted'
        ? next.provider
        : prevProvider;
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
      provider: nextProvider,
      appId: cleanAppId,
      rtcToken: cleanToken,
      note: next.note ?? this.runtimeConfig.note,
      updatedAt: next.updatedAt || new Date().toISOString(),
    };

    if (persistLocal) {
      writeStoredAgoraConfig(this.runtimeConfig);
    }

    this.updateStatus({
      provider: nextProvider,
      appId: nextProvider === 'self_hosted' ? 'self_hosted_webrtc' : cleanAppId,
      requiresToken: false,
    });

    if (
      (prevProvider !== nextProvider || prevAppId !== cleanAppId || prevToken !== cleanToken) &&
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
      provider: 'self_hosted',
      appId: DEFAULT_AGORA_APP_ID,
      rtcToken: undefined,
      updatedAt: new Date().toISOString(),
    };
    this.updateStatus({
      provider: 'self_hosted',
      appId: 'self_hosted_webrtc',
      requiresToken: false,
    });
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
      return 'مشروع Agora مفعّل عليه وضع الشهادة (Token). أضف App Certificate على السيرفر أو فعّل السيرفر الصوتي الخاص.';
    }
    if (combined.includes('UID_CONFLICT')) {
      return 'نفس الحساب متصل حالياً من جهاز أو تبويب آخر (UID_CONFLICT).';
    }
    if (combined.includes('INVALID_VENDOR_KEY') || combined.includes('INVALID_PARAMS')) {
      return 'معرّف Agora App ID غير صالح.';
    }
    if (combined.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
      return 'تعذر الوصول إلى خوادم Agora (تحقق من صحة App ID أو الشهادة على السيرفر).';
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
        const timer = window.setTimeout(() => controller.abort(), 2500);
        const res = await fetch(
          `/api/agora/token?appId=${encodeURIComponent(appId)}&channel=${encodeURIComponent(channel)}&uid=${encodeURIComponent(uid)}`,
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
        // Fallback when Express token route is unavailable
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
      }
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

  private async teardownLocalMic(client: IAgoraRTCClient | null): Promise<void> {
    const track = this.localAudioTrack;
    this.localAudioTrack = null;
    this.setLiveMicActive(false);

    if (track) {
      if (client && this.activeChannel) {
        try {
          await client.unpublish([track]);
        } catch {
          // ignore
        }
      }
      try {
        track.stop();
        track.close();
      } catch {
        // ignore
      }
    }

    if (client && this.activeChannel && this.currentRole !== 'audience') {
      try {
        await client.setClientRole('audience');
        this.currentRole = 'audience';
      } catch {
        // ignore
      }
    }
  }

  private async applyMicState(onSeat: boolean, muted: boolean, capturedEpoch: number): Promise<void> {
    if (capturedEpoch !== this.joinEpoch) return;
    if (!this.client || !this.activeChannel) {
      if (!onSeat || muted) this.setLiveMicActive(false);
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
      const errName = (err as { code?: string; name?: string })?.code || (err instanceof Error ? err.name : '');
      let msg = `تعذر تشغيل الميكروفون المباشر (${errName || 'خطأ بث'}).`;
      if (
        errName === 'PERMISSION_DENIED' ||
        errName === 'NotAllowedError' ||
        errName === 'DEVICE_NOT_FOUND' ||
        errName === 'NotFoundError'
      ) {
        msg = 'يرجى السماح بصلاحية الميكروفون أو التأكد من توصيله.';
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

  public joinRoom(roomId: string, userId: string, displayName?: string): Promise<void> {
    this.activeRoomId = roomId;
    this.activeRawUserId = userId.trim() || sanitizeAgoraUid(userId);
    this.activeDisplayName = displayName;

    if (this.isSelfHosted()) {
      void this.internalLeave(false);
      return selfHostedVoice.joinRoom(roomId, userId, displayName);
    }

    const channel = formatAgoraChannelName(roomId);
    const uid = sanitizeAgoraUid(userId);
    const rawUserId = userId.trim() || uid;
    const myEpoch = ++this.joinEpoch;

    this.opChain = this.opChain.then(async () => {
      await selfHostedVoice.leaveRoom();
      if (myEpoch !== this.joinEpoch) return;
      if (this.activeChannel === channel && this.activeUid === uid && this.client) return;

      await this.internalLeave(false);
      if (myEpoch !== this.joinEpoch) return;

      const appId = normalizeAppId(this.runtimeConfig.appId) || getAgoraAppId();
      if (!appId) return;

      const { token: joinToken, joinUid } = await this.resolveJoinParams(appId, channel, uid);
      if (myEpoch !== this.joinEpoch) return;

      const cacheKey = `${appId}:${joinToken ? 'tok' : 'notok'}`;
      const cachedNotice = this.tokenRequiredCache.get(cacheKey);
      if (cachedNotice) {
        this.updateStatus({
          state: 'error',
          appId,
          channel,
          requiresToken: true,
          errorMessage: cachedNotice,
        });
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
        const notice = this.translateAgoraJoinError(err);
        const requiresToken = this.isTokenRequirementError(err);
        if (requiresToken) {
          this.tokenRequiredCache.set(cacheKey, notice);
        }
        this.emitNotice(notice);
        await this.internalLeave(false);
        this.updateStatus({
          state: 'error',
          channel,
          requiresToken,
          errorMessage: notice,
        });
      }
    });

    return this.opChain;
  }

  public reconnectActiveRoom(): Promise<void> {
    if (!this.activeRoomId || !this.activeRawUserId) {
      return Promise.resolve();
    }
    if (this.isSelfHosted()) {
      void this.internalLeave(false);
      return selfHostedVoice.reconnectActiveRoom();
    }
    this.tokenRequiredCache.clear();
    const roomId = this.activeRoomId;
    const userId = this.activeRawUserId;
    const displayName = this.activeDisplayName;
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.internalLeave(false);
    });
    return this.joinRoom(roomId, userId, displayName);
  }

  public retryMicPublish(): Promise<void> {
    if (this.isSelfHosted()) {
      return selfHostedVoice.retryMicPublish();
    }
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
    if (this.isSelfHosted()) {
      return selfHostedVoice.syncMicState(onSeat, muted);
    }
    const capturedEpoch = this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.applyMicState(onSeat, muted, capturedEpoch);
    });
    return this.opChain;
  }

  public setRemoteAudioMuted(muted: boolean): void {
    this.remoteMuted = muted;
    selfHostedVoice.setRemoteAudioMuted(muted);
    this.remoteTracks.forEach((track) => {
      try {
        track.setVolume(muted ? 0 : 100);
      } catch {
        // ignore
      }
    });
  }

  public resumeRemoteAudio(force = false): void {
    if (this.isSelfHosted()) {
      selfHostedVoice.resumeRemoteAudio(force);
      return;
    }
    if (this.remoteMuted) return;
    if (!force && !this.autoplayBlocked) return;
    this.autoplayBlocked = false;
    this.remoteTracks.forEach((track) => {
      try {
        track.setVolume(100);
        track.play();
      } catch {
        // ignore
      }
    });
    this.updateStatus({});
  }

  public primeFromUserGesture(): void {
    selfHostedVoice.primeFromUserGesture();
    if (!this.isSelfHosted()) {
      this.resumeRemoteAudio(true);
    }
  }

  public async testConnection(roomId = 'room_tyy', userId = 'admin_tester'): Promise<{
    ok: boolean;
    message: string;
    appId: string;
    channel: string;
    requiresToken?: boolean;
  }> {
    if (this.isSelfHosted()) {
      return selfHostedVoice.testConnection(roomId);
    }

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
    return selfHostedVoice.startMicProbe(onLevel);
  }

  public stopMicProbe(): void {
    selfHostedVoice.stopMicProbe();
    if (this.probeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.probeTimer);
      this.probeTimer = null;
    }
    if (this.probeAudioTrack) {
      try {
        this.probeAudioTrack.stop();
        this.probeAudioTrack.close();
      } catch {
        // ignore
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
        // ignore
      }
    });
    this.remoteTracks.clear();
    this.remoteUserIds.clear();

    if (client) {
      try {
        client.removeAllListeners();
        await client.leave();
      } catch {
        // ignore
      }
    }

    this.client = null;
    this.activeChannel = null;
    this.activeUid = null;
    if (resetRoomTracking) {
      this.activeRoomId = null;
      this.activeRawUserId = null;
      this.activeDisplayName = undefined;
      this.desiredOnSeat = false;
      this.desiredMuted = false;
    }
    this.currentRole = 'audience';
    this.autoplayBlocked = false;
    if (!this.isSelfHosted()) {
      this.emitVolumes({});
      this.updateStatus({
        state: 'idle',
        channel: null,
        micError: null,
        errorMessage: null,
      });
    }
  }

  public leaveRoom(): Promise<void> {
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await Promise.all([this.internalLeave(true), selfHostedVoice.leaveRoom()]);
    });
    return this.opChain;
  }
}

export const agoraVoice = new AgoraVoiceEngine();
