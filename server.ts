import "dotenv/config";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
