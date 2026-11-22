import type {
  IAgoraRTC,
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';

const DEFAULT_AGORA_APP_ID = '14ba16e76eb14104b4bc0657bb032137';

export function getAgoraAppId(): string {
  const envId =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_APP_ID
      ? String(import.meta.env.VITE_AGORA_APP_ID).trim()
      : '';
  return envId || DEFAULT_AGORA_APP_ID;
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

class AgoraVoiceEngine {
  private sdk: IAgoraRTC | null = null;
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private remoteTracks = new Map<string, IRemoteAudioTrack>();

  private activeChannel: string | null = null;
  private activeUid: string | null = null;
  private currentRole: 'audience' | 'host' = 'audience';
  private remoteMuted = false;

  private joinEpoch = 0;
  private opChain: Promise<void> = Promise.resolve();

  private volumeListeners = new Set<VolumeListener>();
  private noticeListeners = new Set<NoticeListener>();
  private micStatusListeners = new Set<MicStatusListener>();

  private isLiveMicActive = false;

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

  private async ensureSdk(): Promise<IAgoraRTC> {
    if (this.sdk) return this.sdk;
    const mod = await import('agora-rtc-sdk-ng');
    const sdk = mod.default;
    sdk.setLogLevel(3); // Warning & Error only
    sdk.onAutoplayFailed = () => {
      this.emitNotice('اضغط في أي مكان داخل الغرفة لتفعيل سماع الصوت المباشر.');
    };
    this.sdk = sdk;
    return sdk;
  }

  private attachClientEvents(client: IAgoraRTCClient, uidStr: string) {
    client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
      if (mediaType !== 'audio') return;
      try {
        await client.subscribe(user, mediaType);
        const track = user.audioTrack;
        if (track) {
          this.remoteTracks.set(String(user.uid), track);
          track.setVolume(this.remoteMuted ? 0 : 100);
          track.play();
        }
      } catch {
        // Ignore transient remote subscribe failures
      }
    });

    client.on('user-unpublished', (user: IAgoraRTCRemoteUser, mediaType) => {
      if (mediaType !== 'audio') return;
      this.remoteTracks.delete(String(user.uid));
    });

    client.on('user-left', (user: IAgoraRTCRemoteUser) => {
      this.remoteTracks.delete(String(user.uid));
    });

    client.on('volume-indicator', (volumes) => {
      const next: Record<string, number> = {};
      volumes.forEach((item) => {
        const key = item.uid === 0 || String(item.uid) === uidStr ? uidStr : String(item.uid);
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

  public joinRoom(roomId: string, userId: string): Promise<void> {
    const channel = formatAgoraChannelName(roomId);
    const uid = sanitizeAgoraUid(userId);
    const rawUserId = userId.trim() || uid;
    const myEpoch = ++this.joinEpoch;

    this.opChain = this.opChain.then(async () => {
      if (myEpoch !== this.joinEpoch) return;
      if (this.activeChannel === channel && this.activeUid === uid && this.client) return;

      await this.internalLeave();
      if (myEpoch !== this.joinEpoch) return;

      const appId = getAgoraAppId();
      if (!appId) return;

      try {
        const AgoraRTC = await this.ensureSdk();
        if (myEpoch !== this.joinEpoch) return;

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        this.client = client;
        this.attachClientEvents(client, rawUserId);

        await client.setClientRole('audience');
        this.currentRole = 'audience';

        const envToken =
          typeof import.meta !== 'undefined' && import.meta.env?.VITE_AGORA_TOKEN
            ? String(import.meta.env.VITE_AGORA_TOKEN).trim() || null
            : null;

        await client.join(appId, channel, envToken, uid);
        if (myEpoch !== this.joinEpoch) {
          await client.leave().catch(() => {});
          if (this.client === client) this.client = null;
          return;
        }

        this.activeChannel = channel;
        this.activeUid = uid;
        client.enableAudioVolumeIndicator();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        const msg = err instanceof Error ? err.message : String(err);
        const combined = `${code} ${msg}`;
        if (
          combined.includes('DYNAMIC_USE_STATIC_KEY') ||
          combined.includes('INVALID_TOKEN') ||
          combined.includes('dynamic use static key')
        ) {
          this.emitNotice('سيرفر Agora يتطلب تفعيل وضع App ID (بدون شهادة) أو توفير Token.');
        } else if (combined.includes('INVALID_VENDOR_KEY')) {
          this.emitNotice('معرّف تطبيق Agora (App ID) غير صالح.');
        } else if (combined.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
          this.emitNotice('تعذر الاتصال بخوادم Agora الصوتية، تحقق من الشبكة أو إعدادات App ID.');
        }
        await this.internalLeave();
      }
    });

    return this.opChain;
  }

  public syncMicState(onSeat: boolean, muted: boolean): Promise<void> {
    const capturedEpoch = this.joinEpoch;

    this.opChain = this.opChain.then(async () => {
      if (capturedEpoch !== this.joinEpoch || !this.client || !this.activeChannel) return;

      if (!onSeat) {
        await this.teardownLocalMic(this.client);
        return;
      }

      // User is seated on a mic
      try {
        if (this.currentRole !== 'host') {
          await this.client.setClientRole('host');
          this.currentRole = 'host';
        }
        if (capturedEpoch !== this.joinEpoch || !this.client || !this.activeChannel) return;

        if (!this.localAudioTrack) {
          if (muted) {
            // Wait to capture hardware microphone until unmuted
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

          this.localAudioTrack = track;
          await this.client.publish([track]);
          this.setLiveMicActive(true);
        } else {
          await this.localAudioTrack.setMuted(muted);
          this.setLiveMicActive(!muted);
        }
      } catch (err: unknown) {
        const errName = (err as { code?: string; name?: string })?.code || (err instanceof Error ? err.name : '');
        if (
          errName === 'PERMISSION_DENIED' ||
          errName === 'NotAllowedError' ||
          errName === 'DEVICE_NOT_FOUND' ||
          errName === 'NotFoundError'
        ) {
          this.emitNotice('يرجى السماح بصلاحية الميكروفون للتحدث عبر الصوت المباشر.');
        }
        this.setLiveMicActive(false);
      }
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

  private async internalLeave(): Promise<void> {
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
    this.currentRole = 'audience';
    this.emitVolumes({});
  }

  public leaveRoom(): Promise<void> {
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.internalLeave();
    });
    return this.opChain;
  }
}

export const agoraVoice = new AgoraVoiceEngine();
