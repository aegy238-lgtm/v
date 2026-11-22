import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_AGORA_APP_ID = "d5c272d82b094c2f86ccc75df0819dfe";

function packU16(v: number): Buffer {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(v, 0);
  return b;
}

function packU32(v: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(v >>> 0, 0);
  return b;
}

function packStr(s: string): Buffer {
  const raw = Buffer.from(s, "utf8");
  return Buffer.concat([packU16(raw.length), raw]);
}

function packMapU32(entries: [number, number][]): Buffer {
  const parts: Buffer[] = [packU16(entries.length)];
  for (const [k, v] of entries) {
    parts.push(packU16(k), packU32(v));
  }
  return Buffer.concat(parts);
}

function buildAgoraRtcToken007(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  expireSeconds = 86400
): string {
  const issueTs = Math.floor(Date.now() / 1000);
  const salt = crypto.randomInt(1, 99999999);
  const expireTs = issueTs + expireSeconds;

  const servicePayload = Buffer.concat([
    packU16(1),
    packMapU32([
      [1, expireTs],
      [2, expireTs],
      [3, expireTs],
      [4, expireTs],
    ]),
    packStr(channelName),
    packStr(uid),
  ]);

  const signing = Buffer.concat([
    packStr(appId),
    packU32(issueTs),
    packU32(expireSeconds),
    packU32(salt),
    packU16(1),
    servicePayload,
  ]);

  let sigKey = crypto.createHmac("sha256", packU32(issueTs)).update(appCertificate).digest();
  sigKey = crypto.createHmac("sha256", packU32(salt)).update(sigKey).digest();
  const signature = crypto.createHmac("sha256", sigKey).update(signing).digest();

  const content = Buffer.concat([packU16(signature.length), signature, signing]);
  const compressed = zlib.deflateSync(content);
  return `007${compressed.toString("base64")}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ip", (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    res.json({ ip });
  });

  app.get("/api/agora/status", (req, res) => {
    const appId = (process.env.VITE_AGORA_APP_ID || DEFAULT_AGORA_APP_ID).trim();
    const hasCertificate = Boolean(process.env.AGORA_APP_CERTIFICATE?.trim());
    res.json({
      appId,
      hasCertificate,
      mode: hasCertificate ? "secured_token" : "testing_app_id",
    });
  });

  app.get("/api/agora/token", (req, res) => {
    const appId = (process.env.VITE_AGORA_APP_ID || DEFAULT_AGORA_APP_ID).trim();
    const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim() || "";
    const channel = String(req.query.channel || "").trim();
    const uid = String(req.query.uid || "0").trim();

    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }

    if (!appCertificate) {
      res.json({ mode: "testing", appId, token: null });
      return;
    }

    const token = buildAgoraRtcToken007(appId, appCertificate, channel, uid, 86400);
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
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
