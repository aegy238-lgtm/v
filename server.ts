import "dotenv/config";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import { Readable } from "stream";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import agoraTokenPkg from "agora-token";

const { RtcRole, RtcTokenBuilder } = agoraTokenPkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_AGORA_APP_ID = "d5c272d82b094c2f86ccc75df0819dfe";
const ADMIN_ALLOWLIST_EMAILS = new Set([
  "iejehdgdig@gmail.com",
  "hhsiggidfhkgogfc@gmail.com",
  "uhbijnokmpl098900@gmail.com",
  (process.env.VITE_ADMIN_EMAIL || "aegy238@gmail.com").trim().toLowerCase(),
]);

function readFirebaseWebApiKey(): string {
  try {
    const cfgPath = path.join(__dirname, "firebase-applet-config.json");
    const raw = fs.readFileSync(cfgPath, "utf8");
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
  } catch {
    return "";
  }
}

const FIREBASE_WEB_API_KEY = readFirebaseWebApiKey();

function isValidHex32(val: string): boolean {
  return /^[a-f0-9]{32}$/i.test(val.trim());
}

// Server-only in-memory state for optional Agora Cloud mode (never written to disk or exposed in GETs)
let runtimeAgoraAppId = isValidHex32(process.env.VITE_AGORA_APP_ID || "")
  ? (process.env.VITE_AGORA_APP_ID || "").trim()
  : DEFAULT_AGORA_APP_ID;
let runtimeAgoraCertificate = isValidHex32(process.env.AGORA_APP_CERTIFICATE || "")
  ? (process.env.AGORA_APP_CERTIFICATE || "").trim()
  : "";

async function verifyAdminFirebaseToken(
  authHeader: string | undefined
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { ok: false, error: "مطلوب توكن مصادقة Firebase Admin." };
  }
  if (!FIREBASE_WEB_API_KEY) {
    return { ok: false, error: "إعدادات Firebase API غير متوفرة على الخادم." };
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!resp.ok) {
      return { ok: false, error: "جلسة المصادقة غير صالحة أو منتهية." };
    }
    const data = (await resp.json()) as {
      users?: { email?: string; emailVerified?: boolean }[];
    };
    const user = data.users?.[0];
    const email = (user?.email || "").toLowerCase().trim();
    if (!email || !user?.emailVerified || !ADMIN_ALLOWLIST_EMAILS.has(email)) {
      return { ok: false, error: "هذا الحساب لا يملك صلاحية المسؤول العليا." };
    }
    return { ok: true, email };
  } catch {
    return { ok: false, error: "تعذر التحقق من جلسة المسؤول." };
  }
}

// =============================================================================
// SELF-HOSTED REAL-TIME VOICE SERVER (WebSocket Signaling + Room State)
// =============================================================================
interface VoicePeerSession {
  peerId: string;
  userId: string;
  displayName: string;
  roomId: string;
  onSeat: boolean;
  muted: boolean;
  ws: WebSocket;
  isAlive: boolean;
  joinedAt: number;
}

interface PublicVoicePeer {
  peerId: string;
  userId: string;
  displayName: string;
  onSeat: boolean;
  muted: boolean;
}

function getIceServers() {
  const envServers = process.env.VOICE_ICE_SERVERS?.trim();
  if (envServers) {
    try {
      const parsed = JSON.parse(envServers);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // Fallback to default STUN servers
    }
  }
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];
}

function sanitizeRoomKey(raw: unknown): string {
  const clean = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  return clean;
}

function sanitizeShortString(raw: unknown, maxLen: number): string {
  return String(raw || "").trim().slice(0, maxLen);
}

function sanitizeOptionalMediaUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, 2048);
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed;
  }
  return undefined;
}

function sanitizeRoomLiveEvent(
  rawEvent: unknown,
  session: VoicePeerSession
): Record<string, unknown> | null {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) return null;
  const ev = rawEvent as Record<string, unknown>;
  const kind = sanitizeShortString(ev.kind, 32);
  const allowedKinds = new Set([
    "gift_throw",
    "lucky_bag",
    "rocket_explosion",
    "seat_emoji",
    "chat_message",
  ]);
  if (!allowedKinds.has(kind)) return null;

  const id =
    sanitizeShortString(ev.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_") ||
    `evt_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const createdAt =
    typeof ev.createdAt === "number" && Number.isFinite(ev.createdAt)
      ? ev.createdAt
      : Date.now();

  const base: Record<string, unknown> = {
    id,
    kind,
    roomId: session.roomId,
    senderId: sanitizeShortString(ev.senderId, 64) || session.userId,
    senderName: sanitizeShortString(ev.senderName, 80) || session.displayName,
    senderAvatar: sanitizeOptionalMediaUrl(ev.senderAvatar) || "",
    senderVipLevel: Math.max(0, Math.min(30, Math.round(Number(ev.senderVipLevel) || 0))),
    senderLevel: Math.max(0, Math.min(500, Math.round(Number(ev.senderLevel) || 1))),
    createdAt,
  };

  if (kind === "gift_throw") {
    const rawTargets = Array.isArray(ev.targetSeats) ? ev.targetSeats : [];
    const targetSeats = rawTargets
      .map((n) => Math.round(Number(n)))
      .filter((n) => Number.isFinite(n) && n >= 0 && n < 24)
      .slice(0, 24);
    const rawGift =
      ev.gift && typeof ev.gift === "object" && !Array.isArray(ev.gift)
        ? (ev.gift as Record<string, unknown>)
        : {};
    return {
      ...base,
      targetSeats,
      targetNames: sanitizeShortString(ev.targetNames, 120),
      count: Math.max(1, Math.min(99999, Math.round(Number(ev.count) || 1))),
      comboHits: Math.max(1, Math.min(99999, Math.round(Number(ev.comboHits) || 1))),
      isLucky: Boolean(ev.isLucky),
      luckyMultiplier:
        typeof ev.luckyMultiplier === "number" && Number.isFinite(ev.luckyMultiplier)
          ? Math.max(0, Math.min(10000, Math.round(ev.luckyMultiplier)))
          : undefined,
      luckyWinCoins:
        typeof ev.luckyWinCoins === "number" && Number.isFinite(ev.luckyWinCoins)
          ? Math.max(0, Math.round(ev.luckyWinCoins))
          : undefined,
      gift: {
        id: sanitizeShortString(rawGift.id, 96) || "gift",
        name: sanitizeShortString(rawGift.name, 80) || "Gift",
        nameAr: sanitizeShortString(rawGift.nameAr, 80) || "هدية",
        category: sanitizeShortString(rawGift.category, 32) || "classic",
        coinPrice: Math.max(0, Math.round(Number(rawGift.coinPrice) || 0)),
        diamondReward: Math.max(0, Math.round(Number(rawGift.diamondReward) || 0)),
        icon: sanitizeShortString(rawGift.icon, 24) || "🎁",
        imageUrl: sanitizeOptionalMediaUrl(rawGift.imageUrl),
        videoUrl: sanitizeOptionalMediaUrl(rawGift.videoUrl),
        soundUrl: sanitizeOptionalMediaUrl(rawGift.soundUrl),
        effectDurationSec:
          typeof rawGift.effectDurationSec === "number" && Number.isFinite(rawGift.effectDurationSec)
            ? Math.max(1, Math.min(120, rawGift.effectDurationSec))
            : undefined,
        accentColor: sanitizeShortString(rawGift.accentColor, 32) || "#f59e0b",
        animationType: sanitizeShortString(rawGift.animationType, 32) || "particle",
        soundEffect: sanitizeShortString(rawGift.soundEffect, 32) || "chime",
        isLucky: Boolean(rawGift.isLucky),
      },
    };
  }

  if (kind === "lucky_bag") {
    const rawRewards = Array.isArray(ev.rewardGifts) ? ev.rewardGifts.slice(0, 10) : [];
    const rewardGifts = rawRewards
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const rec = item as Record<string, unknown>;
        return {
          giftId: sanitizeShortString(rec.giftId, 96),
          nameAr: sanitizeShortString(rec.nameAr, 80),
          icon: sanitizeShortString(rec.icon, 24) || "🎁",
          count: Math.max(1, Math.min(9999, Math.round(Number(rec.count) || 1))),
        };
      });
    return {
      ...base,
      tierName: sanitizeShortString(ev.tierName, 80) || "كيس الحظ",
      totalCoinsPool: Math.max(0, Math.round(Number(ev.totalCoinsPool) || 0)),
      rewardGifts,
    };
  }

  if (kind === "rocket_explosion") {
    return {
      ...base,
      rocketLevel: Math.max(1, Math.min(5, Math.round(Number(ev.rocketLevel) || 1))),
      rocketNameAr: sanitizeShortString(ev.rocketNameAr, 80) || "صاروخ الغرفة",
      rocketIcon: sanitizeShortString(ev.rocketIcon, 24) || "🚀",
      rewardCoins: Math.max(0, Math.round(Number(ev.rewardCoins) || 0)),
    };
  }

  if (kind === "seat_emoji") {
    return {
      ...base,
      seatIndex: Math.max(0, Math.min(23, Math.round(Number(ev.seatIndex) || 0))),
      emoji: sanitizeShortString(ev.emoji, 16) || "✨",
    };
  }

  if (kind === "chat_message") {
    const text = sanitizeShortString(ev.text, 500);
    if (!text) return null;
    return {
      ...base,
      text,
      isSystem: Boolean(ev.isSystem),
      timestamp: sanitizeShortString(ev.timestamp, 32),
    };
  }

  return null;
}

function toPublicPeer(peer: VoicePeerSession): PublicVoicePeer {
  return {
    peerId: peer.peerId,
    userId: peer.userId,
    displayName: peer.displayName,
    onSeat: peer.onSeat,
    muted: peer.muted,
  };
}

function safeWsSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore closed socket send errors
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  const server = http.createServer(app);
  const PORT = 3000;
  const startedAt = Date.now();

  // Authoritative voice rooms registry
  const voiceRooms = new Map<string, Map<string, VoicePeerSession>>();
  const socketToSession = new Map<WebSocket, VoicePeerSession>();

  const broadcastToRoom = (
    roomId: string,
    payload: unknown,
    excludePeerId?: string
  ) => {
    const room = voiceRooms.get(roomId);
    if (!room) return;
    room.forEach((peer) => {
      if (excludePeerId && peer.peerId === excludePeerId) return;
      safeWsSend(peer.ws, payload);
    });
  };

  const removePeerSession = (session: VoicePeerSession | undefined) => {
    if (!session) return;
    socketToSession.delete(session.ws);
    const room = voiceRooms.get(session.roomId);
    if (!room) return;
    const existing = room.get(session.peerId);
    if (existing !== session) return;

    room.delete(session.peerId);
    if (room.size === 0) {
      voiceRooms.delete(session.roomId);
    } else {
      broadcastToRoom(session.roomId, {
        type: "voice:peer_left",
        roomId: session.roomId,
        peerId: session.peerId,
        userId: session.userId,
      });
    }
  };

  const wss = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
      if (reqUrl.pathname === "/ws/voice") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      }
      // Leave all non-/ws/voice upgrades untouched
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws: WebSocket) => {
    let session: VoicePeerSession | undefined;
    let audioFramesInWindow = 0;
    let audioWindowStart = Date.now();

    ws.on("pong", () => {
      if (session) session.isAlive = true;
    });

    ws.on("message", (raw) => {
      let msg: Record<string, unknown>;
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
        msg = parsed as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || "");

      if (type === "voice:ping") {
        if (session) session.isAlive = true;
        safeWsSend(ws, { type: "voice:pong", ts: Date.now() });
        return;
      }

      if (type === "voice:join") {
        const roomId = sanitizeRoomKey(msg.roomId);
        const userId = sanitizeShortString(msg.userId, 64);
        const displayName = sanitizeShortString(msg.displayName, 64) || userId;
        const onSeat = Boolean(msg.onSeat);
        const muted = Boolean(msg.muted);

        if (!roomId || !userId) {
          safeWsSend(ws, {
            type: "voice:error",
            message: "بيانات الغرفة أو المستخدم غير صالحة.",
          });
          return;
        }

        // Remove any previous session for this socket
        if (session) {
          removePeerSession(session);
        }

        let room = voiceRooms.get(roomId);
        if (!room) {
          room = new Map<string, VoicePeerSession>();
          voiceRooms.set(roomId, room);
        }

        // Replace stale connection from same userId in the same room to prevent ghost duplicates
        const stalePeers: VoicePeerSession[] = [];
        room.forEach((p) => {
          if (p.userId === userId) stalePeers.push(p);
        });
        stalePeers.forEach((p) => {
          removePeerSession(p);
          try {
            p.ws.close(1000, "replaced_by_new_session");
          } catch {
            // ignore
          }
        });

        // Re-ensure room exists if stale cleanup emptied it
        room = voiceRooms.get(roomId);
        if (!room) {
          room = new Map<string, VoicePeerSession>();
          voiceRooms.set(roomId, room);
        }

        const peerId = `${userId}__${crypto.randomBytes(4).toString("hex")}`;
        session = {
          peerId,
          userId,
          displayName,
          roomId,
          onSeat,
          muted,
          ws,
          isAlive: true,
          joinedAt: Date.now(),
        };

        room.set(peerId, session);
        socketToSession.set(ws, session);

        const existingPeers: PublicVoicePeer[] = [];
        room.forEach((p) => {
          if (p.peerId !== peerId) existingPeers.push(toPublicPeer(p));
        });

        safeWsSend(ws, {
          type: "voice:room_state",
          roomId,
          selfPeerId: peerId,
          peers: existingPeers,
          iceServers: getIceServers(),
        });

        broadcastToRoom(
          roomId,
          {
            type: "voice:peer_joined",
            roomId,
            peer: toPublicPeer(session),
          },
          peerId
        );
        return;
      }

      if (!session) return;

      if (type === "voice:leave") {
        removePeerSession(session);
        session = undefined;
        return;
      }

      if (type === "voice:mic_state") {
        session.onSeat = Boolean(msg.onSeat);
        session.muted = Boolean(msg.muted);
        broadcastToRoom(
          session.roomId,
          {
            type: "voice:peer_updated",
            roomId: session.roomId,
            peer: toPublicPeer(session),
          },
          session.peerId
        );
        return;
      }

      if (type === "voice:speaking") {
        const level = Math.max(0, Math.min(100, Math.round(Number(msg.level) || 0)));
        broadcastToRoom(
          session.roomId,
          {
            type: "voice:speaking",
            roomId: session.roomId,
            userId: session.userId,
            peerId: session.peerId,
            level,
          },
          session.peerId
        );
        return;
      }

      // Server-Relayed Live Voice Frame (Automatic NAT/Firewall Fallback when WebRTC ICE cannot traverse)
      if (type === "voice:audio_frame") {
        if (!session.onSeat || session.muted) return;
        const now = Date.now();
        if (now - audioWindowStart >= 1000) {
          audioWindowStart = now;
          audioFramesInWindow = 0;
        }
        audioFramesInWindow += 1;
        if (audioFramesInWindow > 35) return; // Rate limit guard

        const pcmB64 = typeof msg.data === "string" ? msg.data : "";
        if (!pcmB64 || pcmB64.length > 24000) return;
        const sampleRate = Math.max(8000, Math.min(48000, Math.round(Number(msg.sampleRate) || 16000)));
        const seq = Math.max(0, Math.round(Number(msg.seq) || 0));
        const level = Math.max(0, Math.min(100, Math.round(Number(msg.level) || 0)));
        const targetPeerIds = Array.isArray(msg.targetPeerIds)
          ? (msg.targetPeerIds as unknown[])
              .map((id) => sanitizeShortString(id, 96))
              .filter(Boolean)
              .slice(0, 64)
          : null;

        const room = voiceRooms.get(session.roomId);
        if (!room) return;

        const relayPayload = {
          type: "voice:audio_frame",
          roomId: session.roomId,
          fromPeerId: session.peerId,
          fromUserId: session.userId,
          sampleRate,
          seq,
          level,
          data: pcmB64,
        };

        if (targetPeerIds && targetPeerIds.length > 0) {
          targetPeerIds.forEach((targetId) => {
            if (targetId === session!.peerId) return;
            const target = room.get(targetId);
            if (target) safeWsSend(target.ws, relayPayload);
          });
        } else {
          broadcastToRoom(session.roomId, relayPayload, session.peerId);
        }
        return;
      }

      // Request server-relay voice mode from a specific peer (e.g. if P2P ICE failed)
      if (type === "voice:relay_request") {
        const targetPeerId = sanitizeShortString(msg.targetPeerId, 96);
        const enabled = Boolean(msg.enabled);
        const room = voiceRooms.get(session.roomId);
        if (!room) return;
        if (targetPeerId) {
          const target = room.get(targetPeerId);
          if (target) {
            safeWsSend(target.ws, {
              type: "voice:relay_request",
              roomId: session.roomId,
              fromPeerId: session.peerId,
              enabled,
            });
          }
        } else {
          broadcastToRoom(
            session.roomId,
            {
              type: "voice:relay_request",
              roomId: session.roomId,
              fromPeerId: session.peerId,
              enabled,
            },
            session.peerId
          );
        }
        return;
      }

      // Real-Time Room Live Events (Gifts, Lucky Bags, Rocket, Seat Emojis, Chat)
      if (type === "room:event") {
        const cleanEvent = sanitizeRoomLiveEvent(msg.event, session);
        if (!cleanEvent) return;
        broadcastToRoom(
          session.roomId,
          {
            type: "room:event",
            roomId: session.roomId,
            event: cleanEvent,
          },
          session.peerId
        );
        return;
      }

      if (type === "voice:offer" || type === "voice:answer" || type === "voice:ice") {
        const targetPeerId = sanitizeShortString(msg.targetPeerId, 96);
        if (!targetPeerId) return;
        const room = voiceRooms.get(session.roomId);
        const targetPeer = room?.get(targetPeerId);
        if (!targetPeer) return;

        safeWsSend(targetPeer.ws, {
          type,
          roomId: session.roomId,
          fromPeerId: session.peerId,
          fromUserId: session.userId,
          sdp: msg.sdp,
          candidate: msg.candidate,
        });
      }
    });

    ws.on("close", () => {
      removePeerSession(session);
      session = undefined;
    });

    ws.on("error", () => {
      removePeerSession(session);
      session = undefined;
    });
  });

  const heartbeatInterval = setInterval(() => {
    socketToSession.forEach((sess) => {
      if (!sess.isAlive) {
        try {
          sess.ws.terminate();
        } catch {
          // ignore
        }
        removePeerSession(sess);
        return;
      }
      sess.isAlive = false;
      try {
        sess.ws.ping();
      } catch {
        removePeerSession(sess);
      }
    });
  }, 25000);

  server.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  // REST API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ip", (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    res.json({ ip });
  });

  // SSRF-Safe CORS Media Proxy for VAP / MP4 / WebM / APNG gift rendering in WebGL
  const isPrivateOrReservedIp = (ip: string): boolean => {
    if (net.isIPv4(ip)) {
      const parts = ip.split(".").map(Number);
      if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
      const [a, b] = parts;
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a >= 224) return true;
      return false;
    }
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (
        lower === "::1" ||
        lower === "::" ||
        lower.startsWith("fc") ||
        lower.startsWith("fd") ||
        lower.startsWith("fe80:") ||
        lower.startsWith("::ffff:127.") ||
        lower.startsWith("::ffff:10.") ||
        lower.startsWith("::ffff:192.168.") ||
        lower.startsWith("::ffff:169.254.")
      ) {
        return true;
      }
      return false;
    }
    return true;
  };

  app.get("/api/media-proxy", async (req, res) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: "رابط الوسائط غير صالح." });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: "صيغة الرابط غير صالحة." });
      return;
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      res.status(400).json({ error: "يُسمح فقط بروابط HTTP/HTTPS." });
      return;
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "metadata.google.internal"
    ) {
      res.status(403).json({ error: "النطاق غير مسموح به." });
      return;
    }

    try {
      const resolved = await dns.lookup(host, { all: true });
      if (!resolved.length || resolved.some((entry) => isPrivateOrReservedIp(entry.address))) {
        res.status(403).json({ error: "عنوان الخادم غير مسموح به." });
        return;
      }
    } catch {
      res.status(400).json({ error: "تعذر الوصول إلى النطاق." });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const upstreamHeaders: Record<string, string> = {
        "User-Agent": "AuraVoiceMediaProxy/1.0",
        Accept: "video/*,image/*,application/octet-stream,*/*;q=0.8",
      };
      if (typeof req.headers.range === "string") {
        upstreamHeaders.Range = req.headers.range;
      }

      const upstream = await fetch(parsed.toString(), {
        method: "GET",
        headers: upstreamHeaders,
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).end();
        return;
      }

      const ct = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
      const isAllowedType =
        ct.startsWith("video/") ||
        ct.startsWith("image/") ||
        ct.startsWith("audio/") ||
        ct.includes("octet-stream") ||
        ct.includes("mp4");
      if (!isAllowedType) {
        res.status(415).json({ error: "نوع الملف غير مدعوم." });
        return;
      }

      const contentLength = Number(upstream.headers.get("content-length") || "0");
      if (contentLength > 45 * 1024 * 1024) {
        res.status(413).json({ error: "حجم الملف أكبر من الحد المسموح." });
        return;
      }

      res.status(upstream.status);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Content-Type", ct.includes("octet-stream") && rawUrl.toLowerCase().includes("vap") ? "video/mp4" : ct);
      res.setHeader("Cache-Control", "public, max-age=3600");

      const passthroughHeaders = ["content-length", "content-range", "accept-ranges", "etag"];
      passthroughHeaders.forEach((h) => {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      });

      if (!upstream.body) {
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import("stream/web").ReadableStream);
      nodeStream.on("error", () => {
        if (!res.headersSent) res.status(502).end();
        else res.end();
      });
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ error: "تعذر تحميل ملف الوسائط." });
      }
    }
  });

  app.get("/api/voice-server/status", (_req, res) => {
    let activePeersCount = 0;
    let activeSpeakersCount = 0;
    const roomsSummary: { roomId: string; peersCount: number; speakersCount: number }[] = [];

    voiceRooms.forEach((peers, roomId) => {
      let speakers = 0;
      peers.forEach((p) => {
        activePeersCount++;
        if (p.onSeat && !p.muted) {
          activeSpeakersCount++;
          speakers++;
        }
      });
      roomsSummary.push({ roomId, peersCount: peers.size, speakersCount: speakers });
    });

    res.json({
      status: "online",
      engine: "self_hosted_webrtc",
      wsPath: "/ws/voice",
      activeRoomsCount: voiceRooms.size,
      activePeersCount,
      activeSpeakersCount,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      rooms: roomsSummary,
    });
  });

  // Optional Agora Cloud endpoints (kept clean & secure via official agora-token)
  app.get("/api/agora/status", (_req, res) => {
    const envCert = isValidHex32(process.env.AGORA_APP_CERTIFICATE || "");
    const hasCertificate = isValidHex32(runtimeAgoraCertificate);
    res.json({
      appId: runtimeAgoraAppId,
      hasCertificate,
      certificateSource: envCert ? "env" : hasCertificate ? "runtime" : "none",
      mode: hasCertificate ? "secured_token" : "testing_app_id",
    });
  });

  app.post("/api/agora/certificate", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }

    const body = (req.body || {}) as { appId?: unknown; appCertificate?: unknown };
    const nextCert = typeof body.appCertificate === "string" ? body.appCertificate.trim() : "";
    const nextAppId = typeof body.appId === "string" ? body.appId.trim() : "";

    if (nextAppId && !isValidHex32(nextAppId)) {
      res.status(400).json({ error: "معرّف App ID يجب أن يكون 32 حرفاً سداسياً (hex)." });
      return;
    }
    if (nextCert && !isValidHex32(nextCert)) {
      res.status(400).json({ error: "شهادة App Certificate يجب أن تكون 32 حرفاً سداسياً (hex)." });
      return;
    }

    if (nextAppId) runtimeAgoraAppId = nextAppId;
    runtimeAgoraCertificate = nextCert;

    const envCert = isValidHex32(process.env.AGORA_APP_CERTIFICATE || "");
    const hasCertificate = isValidHex32(runtimeAgoraCertificate);
    res.json({
      ok: true,
      appId: runtimeAgoraAppId,
      hasCertificate,
      certificateSource: envCert && nextCert === (process.env.AGORA_APP_CERTIFICATE || "").trim()
        ? "env"
        : hasCertificate
        ? "runtime"
        : "none",
      mode: hasCertificate ? "secured_token" : "testing_app_id",
    });
  });

  app.get("/api/agora/token", (req, res) => {
    const queryAppId = typeof req.query.appId === "string" ? req.query.appId.trim() : "";
    const appId = isValidHex32(queryAppId) ? queryAppId : runtimeAgoraAppId;
    const appCertificate = isValidHex32(runtimeAgoraCertificate) ? runtimeAgoraCertificate : "";
    const channel = sanitizeRoomKey(req.query.channel);
    const uid = sanitizeShortString(req.query.uid || "0", 64) || "0";

    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }

    if (!appCertificate) {
      res.json({ mode: "testing", appId, token: null });
      return;
    }

    const tokenExpire = 86400;
    const privilegeExpire = 86400;
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      tokenExpire,
      privilegeExpire
    );

    res.json({ mode: "secured", appId, token });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const disableHmr = process.env.DISABLE_HMR === "true";
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: disableHmr ? false : { server },
        hmr: !disableHmr,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server + Self-Hosted Voice Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
