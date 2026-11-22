export interface VoiceServerStatusSnapshot {
  status: 'online' | 'offline';
  engine: string;
  wsPath: string;
  activeRoomsCount: number;
  activePeersCount: number;
  activeSpeakersCount: number;
  uptimeSec: number;
}

export interface SelfHostedVoiceStatus {
  state: 'idle' | 'connecting' | 'connected' | 'error';
  provider: 'self_hosted' | 'agora';
  appId: string;
  channel: string | null;
  remoteUsersCount: number;
  autoplayBlocked: boolean;
  micActive: boolean;
  micError: string | null;
  errorMessage: string | null;
  requiresToken?: boolean;
}

interface RemotePeerRecord {
  peerId: string;
  userId: string;
  displayName: string;
  onSeat: boolean;
  muted: boolean;
  pc: RTCPeerConnection;
  audioSender: RTCRtpSender | null;
  pendingIce: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
  audioEl: HTMLAudioElement | null;
  remoteStream: MediaStream | null;
  analyser: AnalyserNode | null;
  analyserData: Uint8Array | null;
  sourceNode: MediaStreamAudioSourceNode | null;
}

type VolumeListener = (volumes: Record<string, number>) => void;
type NoticeListener = (message: string) => void;
type MicStatusListener = (isLiveMicActive: boolean) => void;
type ConnectionStatusListener = (status: SelfHostedVoiceStatus) => void;

export async function fetchVoiceServerStatus(): Promise<VoiceServerStatusSnapshot | null> {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/voice-server/status', { signal: controller.signal });
    window.clearTimeout(timer);
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
      return null;
    }
    return (await res.json()) as VoiceServerStatusSnapshot;
  } catch {
    return null;
  }
}

function getVoiceWebSocketUrl(): string {
  if (typeof window === 'undefined') return 'ws://localhost:3000/ws/voice';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/voice`;
}

class SelfHostedVoiceEngine {
  private ws: WebSocket | null = null;
  private selfPeerId: string | null = null;
  private activeRoomId: string | null = null;
  private activeChannel: string | null = null;
  private activeUserId: string | null = null;
  private activeDisplayName = 'مستخدم';
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  private desiredOnSeat = false;
  private desiredMuted = false;
  private remoteMuted = false;

  private localStream: MediaStream | null = null;
  private localTrack: MediaStreamTrack | null = null;

  private audioCtx: AudioContext | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localAnalyserData: Uint8Array | null = null;
  private volumeTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;

  // Mic probe state (Admin Dashboard)
  private probeStream: MediaStream | null = null;
  private probeCtx: AudioContext | null = null;
  private probeTimer: number | null = null;

  private peers = new Map<string, RemotePeerRecord>();
  private joinEpoch = 0;
  private opChain: Promise<void> = Promise.resolve();

  private volumeListeners = new Set<VolumeListener>();
  private noticeListeners = new Set<NoticeListener>();
  private micStatusListeners = new Set<MicStatusListener>();
  private statusListeners = new Set<ConnectionStatusListener>();

  private isLiveMicActive = false;
  private autoplayBlocked = false;
  private status: SelfHostedVoiceStatus = {
    state: 'idle',
    provider: 'self_hosted',
    appId: 'self_hosted_webrtc',
    channel: null,
    remoteUsersCount: 0,
    autoplayBlocked: false,
    micActive: false,
    micError: null,
    errorMessage: null,
    requiresToken: false,
  };

  private updateStatus(patch: Partial<SelfHostedVoiceStatus>) {
    this.status = {
      ...this.status,
      ...patch,
      provider: 'self_hosted',
      micActive: this.isLiveMicActive,
      autoplayBlocked: this.autoplayBlocked,
      remoteUsersCount: this.peers.size,
    };
    this.statusListeners.forEach((cb) => cb({ ...this.status }));
  }

  private emitNotice(msg: string) {
    this.noticeListeners.forEach((cb) => cb(msg));
  }

  private setLiveMicActive(active: boolean) {
    if (this.isLiveMicActive === active) return;
    this.isLiveMicActive = active;
    this.micStatusListeners.forEach((cb) => cb(active));
    this.updateStatus({});
  }

  public subscribeVolumes(cb: VolumeListener): () => void {
    this.volumeListeners.add(cb);
    return () => this.volumeListeners.delete(cb);
  }

  public subscribeNotices(cb: NoticeListener): () => void {
    this.noticeListeners.add(cb);
    return () => this.noticeListeners.delete(cb);
  }

  public subscribeMicStatus(cb: MicStatusListener): () => void {
    this.micStatusListeners.add(cb);
    cb(this.isLiveMicActive);
    return () => this.micStatusListeners.delete(cb);
  }

  public subscribeStatus(cb: ConnectionStatusListener): () => void {
    this.statusListeners.add(cb);
    cb({ ...this.status });
    return () => this.statusListeners.delete(cb);
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.audioCtx = new Ctx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private startVolumeLoop() {
    if (this.volumeTimer !== null || typeof window === 'undefined') return;
    this.volumeTimer = window.setInterval(() => {
      const next: Record<string, number> = {};

      if (this.activeUserId && this.localAnalyser && this.localAnalyserData && this.isLiveMicActive) {
        this.localAnalyser.getByteTimeDomainData(
          this.localAnalyserData as Uint8Array<ArrayBuffer>
        );
        let sum = 0;
        for (let i = 0; i < this.localAnalyserData.length; i++) {
          const v = (this.localAnalyserData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / this.localAnalyserData.length);
        next[this.activeUserId] = Math.min(100, Math.round(rms * 260));
      }

      this.peers.forEach((peer) => {
        if (!peer.analyser || !peer.analyserData || !peer.onSeat || peer.muted) return;
        peer.analyser.getByteTimeDomainData(peer.analyserData as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < peer.analyserData.length; i++) {
          const v = (peer.analyserData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / peer.analyserData.length);
        next[peer.userId] = Math.min(100, Math.round(rms * 260));
      });

      this.volumeListeners.forEach((cb) => cb(next));
    }, 120);
  }

  private stopVolumeLoop() {
    if (this.volumeTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.volumeTimer);
      this.volumeTimer = null;
    }
    this.volumeListeners.forEach((cb) => cb({}));
  }

  private sendWs(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(payload));
      } catch {
        // ignore send errors
      }
    }
  }

  private setupPeerConnection(peerInfo: {
    peerId: string;
    userId: string;
    displayName: string;
    onSeat: boolean;
    muted: boolean;
  }): RemotePeerRecord {
    const existing = this.peers.get(peerInfo.peerId);
    if (existing) {
      existing.onSeat = peerInfo.onSeat;
      existing.muted = peerInfo.muted;
      return existing;
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
    const audioSender = transceiver.sender;

    if (this.localTrack && this.desiredOnSeat && !this.desiredMuted) {
      void audioSender.replaceTrack(this.localTrack).catch(() => {});
    }

    const record: RemotePeerRecord = {
      peerId: peerInfo.peerId,
      userId: peerInfo.userId,
      displayName: peerInfo.displayName,
      onSeat: peerInfo.onSeat,
      muted: peerInfo.muted,
      pc,
      audioSender,
      pendingIce: [],
      remoteDescriptionSet: false,
      audioEl: null,
      remoteStream: null,
      analyser: null,
      analyserData: null,
      sourceNode: null,
    };

    pc.onicecandidate = (evt) => {
      if (!evt.candidate) return;
      this.sendWs({
        type: 'voice:ice',
        targetPeerId: peerInfo.peerId,
        candidate: evt.candidate.toJSON(),
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          // ignore ICE restart errors
        }
      }
    };

    pc.ontrack = (evt) => {
      const stream = evt.streams?.[0] || new MediaStream([evt.track]);
      record.remoteStream = stream;

      if (typeof document !== 'undefined') {
        if (!record.audioEl) {
          const audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.style.display = 'none';
          document.body.appendChild(audio);
          record.audioEl = audio;
        }
        record.audioEl.srcObject = stream;
        record.audioEl.muted = this.remoteMuted;
        record.audioEl.volume = 1;
        const playPromise = record.audioEl.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            this.autoplayBlocked = true;
            this.updateStatus({});
            this.emitNotice('اضغط في أي مكان داخل الغرفة لتفعيل سماع الصوت المباشر.');
          });
        }
      }

      const ctx = this.ensureAudioContext();
      if (ctx && !record.sourceNode) {
        try {
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          record.sourceNode = src;
          record.analyser = analyser;
          record.analyserData = new Uint8Array(analyser.frequencyBinCount);
        } catch {
          // Ignore AudioContext analyser errors for remote stream
        }
      }
    };

    this.peers.set(peerInfo.peerId, record);
    this.updateStatus({});
    return record;
  }

  private cleanupPeer(peerId: string) {
    const rec = this.peers.get(peerId);
    if (!rec) return;
    this.peers.delete(peerId);

    try {
      rec.sourceNode?.disconnect();
    } catch {
      // ignore
    }
    if (rec.audioEl) {
      try {
        rec.audioEl.pause();
        rec.audioEl.srcObject = null;
        rec.audioEl.remove();
      } catch {
        // ignore
      }
    }
    try {
      rec.pc.ontrack = null;
      rec.pc.onicecandidate = null;
      rec.pc.oniceconnectionstatechange = null;
      rec.pc.close();
    } catch {
      // ignore
    }
    this.updateStatus({});
  }

  private async initiateOfferToPeer(rec: RemotePeerRecord) {
    try {
      const offer = await rec.pc.createOffer({ offerToReceiveAudio: true });
      await rec.pc.setLocalDescription(offer);
      this.sendWs({
        type: 'voice:offer',
        targetPeerId: rec.peerId,
        sdp: rec.pc.localDescription,
      });
    } catch (err) {
      console.warn('[SelfHostedVoice] offer failed:', err);
    }
  }

  private async handleIncomingOffer(
    fromPeerId: string,
    fromUserId: string,
    sdp: RTCSessionDescriptionInit
  ) {
    const rec = this.setupPeerConnection({
      peerId: fromPeerId,
      userId: fromUserId,
      displayName: fromUserId,
      onSeat: true,
      muted: false,
    });
    try {
      if (rec.pc.signalingState !== 'stable') {
        await Promise.all([
          rec.pc.setLocalDescription({ type: 'rollback' }),
          rec.pc.setRemoteDescription(new RTCSessionDescription(sdp)),
        ]);
      } else {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      rec.remoteDescriptionSet = true;
      await this.flushPendingIce(rec);

      if (this.localTrack && this.desiredOnSeat && !this.desiredMuted) {
        const sender = rec.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track) || rec.audioSender;
        if (sender) {
          await sender.replaceTrack(this.localTrack).catch(() => {});
        }
      }

      const answer = await rec.pc.createAnswer();
      await rec.pc.setLocalDescription(answer);
      this.sendWs({
        type: 'voice:answer',
        targetPeerId: fromPeerId,
        sdp: rec.pc.localDescription,
      });
    } catch (err) {
      console.warn('[SelfHostedVoice] handleIncomingOffer error:', err);
    }
  }

  private async handleIncomingAnswer(fromPeerId: string, sdp: RTCSessionDescriptionInit) {
    const rec = this.peers.get(fromPeerId);
    if (!rec) return;
    try {
      await rec.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      rec.remoteDescriptionSet = true;
      await this.flushPendingIce(rec);
    } catch (err) {
      console.warn('[SelfHostedVoice] handleIncomingAnswer error:', err);
    }
  }

  private async handleIncomingIce(fromPeerId: string, candidate: RTCIceCandidateInit) {
    const rec = this.peers.get(fromPeerId);
    if (!rec) return;
    if (!rec.remoteDescriptionSet) {
      rec.pendingIce.push(candidate);
      return;
    }
    try {
      await rec.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore benign candidate race
    }
  }

  private async flushPendingIce(rec: RemotePeerRecord) {
    while (rec.pendingIce.length > 0) {
      const cand = rec.pendingIce.shift();
      if (!cand) continue;
      try {
        await rec.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore
      }
    }
  }

  private async releaseLocalMic(): Promise<void> {
    this.setLiveMicActive(false);

    const replacePromises: Promise<void>[] = [];
    this.peers.forEach((rec) => {
      if (rec.audioSender) {
        replacePromises.push(rec.audioSender.replaceTrack(null).catch(() => {}));
      }
    });
    await Promise.all(replacePromises);

    try {
      this.localSource?.disconnect();
    } catch {
      // ignore
    }
    this.localSource = null;
    this.localAnalyser = null;
    this.localAnalyserData = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.localStream = null;
    }
    this.localTrack = null;
  }

  private async applyMicState(onSeat: boolean, muted: boolean, capturedEpoch: number): Promise<void> {
    if (capturedEpoch !== this.joinEpoch) return;

    this.sendWs({
      type: 'voice:mic_state',
      onSeat,
      muted,
    });

    if (!onSeat) {
      this.updateStatus({ micError: null });
      await this.releaseLocalMic();
      return;
    }

    if (muted) {
      if (this.localTrack) {
        this.localTrack.enabled = false;
      }
      this.updateStatus({ micError: null });
      this.setLiveMicActive(false);
      return;
    }

    // onSeat && !muted
    if (this.localTrack) {
      this.localTrack.enabled = true;
      await Promise.all(
        Array.from(this.peers.values()).map((rec) =>
          rec.audioSender ? rec.audioSender.replaceTrack(this.localTrack).catch(() => {}) : Promise.resolve()
        )
      );
      this.updateStatus({ micError: null });
      this.setLiveMicActive(true);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const msg = 'المتصفح لا يدعم التقاط الميكروفون أو الصفحة ليست عبر HTTPS.';
      this.updateStatus({ micError: msg });
      this.emitNotice(msg);
      this.setLiveMicActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      if (capturedEpoch !== this.joinEpoch || !this.desiredOnSeat || this.desiredMuted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const track = stream.getAudioTracks()[0];
      if (!track) {
        throw new Error('DEVICE_NOT_FOUND');
      }

      track.onended = () => {
        if (this.localTrack === track) {
          this.setLiveMicActive(false);
          const msg = 'تم فصل الميكروفون من المتصفح أو النظام.';
          this.updateStatus({ micError: msg });
          this.emitNotice(msg);
        }
      };

      this.localStream = stream;
      this.localTrack = track;

      const ctx = this.ensureAudioContext();
      if (ctx) {
        try {
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          this.localSource = src;
          this.localAnalyser = analyser;
          this.localAnalyserData = new Uint8Array(analyser.frequencyBinCount);
        } catch {
          // ignore
        }
      }

      await Promise.all(
        Array.from(this.peers.values()).map((rec) =>
          rec.audioSender ? rec.audioSender.replaceTrack(track).catch(() => {}) : Promise.resolve()
        )
      );

      this.updateStatus({ micError: null });
      this.setLiveMicActive(true);
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      let msg = 'تعذر تشغيل الميكروفون المباشر.';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        msg = 'يرجى السماح بصلاحية الميكروفون في المتصفح للتحدث على المايك.';
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        msg = 'لم يتم العثور على ميكروفون متصل بالجهاز.';
      } else if (errName === 'NotReadableError') {
        msg = 'الميكروفون مستخدم من تطبيق آخر حالياً.';
      } else if (errName === 'SecurityError') {
        msg = 'يرجى فتح التطبيق عبر رابط HTTPS لتشغيل الميكروفون.';
      }
      this.emitNotice(msg);
      this.updateStatus({ micError: msg });
      this.setLiveMicActive(false);
    }
  }

  private clearWsTimers() {
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async connectWebSocket(
    roomId: string,
    userId: string,
    displayName: string,
    myEpoch: number
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof WebSocket === 'undefined') {
        this.updateStatus({
          state: 'error',
          errorMessage: 'المتصفح لا يدعم WebSocket للتواصل الصوتي.',
        });
        resolve();
        return;
      }

      const wsUrl = getVoiceWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const timeout = window.setTimeout(() => {
        if (!resolved && ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          this.updateStatus({
            state: 'error',
            errorMessage: 'تعذر الوصول إلى سيرفر الصوت الخاص (/ws/voice).',
          });
          done();
        }
      }, 6000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          ws.close();
          done();
          return;
        }
        this.reconnectAttempts = 0;
        this.sendWs({
          type: 'voice:join',
          roomId,
          userId,
          displayName,
          onSeat: this.desiredOnSeat,
          muted: this.desiredMuted,
        });

        this.heartbeatTimer = window.setInterval(() => {
          this.sendWs({ type: 'voice:ping', ts: Date.now() });
        }, 15000);
      };

      ws.onmessage = async (event) => {
        if (myEpoch !== this.joinEpoch || this.ws !== ws) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data || '{}')) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = String(msg.type || '');
        if (type === 'voice:room_state') {
          this.selfPeerId = String(msg.selfPeerId || '');
          if (Array.isArray(msg.iceServers) && msg.iceServers.length > 0) {
            this.iceServers = msg.iceServers as RTCIceServer[];
          }
          this.activeChannel = roomId;
          this.startVolumeLoop();
          this.updateStatus({
            state: 'connected',
            channel: roomId,
            errorMessage: null,
            requiresToken: false,
          });

          const existingPeers = Array.isArray(msg.peers) ? (msg.peers as Array<{
            peerId: string;
            userId: string;
            displayName: string;
            onSeat: boolean;
            muted: boolean;
          }>) : [];

          for (const p of existingPeers) {
            const rec = this.setupPeerConnection(p);
            // Newly joined peer initiates WebRTC offers to already-present peers
            await this.initiateOfferToPeer(rec);
          }

          if (this.desiredOnSeat) {
            await this.applyMicState(this.desiredOnSeat, this.desiredMuted, myEpoch);
          }
          done();
          return;
        }

        if (type === 'voice:peer_joined') {
          const p = msg.peer as {
            peerId: string;
            userId: string;
            displayName: string;
            onSeat: boolean;
            muted: boolean;
          } | undefined;
          if (p?.peerId) {
            this.setupPeerConnection(p);
          }
          return;
        }

        if (type === 'voice:peer_updated') {
          const p = msg.peer as {
            peerId: string;
            userId: string;
            displayName: string;
            onSeat: boolean;
            muted: boolean;
          } | undefined;
          if (p?.peerId) {
            const rec = this.peers.get(p.peerId);
            if (rec) {
              rec.onSeat = p.onSeat;
              rec.muted = p.muted;
              rec.displayName = p.displayName;
            }
          }
          return;
        }

        if (type === 'voice:peer_left') {
          const peerId = String(msg.peerId || '');
          if (peerId) this.cleanupPeer(peerId);
          return;
        }

        if (type === 'voice:offer') {
          await this.handleIncomingOffer(
            String(msg.fromPeerId || ''),
            String(msg.fromUserId || ''),
            msg.sdp as RTCSessionDescriptionInit
          );
          return;
        }

        if (type === 'voice:answer') {
          await this.handleIncomingAnswer(
            String(msg.fromPeerId || ''),
            msg.sdp as RTCSessionDescriptionInit
          );
          return;
        }

        if (type === 'voice:ice') {
          await this.handleIncomingIce(
            String(msg.fromPeerId || ''),
            msg.candidate as RTCIceCandidateInit
          );
          return;
        }

        if (type === 'voice:error') {
          const errMsg = String(msg.message || 'خطأ في سيرفر الصوت.');
          this.emitNotice(errMsg);
          this.updateStatus({ state: 'error', errorMessage: errMsg });
          done();
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          done();
          return;
        }
        this.updateStatus({
          state: 'error',
          errorMessage: 'تعذر الاتصال بسيرفر الصوت الخاص، جاري إعادة المحاولة...',
        });
        done();
      };

      ws.onclose = () => {
        window.clearTimeout(timeout);
        if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
          window.clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          done();
          return;
        }
        // Auto-reconnect if still in active room
        if (this.activeRoomId && this.activeUserId) {
          this.reconnectAttempts += 1;
          const delay = Math.min(8000, 1000 * Math.pow(2, Math.min(3, this.reconnectAttempts - 1)));
          this.updateStatus({
            state: 'connecting',
            errorMessage: null,
          });
          this.reconnectTimer = window.setTimeout(() => {
            if (myEpoch === this.joinEpoch && this.activeRoomId && this.activeUserId) {
              void this.reconnectActiveRoom();
            }
          }, delay);
        }
        done();
      };
    });
  }

  public joinRoom(roomId: string, userId: string, displayName?: string): Promise<void> {
    const cleanRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'main';
    const cleanUid = userId.trim() || 'guest_user';
    const myEpoch = ++this.joinEpoch;

    this.activeRoomId = cleanRoom;
    this.activeUserId = cleanUid;
    this.activeDisplayName = (displayName || cleanUid).trim().slice(0, 64);

    this.opChain = this.opChain.then(async () => {
      if (myEpoch !== this.joinEpoch) return;
      if (this.activeChannel === cleanRoom && this.ws?.readyState === WebSocket.OPEN) return;

      await this.internalLeave(false);
      if (myEpoch !== this.joinEpoch) return;

      this.updateStatus({
        state: 'connecting',
        channel: cleanRoom,
        micError: null,
        errorMessage: null,
        requiresToken: false,
      });

      await this.connectWebSocket(cleanRoom, cleanUid, this.activeDisplayName, myEpoch);
    });

    return this.opChain;
  }

  public reconnectActiveRoom(): Promise<void> {
    if (!this.activeRoomId || !this.activeUserId) return Promise.resolve();
    const r = this.activeRoomId;
    const u = this.activeUserId;
    const n = this.activeDisplayName;
    ++this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      await this.internalLeave(false);
    });
    return this.joinRoom(r, u, n);
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

  public retryMicPublish(): Promise<void> {
    const capturedEpoch = this.joinEpoch;
    this.opChain = this.opChain.then(async () => {
      if (this.desiredOnSeat) {
        await this.applyMicState(true, this.desiredMuted, capturedEpoch);
      }
    });
    return this.opChain;
  }

  public setRemoteAudioMuted(muted: boolean): void {
    this.remoteMuted = muted;
    this.peers.forEach((rec) => {
      if (rec.audioEl) {
        rec.audioEl.muted = muted;
      }
    });
  }

  public resumeRemoteAudio(force = false): void {
    if (this.remoteMuted) return;
    if (!force && !this.autoplayBlocked) return;
    this.autoplayBlocked = false;
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    this.peers.forEach((rec) => {
      if (rec.audioEl) {
        rec.audioEl.muted = false;
        rec.audioEl.volume = 1;
        void rec.audioEl.play().catch(() => {});
      }
    });
    this.updateStatus({});
  }

  public async testConnection(roomId = 'room_tyy'): Promise<{
    ok: boolean;
    message: string;
    appId: string;
    channel: string;
    requiresToken?: boolean;
  }> {
    const status = await fetchVoiceServerStatus();
    if (!status || status.status !== 'online') {
      return {
        ok: false,
        message: 'تعذر الوصول إلى سيرفر الصوت الخاص (/api/voice-server/status).',
        appId: 'self_hosted_webrtc',
        channel: roomId,
      };
    }

    const wsOk = await new Promise<boolean>((resolve) => {
      if (typeof WebSocket === 'undefined') {
        resolve(false);
        return;
      }
      const ws = new WebSocket(getVoiceWebSocketUrl());
      const timer = window.setTimeout(() => {
        try {
          ws.close();
        } catch {
          // ignore
        }
        resolve(false);
      }, 3500);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'voice:ping', ts: Date.now() }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(String(e.data || '{}'));
          if (msg.type === 'voice:pong') {
            window.clearTimeout(timer);
            ws.close();
            resolve(true);
          }
        } catch {
          // ignore
        }
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        resolve(false);
      };
    });

    if (!wsOk) {
      return {
        ok: false,
        message: 'السيرفر مستجيب لكن اتصال WebSocket (/ws/voice) لم يكتمل.',
        appId: 'self_hosted_webrtc',
        channel: roomId,
      };
    }

    return {
      ok: true,
      message: `سيرفر الصوت الخاص بك يعمل بكفاءة! (${status.activeRoomsCount} غرف نشطة · ${status.activePeersCount} متصلين · /ws/voice)`,
      appId: 'self_hosted_webrtc',
      channel: roomId,
    };
  }

  public async startMicProbe(onLevel: (level: number) => void): Promise<{ ok: boolean; message: string }> {
    this.stopMicProbe();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return {
        ok: false,
        message: 'المتصفح لا يدعم التقاط الميكروفون أو الرابط ليس HTTPS.',
      };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.probeStream = stream;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      this.probeCtx = ctx;
      this.probeTimer = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        onLevel(Math.min(100, Math.round(rms * 260)));
      }, 100);
      return {
        ok: true,
        message: 'الميكروفون يعمل بنجاح عبر السيرفر الصوتي الخاص! تحدث الآن لمشاهدة مؤشر الصوت الحي.',
      };
    } catch (err) {
      const errName = (err as { name?: string })?.name || '';
      return {
        ok: false,
        message:
          errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
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
    if (this.probeCtx) {
      this.probeCtx.close().catch(() => {});
      this.probeCtx = null;
    }
    if (this.probeStream) {
      this.probeStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      this.probeStream = null;
    }
  }

  private async internalLeave(resetRoomTracking = true): Promise<void> {
    this.clearWsTimers();
    this.stopVolumeLoop();
    await this.releaseLocalMic();

    Array.from(this.peers.keys()).forEach((peerId) => this.cleanupPeer(peerId));

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'voice:leave' }));
        }
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close(1000, 'leave_room');
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.selfPeerId = null;
    this.activeChannel = null;
    this.autoplayBlocked = false;

    if (resetRoomTracking) {
      this.activeRoomId = null;
      this.activeUserId = null;
      this.desiredOnSeat = false;
      this.desiredMuted = false;
    }

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

export const selfHostedVoice = new SelfHostedVoiceEngine();
