import type { RoomLiveEvent } from '../types';
import {
  FirestoreRtcSignalPayload,
  isCloudWriteReady,
  publishFirestoreRtcSignal,
  subscribeToFirestoreRtcSignals,
} from './auravoiceFirestore';

import { testFirebaseConnection } from './firebase';

export interface VoiceServerStatusSnapshot {
  status: 'online' | 'offline';
  engine: string;
  mode?: 'express_ws' | 'serverless_cloud';
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
  transport?: 'websocket' | 'firestore_rtc' | 'idle';
  relayActive?: boolean;
}

interface RemotePeerRecord {
  peerId: string;
  userId: string;
  displayName: string;
  onSeat: boolean;
  muted: boolean;
  polite: boolean;
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  pendingIce: RTCIceCandidateInit[];
  remoteDescriptionSet: boolean;
  p2pConnected: boolean;
  relayFallbackTimer: number | null;
  audioEl: HTMLAudioElement | null;
  remoteStream: MediaStream | null;
  analyser: AnalyserNode | null;
  analyserData: Uint8Array | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  // WebSocket audio relay playback jitter cursor
  relayNextPlayTime: number;
  relayLastLevel: number;
  relayLastLevelAt: number;
}

type VolumeListener = (volumes: Record<string, number>) => void;
type NoticeListener = (message: string) => void;
type MicStatusListener = (isLiveMicActive: boolean) => void;
type ConnectionStatusListener = (status: SelfHostedVoiceStatus) => void;
type RoomEventListener = (event: RoomLiveEvent) => void;

export interface ServerSyncEvent {
  type: 'server:catalog_update' | 'server:dashboard_command';
  catalog?: Record<string, unknown>;
  command?: Record<string, unknown> | null;
  state?: Record<string, unknown>;
}
type ServerSyncListener = (event: ServerSyncEvent) => void;

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// ============================================================================
// G.711 MU-LAW COMPACT AUDIO CODEC (For Automatic NAT/Firewall WS Relay)
// 16kHz mono -> 16 KB/s crisp voice over HTTPS/WSS port 443!
// ============================================================================
function linearToMuLaw(sample: number): number {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 33;
  let pcm = Math.max(-1, Math.min(1, sample)) * 32767;
  let sign = 0;
  if (pcm < 0) {
    sign = 0x80;
    pcm = -pcm;
  }
  pcm = Math.min(MULAW_MAX * 4, pcm);
  pcm = (pcm >> 2) + MULAW_BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {
    // find highest bit
  }
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function muLawToLinear(uVal: number): number {
  const val = ~uVal & 0xff;
  const sign = val & 0x80;
  const exponent = (val >> 4) & 0x07;
  const mantissa = val & 0x0f;
  let sample = ((mantissa << 3) + 0x84) << exponent;
  sample -= 0x84;
  return (sign ? -sample : sample) / 32768;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

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
  private transport: 'websocket' | 'firestore_rtc' | 'idle' = 'idle';
  private unsubFirestoreSignals: (() => void) | null = null;
  private firestoreHelloTimer: number | null = null;

  private selfPeerId: string | null = null;
  private activeRoomId: string | null = null;
  private activeChannel: string | null = null;
  private activeUserId: string | null = null;
  private activeDisplayName = 'مستخدم';
  private iceServers: RTCIceServer[] = [...DEFAULT_ICE_SERVERS];

  private desiredOnSeat = false;
  private desiredMuted = false;
  private remoteMuted = false;

  private localStream: MediaStream | null = null;
  private localTrack: MediaStreamTrack | null = null;

  private audioCtx: AudioContext | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localAnalyserData: Uint8Array | null = null;
  private relayProcessor: ScriptProcessorNode | null = null;
  private relayMuteGain: GainNode | null = null;
  private relayRequestedByPeers = new Set<string>();
  private relaySeq = 0;

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
  private roomEventListeners = new Set<RoomEventListener>();
  private serverSyncListeners = new Set<ServerSyncListener>();

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
    transport: 'idle',
    relayActive: false,
  };

  private updateStatus(patch: Partial<SelfHostedVoiceStatus>) {
    this.status = {
      ...this.status,
      ...patch,
      provider: 'self_hosted',
      micActive: this.isLiveMicActive,
      autoplayBlocked: this.autoplayBlocked,
      remoteUsersCount: this.peers.size,
      transport: this.transport,
      relayActive: this.relayRequestedByPeers.size > 0,
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

  public subscribeRoomEvents(cb: RoomEventListener): () => void {
    this.roomEventListeners.add(cb);
    return () => this.roomEventListeners.delete(cb);
  }

  public subscribeServerSync(cb: ServerSyncListener): () => void {
    this.serverSyncListeners.add(cb);
    return () => this.serverSyncListeners.delete(cb);
  }

  public broadcastRoomEvent(event: RoomLiveEvent): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendWs({
        type: 'room:event',
        event,
      });
      return true;
    }
    return false;
  }

  /**
   * Call directly inside a user tap handler (e.g., Climb Mic button or room tap)
   * so mobile Safari / Android Chrome unlock AudioContext and remote <audio> immediately.
   */
  public primeFromUserGesture(): void {
    this.ensureAudioContext();
    this.resumeRemoteAudio(true);
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
      const now = Date.now();

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
        next[this.activeUserId] = Math.min(100, Math.round(rms * 280));
      }

      this.peers.forEach((peer) => {
        if (!peer.onSeat || peer.muted) return;
        let lvl = 0;
        if (peer.analyser && peer.analyserData && peer.p2pConnected) {
          peer.analyser.getByteTimeDomainData(peer.analyserData as Uint8Array<ArrayBuffer>);
          let sum = 0;
          for (let i = 0; i < peer.analyserData.length; i++) {
            const v = (peer.analyserData[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / peer.analyserData.length);
          lvl = Math.min(100, Math.round(rms * 280));
        }
        if (lvl === 0 && now - peer.relayLastLevelAt < 450) {
          lvl = peer.relayLastLevel;
        }
        if (lvl > 0) {
          next[peer.userId] = lvl;
        }
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

  private sendSignal(params: {
    type: 'voice:offer' | 'voice:answer' | 'voice:ice';
    targetPeerId: string;
    sdp?: RTCSessionDescriptionInit | null;
    candidate?: RTCIceCandidateInit | null;
  }) {
    if (this.transport === 'websocket') {
      this.sendWs(params);
      return;
    }
    if (
      this.transport === 'firestore_rtc' &&
      this.activeRoomId &&
      this.selfPeerId &&
      this.activeUserId
    ) {
      const sigType =
        params.type === 'voice:offer'
          ? 'offer'
          : params.type === 'voice:answer'
          ? 'answer'
          : 'ice';
      void publishFirestoreRtcSignal({
        roomId: this.activeRoomId,
        signalType: sigType,
        fromPeerId: this.selfPeerId,
        fromUserId: this.activeUserId,
        displayName: this.activeDisplayName,
        targetPeerId: params.targetPeerId,
        sdp: params.sdp || undefined,
        candidate: params.candidate || undefined,
      });
    }
  }

  private getAudioTransceiver(pc: RTCPeerConnection): RTCRtpTransceiver | undefined {
    return pc
      .getTransceivers()
      .find(
        (tr) =>
          tr.receiver?.track?.kind === 'audio' ||
          tr.sender?.track?.kind === 'audio'
      );
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
      existing.displayName = peerInfo.displayName || existing.displayName;
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 4,
    });

    // Deterministic Perfect Negotiation polite role
    const polite = (this.selfPeerId || '') < peerInfo.peerId;

    const record: RemotePeerRecord = {
      peerId: peerInfo.peerId,
      userId: peerInfo.userId,
      displayName: peerInfo.displayName,
      onSeat: peerInfo.onSeat,
      muted: peerInfo.muted,
      polite,
      pc,
      makingOffer: false,
      ignoreOffer: false,
      pendingIce: [],
      remoteDescriptionSet: false,
      p2pConnected: false,
      relayFallbackTimer: null,
      audioEl: null,
      remoteStream: null,
      analyser: null,
      analyserData: null,
      sourceNode: null,
      relayNextPlayTime: 0,
      relayLastLevel: 0,
      relayLastLevelAt: 0,
    };

    pc.onicecandidate = (evt) => {
      if (!evt.candidate) return;
      this.sendSignal({
        type: 'voice:ice',
        targetPeerId: peerInfo.peerId,
        candidate: evt.candidate.toJSON(),
      });
    };

    const requestRelayFromPeer = (enabled: boolean) => {
      if (this.transport !== 'websocket') return;
      this.sendWs({
        type: 'voice:relay_request',
        targetPeerId: peerInfo.peerId,
        enabled,
      });
    };

    const evaluateConnectionHealth = () => {
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      if (ice === 'connected' || ice === 'completed' || conn === 'connected') {
        record.p2pConnected = true;
        if (record.relayFallbackTimer !== null) {
          window.clearTimeout(record.relayFallbackTimer);
          record.relayFallbackTimer = null;
        }
        requestRelayFromPeer(false);
        this.updateStatus({});
      } else if (ice === 'failed' || conn === 'failed') {
        record.p2pConnected = false;
        requestRelayFromPeer(true);
        try {
          pc.restartIce();
        } catch {
          // ignore
        }
        this.updateStatus({});
      } else if (ice === 'disconnected') {
        record.p2pConnected = false;
        requestRelayFromPeer(true);
      }
    };

    pc.oniceconnectionstatechange = evaluateConnectionHealth;
    pc.onconnectionstatechange = evaluateConnectionHealth;

    // If WebRTC P2P doesn't finish ICE within 4.5s (strict 4G/5G carrier NAT),
    // automatically enable low-bandwidth WebSocket server audio relay!
    if (typeof window !== 'undefined' && this.transport === 'websocket') {
      record.relayFallbackTimer = window.setTimeout(() => {
        if (!record.p2pConnected && this.peers.get(peerInfo.peerId) === record) {
          requestRelayFromPeer(true);
        }
      }, 4500);
    }

    pc.onnegotiationneeded = () => {
      if (this.peers.get(peerInfo.peerId) !== record) return;
      void this.initiateOfferToPeer(record);
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
    this.relayRequestedByPeers.delete(peerId);

    if (rec.relayFallbackTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(rec.relayFallbackTimer);
      rec.relayFallbackTimer = null;
    }

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
      rec.pc.onconnectionstatechange = null;
      rec.pc.onnegotiationneeded = null;
      rec.pc.close();
    } catch {
      // ignore
    }
    this.updateStatus({});
  }

  private async syncLocalTrackToPeer(rec: RemotePeerRecord, triggerRenegotiate: boolean) {
    const pc = rec.pc;
    const tr = this.getAudioTransceiver(pc);
    const shouldSend = Boolean(this.localTrack && this.desiredOnSeat && !this.desiredMuted);

    try {
      if (shouldSend && this.localTrack) {
        if (tr) {
          await tr.sender.replaceTrack(this.localTrack);
          if (tr.direction !== 'sendrecv') {
            tr.direction = 'sendrecv';
          }
          if (
            triggerRenegotiate &&
            tr.currentDirection !== 'sendrecv' &&
            tr.currentDirection !== 'sendonly'
          ) {
            await this.initiateOfferToPeer(rec);
          }
        } else {
          if (this.localStream) {
            pc.addTrack(this.localTrack, this.localStream);
          } else {
            pc.addTransceiver(this.localTrack, { direction: 'sendrecv' });
          }
          if (triggerRenegotiate) {
            await this.initiateOfferToPeer(rec);
          }
        }
      } else if (tr) {
        await tr.sender.replaceTrack(null).catch(() => {});
      }
    } catch (err) {
      console.warn('[SelfHostedVoice] syncLocalTrackToPeer notice:', err);
    }
  }

  private async initiateOfferToPeer(rec: RemotePeerRecord) {
    if (rec.makingOffer) return;
    try {
      rec.makingOffer = true;

      // Ensure at least one audio transceiver exists before creating offer
      const tr = this.getAudioTransceiver(rec.pc);
      if (this.localTrack && this.desiredOnSeat && !this.desiredMuted) {
        if (tr) {
          await tr.sender.replaceTrack(this.localTrack);
          tr.direction = 'sendrecv';
        } else if (this.localStream) {
          rec.pc.addTrack(this.localTrack, this.localStream);
        } else {
          rec.pc.addTransceiver(this.localTrack, { direction: 'sendrecv' });
        }
      } else if (!tr) {
        rec.pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      const offer = await rec.pc.createOffer({ offerToReceiveAudio: true });
      if (rec.pc.signalingState !== 'stable') return;
      await rec.pc.setLocalDescription(offer);
      this.sendSignal({
        type: 'voice:offer',
        targetPeerId: rec.peerId,
        sdp: rec.pc.localDescription,
      });
    } catch (err) {
      console.warn('[SelfHostedVoice] offer failed:', err);
    } finally {
      rec.makingOffer = false;
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
      const offerCollision = rec.makingOffer || rec.pc.signalingState !== 'stable';
      rec.ignoreOffer = !rec.polite && offerCollision;
      if (rec.ignoreOffer) {
        return;
      }

      if (offerCollision) {
        await Promise.all([
          rec.pc.setLocalDescription({ type: 'rollback' }),
          rec.pc.setRemoteDescription(new RTCSessionDescription(sdp)),
        ]);
      } else {
        await rec.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }

      rec.remoteDescriptionSet = true;
      await this.flushPendingIce(rec);

      // Bind our active mic track onto the negotiated audio transceiver BEFORE answering!
      const tr = this.getAudioTransceiver(rec.pc);
      if (this.localTrack && this.desiredOnSeat && !this.desiredMuted) {
        if (tr) {
          tr.direction = 'sendrecv';
          await tr.sender.replaceTrack(this.localTrack).catch(() => {});
        } else if (this.localStream) {
          rec.pc.addTrack(this.localTrack, this.localStream);
        }
      } else if (tr && tr.direction === 'inactive') {
        tr.direction = 'recvonly';
      }

      const answer = await rec.pc.createAnswer();
      await rec.pc.setLocalDescription(answer);
      this.sendSignal({
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
      if (rec.pc.signalingState !== 'have-local-offer') return;
      await rec.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      rec.remoteDescriptionSet = true;
      await this.flushPendingIce(rec);
    } catch (err) {
      console.warn('[SelfHostedVoice] handleIncomingAnswer error:', err);
    }
  }

  private async handleIncomingIce(fromPeerId: string, candidate: RTCIceCandidateInit) {
    const rec = this.peers.get(fromPeerId);
    if (!rec || rec.ignoreOffer) return;
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

  // ============================================================================
  // AUTOMATIC WEBSOCKET AUDIO RELAY (When P2P ICE fails on strict 4G/5G NAT)
  // ============================================================================
  private attachRelayEncoder(ctx: AudioContext, src: MediaStreamAudioSourceNode) {
    this.detachRelayEncoder();
    try {
      // 2048 samples @ 48kHz ~= 42ms per callback -> downsampled to 16kHz (~680 bytes mu-law)
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      const muteGain = ctx.createGain();
      muteGain.gain.value = 0;

      const targetRate = 16000;
      const ratio = Math.max(1, ctx.sampleRate / targetRate);

      processor.onaudioprocess = (ev) => {
        if (
          !this.isLiveMicActive ||
          this.desiredMuted ||
          !this.desiredOnSeat ||
          this.transport !== 'websocket' ||
          !this.ws ||
          this.ws.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        // Only stream relay audio frames to peers whose WebRTC P2P hasn't connected yet
        const targets: string[] = [];
        this.peers.forEach((peer, peerId) => {
          if (!peer.p2pConnected || this.relayRequestedByPeers.has(peerId)) {
            targets.push(peerId);
          }
        });
        if (targets.length === 0) return;

        const input = ev.inputBuffer.getChannelData(0);
        const outLen = Math.floor(input.length / ratio);
        if (outLen <= 0) return;

        const encoded = new Uint8Array(outLen);
        let sumSq = 0;
        for (let i = 0; i < outLen; i++) {
          const sample = input[Math.min(input.length - 1, Math.floor(i * ratio))];
          sumSq += sample * sample;
          encoded[i] = linearToMuLaw(sample);
        }
        const rms = Math.sqrt(sumSq / outLen);
        const level = Math.min(100, Math.round(rms * 280));

        // Skip sending pure digital silence when RMS is near zero to save bandwidth
        if (rms < 0.0025) return;

        this.relaySeq += 1;
        this.sendWs({
          type: 'voice:audio_frame',
          targetPeerIds: targets,
          sampleRate: targetRate,
          seq: this.relaySeq,
          level,
          data: uint8ToBase64(encoded),
        });
      };

      src.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(ctx.destination);
      this.relayProcessor = processor;
      this.relayMuteGain = muteGain;
    } catch {
      // Ignore ScriptProcessor fallback errors on restricted environments
    }
  }

  private detachRelayEncoder() {
    if (this.relayProcessor) {
      try {
        this.relayProcessor.onaudioprocess = null;
        this.relayProcessor.disconnect();
      } catch {
        // ignore
      }
      this.relayProcessor = null;
    }
    if (this.relayMuteGain) {
      try {
        this.relayMuteGain.disconnect();
      } catch {
        // ignore
      }
      this.relayMuteGain = null;
    }
  }

  private playIncomingRelayFrame(
    fromPeerId: string,
    fromUserId: string,
    b64Data: string,
    sampleRate: number,
    level: number
  ) {
    if (this.remoteMuted) return;
    const rec = this.peers.get(fromPeerId);
    // If direct WebRTC P2P is already connected and playing audio, skip relay audio to prevent echo!
    if (rec?.p2pConnected) return;

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        this.autoplayBlocked = true;
        this.updateStatus({});
      });
      return;
    }

    try {
      const encoded = base64ToUint8(b64Data);
      if (encoded.length === 0) return;
      const buf = ctx.createBuffer(1, encoded.length, sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < encoded.length; i++) {
        ch[i] = muLawToLinear(encoded[i]);
      }

      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startAt = rec
        ? Math.max(now + 0.02, Math.min(now + 0.25, rec.relayNextPlayTime || now + 0.02))
        : now + 0.02;
      source.start(startAt);

      if (rec) {
        rec.relayNextPlayTime = startAt + buf.duration;
        rec.relayLastLevel = level || 20;
        rec.relayLastLevelAt = Date.now();
        rec.onSeat = true;
        rec.muted = false;
      } else if (fromUserId) {
        this.volumeListeners.forEach((cb) => cb({ [fromUserId]: level || 20 }));
      }
    } catch {
      // Ignore malformed audio frame
    }
  }

  private async releaseLocalMic(): Promise<void> {
    this.setLiveMicActive(false);
    this.detachRelayEncoder();

    const replacePromises: Promise<void>[] = [];
    this.peers.forEach((rec) => {
      const tr = this.getAudioTransceiver(rec.pc);
      if (tr) {
        replacePromises.push(tr.sender.replaceTrack(null).catch(() => {}));
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

  private broadcastMicState(onSeat: boolean, muted: boolean) {
    if (this.transport === 'websocket') {
      this.sendWs({
        type: 'voice:mic_state',
        onSeat,
        muted,
      });
    } else if (
      this.transport === 'firestore_rtc' &&
      this.activeRoomId &&
      this.selfPeerId &&
      this.activeUserId
    ) {
      void publishFirestoreRtcSignal({
        roomId: this.activeRoomId,
        signalType: 'mic_state',
        fromPeerId: this.selfPeerId,
        fromUserId: this.activeUserId,
        displayName: this.activeDisplayName,
        onSeat,
        muted,
      });
    }
  }

  private async applyMicState(onSeat: boolean, muted: boolean, capturedEpoch: number): Promise<void> {
    if (capturedEpoch !== this.joinEpoch) return;

    this.broadcastMicState(onSeat, muted);

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
    if (this.localTrack && this.localTrack.readyState === 'live') {
      this.localTrack.enabled = true;
      await Promise.all(
        Array.from(this.peers.values()).map((rec) => this.syncLocalTrackToPeer(rec, true))
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
          this.attachRelayEncoder(ctx, src);
        } catch {
          // ignore
        }
      }

      this.updateStatus({ micError: null });
      this.setLiveMicActive(true);

      // Attach live mic track & trigger renegotiation for EVERY peer currently in the room!
      await Promise.all(
        Array.from(this.peers.values()).map((rec) => this.syncLocalTrackToPeer(rec, true))
      );
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

  private clearTransportTimers() {
    if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.firestoreHelloTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.firestoreHelloTimer);
      this.firestoreHelloTimer = null;
    }
    if (this.unsubFirestoreSignals) {
      this.unsubFirestoreSignals();
      this.unsubFirestoreSignals = null;
    }
  }

  // ============================================================================
  // AUTOMATIC FIRESTORE REALTIME SIGNALING FALLBACK (For Vercel / Static Hosts)
  // ============================================================================
  private async startFirestoreRtcFallback(
    roomId: string,
    userId: string,
    displayName: string,
    myEpoch: number
  ): Promise<boolean> {
    if (!isCloudWriteReady() || myEpoch !== this.joinEpoch) return false;

    this.transport = 'firestore_rtc';
    this.selfPeerId = `${userId}__fs_${Math.random().toString(36).slice(2, 8)}`;
    this.iceServers = [...DEFAULT_ICE_SERVERS];
    this.activeChannel = roomId;

    const sinceMs = Date.now() - 12000;
    this.unsubFirestoreSignals = subscribeToFirestoreRtcSignals(
      roomId,
      sinceMs,
      (sig: FirestoreRtcSignalPayload) => {
        if (myEpoch !== this.joinEpoch || sig.fromPeerId === this.selfPeerId) return;
        if (sig.targetPeerId && sig.targetPeerId !== this.selfPeerId) return;

        if (sig.signalType === 'hello') {
          const alreadyExisted = this.peers.has(sig.fromPeerId);
          const rec = this.setupPeerConnection({
            peerId: sig.fromPeerId,
            userId: sig.fromUserId,
            displayName: sig.displayName,
            onSeat: Boolean(sig.onSeat),
            muted: Boolean(sig.muted),
          });
          if (!alreadyExisted) {
            // Reply with hello so the other peer sees us, and deterministic initiator sends offer
            void publishFirestoreRtcSignal({
              roomId,
              signalType: 'hello',
              fromPeerId: this.selfPeerId!,
              fromUserId: userId,
              displayName,
              targetPeerId: sig.fromPeerId,
              onSeat: this.desiredOnSeat,
              muted: this.desiredMuted,
            });
            if (!rec.polite) {
              void this.initiateOfferToPeer(rec);
            }
          }
          return;
        }

        if (sig.signalType === 'mic_state') {
          const rec = this.peers.get(sig.fromPeerId);
          if (rec) {
            rec.onSeat = Boolean(sig.onSeat);
            rec.muted = Boolean(sig.muted);
          }
          return;
        }

        if (sig.signalType === 'leave') {
          this.cleanupPeer(sig.fromPeerId);
          return;
        }

        if (sig.signalType === 'offer' && sig.sdp) {
          void this.handleIncomingOffer(sig.fromPeerId, sig.fromUserId, sig.sdp);
          return;
        }

        if (sig.signalType === 'answer' && sig.sdp) {
          void this.handleIncomingAnswer(sig.fromPeerId, sig.sdp);
          return;
        }

        if (sig.signalType === 'ice' && sig.candidate) {
          void this.handleIncomingIce(sig.fromPeerId, sig.candidate);
        }
      }
    );

    // Announce presence into the room
    await publishFirestoreRtcSignal({
      roomId,
      signalType: 'hello',
      fromPeerId: this.selfPeerId,
      fromUserId: userId,
      displayName,
      onSeat: this.desiredOnSeat,
      muted: this.desiredMuted,
    });

    this.startVolumeLoop();
    this.updateStatus({
      state: 'connected',
      channel: roomId,
      errorMessage: null,
      requiresToken: false,
    });

    if (this.desiredOnSeat) {
      await this.applyMicState(this.desiredOnSeat, this.desiredMuted, myEpoch);
    }

    return true;
  }

  private async connectWebSocket(
    roomId: string,
    userId: string,
    displayName: string,
    myEpoch: number
  ): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      if (typeof WebSocket === 'undefined') {
        resolve(false);
        return;
      }

      const wsUrl = getVoiceWebSocketUrl();
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        resolve(false);
        return;
      }
      this.ws = ws;
      let resolved = false;
      const done = (ok: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(ok);
        }
      };

      const timeout = window.setTimeout(() => {
        if (!resolved && ws.readyState !== WebSocket.OPEN) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          done(false);
        }
      }, 4500);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          ws.close();
          done(false);
          return;
        }
        this.transport = 'websocket';
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

          const existingPeers = Array.isArray(msg.peers)
            ? (msg.peers as Array<{
                peerId: string;
                userId: string;
                displayName: string;
                onSeat: boolean;
                muted: boolean;
              }>)
            : [];

          // If we are already seated before joining WS, capture mic first so our initial offer carries audio!
          if (this.desiredOnSeat) {
            await this.applyMicState(this.desiredOnSeat, this.desiredMuted, myEpoch);
          }

          for (const p of existingPeers) {
            const rec = this.setupPeerConnection(p);
            await this.initiateOfferToPeer(rec);
          }

          done(true);
          return;
        }

        if (type === 'voice:peer_joined') {
          const p = msg.peer as
            | {
                peerId: string;
                userId: string;
                displayName: string;
                onSeat: boolean;
                muted: boolean;
              }
            | undefined;
          if (p?.peerId) {
            this.setupPeerConnection(p);
          }
          return;
        }

        if (type === 'voice:peer_updated') {
          const p = msg.peer as
            | {
                peerId: string;
                userId: string;
                displayName: string;
                onSeat: boolean;
                muted: boolean;
              }
            | undefined;
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

        if (type === 'voice:relay_request') {
          const fromPeerId = String(msg.fromPeerId || '');
          const enabled = Boolean(msg.enabled);
          if (fromPeerId) {
            if (enabled) this.relayRequestedByPeers.add(fromPeerId);
            else this.relayRequestedByPeers.delete(fromPeerId);
            this.updateStatus({});
          }
          return;
        }

        if (type === 'voice:audio_frame') {
          const fromPeerId = String(msg.fromPeerId || '');
          const fromUserId = String(msg.fromUserId || '');
          const b64 = typeof msg.data === 'string' ? msg.data : '';
          const sampleRate = Number(msg.sampleRate) || 16000;
          const level = Number(msg.level) || 0;
          if (fromPeerId && b64) {
            this.playIncomingRelayFrame(fromPeerId, fromUserId, b64, sampleRate, level);
          }
          return;
        }

        if (type === 'room:event') {
          const ev = msg.event as RoomLiveEvent | undefined;
          if (ev && ev.id && ev.kind) {
            this.roomEventListeners.forEach((cb) => cb(ev));
          }
          return;
        }

        if (type === 'server:catalog_update') {
          const catalog =
            msg.catalog && typeof msg.catalog === 'object'
              ? (msg.catalog as Record<string, unknown>)
              : undefined;
          if (catalog) {
            this.serverSyncListeners.forEach((cb) =>
              cb({ type: 'server:catalog_update', catalog })
            );
          }
          return;
        }

        if (type === 'server:dashboard_command') {
          const command =
            msg.command && typeof msg.command === 'object'
              ? (msg.command as Record<string, unknown>)
              : null;
          const state =
            msg.state && typeof msg.state === 'object'
              ? (msg.state as Record<string, unknown>)
              : undefined;
          this.serverSyncListeners.forEach((cb) =>
            cb({ type: 'server:dashboard_command', command, state })
          );
          return;
        }

        if (type === 'voice:error') {
          const errMsg = String(msg.message || 'خطأ في سيرفر الصوت.');
          this.emitNotice(errMsg);
          this.updateStatus({ state: 'error', errorMessage: errMsg });
          done(false);
        }
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          done(false);
          return;
        }
        done(false);
      };

      ws.onclose = () => {
        window.clearTimeout(timeout);
        if (this.heartbeatTimer !== null && typeof window !== 'undefined') {
          window.clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        if (myEpoch !== this.joinEpoch || this.ws !== ws) {
          done(false);
          return;
        }
        if (!resolved) {
          done(false);
          return;
        }
        // Auto-reconnect if connection dropped AFTER successful open
        if (this.activeRoomId && this.activeUserId && this.transport === 'websocket') {
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
      if (
        this.activeChannel === cleanRoom &&
        ((this.transport === 'websocket' && this.ws?.readyState === WebSocket.OPEN) ||
          this.transport === 'firestore_rtc')
      ) {
        return;
      }

      await this.internalLeave(false);
      if (myEpoch !== this.joinEpoch) return;

      this.updateStatus({
        state: 'connecting',
        channel: cleanRoom,
        micError: null,
        errorMessage: null,
        requiresToken: false,
      });

      const serverSnapshot = await fetchVoiceServerStatus();
      if (myEpoch !== this.joinEpoch) return;

      const isServerlessHost =
        serverSnapshot?.mode === 'serverless_cloud' ||
        serverSnapshot?.engine === 'firestore_rtc';

      if (!isServerlessHost) {
        const wsConnected = await this.connectWebSocket(
          cleanRoom,
          cleanUid,
          this.activeDisplayName,
          myEpoch
        );
        if (wsConnected || myEpoch !== this.joinEpoch) return;
      }

      // Seamless fallback to Firestore Realtime WebRTC Signaling (e.g., on Vercel / static hosting)
      const fsConnected = await this.startFirestoreRtcFallback(
        cleanRoom,
        cleanUid,
        this.activeDisplayName,
        myEpoch
      );
      if (fsConnected || myEpoch !== this.joinEpoch) return;

      // On serverless/static hosting while browsing as Guest (unauthenticated), do not show a fake server crash error
      if (!isCloudWriteReady()) {
        this.updateStatus({
          state: 'idle',
          channel: cleanRoom,
          errorMessage: this.desiredOnSeat
            ? 'للتحدث عبر المايك على الاستضافة السحابية، سجّل الدخول بحسابك لتفعيل الربط الصوتي.'
            : null,
        });
        return;
      }

      this.updateStatus({
        state: 'error',
        errorMessage: 'تعذر تفعيل الربط الصوتي السحابي لهذه الغرفة، حاول مجدداً.',
      });
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
    const [status, fbStatus] = await Promise.all([
      fetchVoiceServerStatus(),
      testFirebaseConnection(true),
    ]);

    const isServerlessHost =
      status?.mode === 'serverless_cloud' || status?.engine === 'firestore_rtc';

    if (!status || status.status !== 'online' || isServerlessHost) {
      if (isCloudWriteReady() || fbStatus.isConnected) {
        return {
          ok: true,
          message: isCloudWriteReady()
            ? `السيرفر الصوتي السحابي متصل ويعمل عبر Firestore WebRTC (${fbStatus.projectId})!`
            : `الربط السحابي متصل بقاعدة بيانات ${fbStatus.projectId} (${fbStatus.latencyMs ?? 0}ms). سجّل الدخول بحسابك لتفعيل التحدث على المايك.`,
          appId: 'self_hosted_webrtc',
          channel: roomId,
        };
      }
      return {
        ok: false,
        message: 'تعذر الاتصال بخوادم Firebase أو سيرفر الصوت الخاص، تحقق من اتصال الإنترنت.',
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
    if (
      this.transport === 'firestore_rtc' &&
      this.activeRoomId &&
      this.selfPeerId &&
      this.activeUserId
    ) {
      void publishFirestoreRtcSignal({
        roomId: this.activeRoomId,
        signalType: 'leave',
        fromPeerId: this.selfPeerId,
        fromUserId: this.activeUserId,
        displayName: this.activeDisplayName,
      });
    }

    this.clearTransportTimers();
    this.stopVolumeLoop();
    await this.releaseLocalMic();

    Array.from(this.peers.keys()).forEach((peerId) => this.cleanupPeer(peerId));
    this.relayRequestedByPeers.clear();

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

    this.transport = 'idle';
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
