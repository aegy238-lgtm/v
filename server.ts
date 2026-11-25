import "dotenv/config";
import http from "http";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import os from "os";
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
const DEFAULT_OWNER_ADMIN_EMAIL = "hhsiggidfhkgogfc@gmail.com";
const ADMIN_ALLOWLIST_EMAILS = new Set(
  [
    DEFAULT_OWNER_ADMIN_EMAIL,
    (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    (process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase(),
  ].filter(Boolean)
);

// =============================================================================
// PERSISTENT SERVER DATA STORAGE (Bundled Version Snapshot + Writable Data Dir)
// =============================================================================
const BUNDLED_CATALOG_FILE = path.join(__dirname, "src", "data", "serverCatalogSnapshot.json");
const TMP_RUNTIME_DATA_DIR = path.join(os.tmpdir(), "fokashat-runtime-data");
const WORKSPACE_DATA_DIR = path.join(__dirname, "data");

function resolveWritableDataDir(): string {
  const envDir = (process.env.FOKASHAT_DATA_DIR || "").trim();
  if (envDir) return envDir;
  try {
    if (!fs.existsSync(WORKSPACE_DATA_DIR)) {
      fs.mkdirSync(WORKSPACE_DATA_DIR, { recursive: true, mode: 0o700 });
    }
    fs.accessSync(WORKSPACE_DATA_DIR, fs.constants.W_OK);
    return WORKSPACE_DATA_DIR;
  } catch {
    return TMP_RUNTIME_DATA_DIR;
  }
}

const SERVER_DATA_DIR = resolveWritableDataDir();
const ADMIN_AUTH_FILE = path.join(SERVER_DATA_DIR, "admin-auth.json");
const CATALOG_FILE = path.join(SERVER_DATA_DIR, "catalog.json");
const DASHBOARD_STATE_FILE = path.join(SERVER_DATA_DIR, "dashboard-state.json");

function ensureServerDataDir(): void {
  try {
    if (!fs.existsSync(SERVER_DATA_DIR)) {
      fs.mkdirSync(SERVER_DATA_DIR, { recursive: true, mode: 0o700 });
    }
  } catch (err) {
    console.warn("Could not ensure server data directory:", err);
  }
}

function writeJsonAtomic(filePath: string, data: unknown, mode = 0o600): void {
  ensureServerDataDir();
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: "utf8", mode });
  fs.renameSync(tmpPath, filePath);
}

// =============================================================================
// SERVER-SIDE ADMIN EMAIL + PASSWORD AUTH (scrypt + HMAC-SHA256 Bearer Tokens)
// =============================================================================
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface ClaimedAdminCredential {
  email: string;
  displayName: string;
  saltHex: string;
  hashHex: string;
  claimedAt: number;
}

interface PersistedAdminAuthFile {
  sessionSecret?: string;
  claimedAdminCredential?: ClaimedAdminCredential | null;
}

function loadPersistedAdminAuth(): PersistedAdminAuthFile {
  const candidates = [ADMIN_AUTH_FILE, path.join(TMP_RUNTIME_DATA_DIR, "admin-auth.json")];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, "utf8");
        const parsed = JSON.parse(raw) as PersistedAdminAuthFile;
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Could not read persisted admin auth file:", err);
    }
  }
  return {};
}

const persistedAdminAuth = loadPersistedAdminAuth();

const ADMIN_SESSION_SECRET =
  (process.env.ADMIN_SESSION_SECRET || "").trim() ||
  (typeof persistedAdminAuth.sessionSecret === "string" &&
  persistedAdminAuth.sessionSecret.length >= 32
    ? persistedAdminAuth.sessionSecret
    : crypto.randomBytes(32).toString("hex"));

// Persisted scrypt-hashed admin credential (survives server restarts; overridden by process.env.ADMIN_PASSWORD)
let claimedAdminCredential: ClaimedAdminCredential | null =
  persistedAdminAuth.claimedAdminCredential &&
  typeof persistedAdminAuth.claimedAdminCredential.email === "string" &&
  typeof persistedAdminAuth.claimedAdminCredential.saltHex === "string" &&
  typeof persistedAdminAuth.claimedAdminCredential.hashHex === "string"
    ? persistedAdminAuth.claimedAdminCredential
    : null;

function savePersistedAdminAuth(): void {
  try {
    writeJsonAtomic(
      ADMIN_AUTH_FILE,
      {
        sessionSecret: ADMIN_SESSION_SECRET,
        claimedAdminCredential,
      },
      0o600
    );
  } catch (err) {
    console.warn("Could not persist admin auth file:", err);
  }
}

// Persist stable session secret on startup so active sessions survive restarts
if (!persistedAdminAuth.sessionSecret) {
  savePersistedAdminAuth();
}

// Sliding-window rate limit per IP for FAILED admin auth attempts only
const adminAuthFailures = new Map<string, number[]>();
const ADMIN_AUTH_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_AUTH_MAX_FAILURES = 20;

function isAdminAuthRateLimited(ipKey: string): boolean {
  const now = Date.now();
  const prev = (adminAuthFailures.get(ipKey) || []).filter(
    (ts) => now - ts < ADMIN_AUTH_WINDOW_MS
  );
  adminAuthFailures.set(ipKey, prev);
  return prev.length >= ADMIN_AUTH_MAX_FAILURES;
}

function recordAdminAuthFailure(ipKey: string): void {
  const now = Date.now();
  const prev = (adminAuthFailures.get(ipKey) || []).filter(
    (ts) => now - ts < ADMIN_AUTH_WINDOW_MS
  );
  prev.push(now);
  adminAuthFailures.set(ipKey, prev);
}

function clearAdminAuthFailures(ipKey: string): void {
  adminAuthFailures.delete(ipKey);
}

function getEnvAdminConfig(): { email: string; password: string } | null {
  const envPass = (process.env.ADMIN_PASSWORD || "").trim();
  if (!envPass) return null;
  const envEmail = (
    process.env.ADMIN_EMAIL ||
    process.env.VITE_ADMIN_EMAIL ||
    DEFAULT_OWNER_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();
  return { email: envEmail, password: envPass };
}

function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 180;
}

function hashPasswordScrypt(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString("hex");
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const digestA = crypto.createHash("sha256").update(a, "utf8").digest();
  const digestB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function signAdminSessionToken(payload: {
  email: string;
  displayName: string;
  exp: number;
}): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  return `adm1.${encoded}.${sig}`;
}

// =============================================================================
// AUTHORITATIVE MULTI-USER CATALOG & DASHBOARD COMMAND ENGINE
// =============================================================================
interface ServerCatalogState {
  version: number;
  updatedAt: string;
  gifts: Record<string, unknown>[];
  storeItems: Record<string, unknown>[];
  roomBackgrounds: Record<string, unknown>[];
  deletedGiftIds: string[];
  deletedStoreIds: string[];
  deletedBackgroundIds: string[];
}

interface ServerDashboardCommand {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  issuedBy: string;
  createdAt: number;
}

interface ServerDashboardState {
  version: number;
  updatedAt: string;
  luckyConfig: Record<string, unknown> | null;
  agoraConfig: Record<string, unknown> | null;
  userOverrides: Record<string, Record<string, unknown>>;
  closedRoomIds: string[];
  customRooms: Record<string, unknown>[];
  roomModOverrides: Record<string, { moderators: string[]; bannedUserIds?: string[]; updatedAt: string }>;
  agents: Record<string, unknown>[];
  agencyStatusOverrides: Record<string, { status: string; updatedAt: string }>;
  adminTransactions: Record<string, unknown>[];
  recentCommands: ServerDashboardCommand[];
}

const LEGACY_MOCK_GIFT_IDS = new Set([
  "g_lollipop",
  "g_rose",
  "g_heart_ring",
  "g_crown",
  "g_luxury_car",
  "g_private_jet",
  "g_royal_castle",
  "g_dragon_aura",
  "g_coffee",
  "g_heart",
  "g_perfume",
  "g_ring",
  "g_sports_car",
  "g_yacht",
  "g_castle",
  "g_dragon",
  "g_falcon",
  "g_jet",
  "g_lucky_box",
  "g_lucky_clover",
  "g_lucky_star",
]);

const LEGACY_MOCK_STORE_IDS = new Set([
  "f_gold",
  "f_royal",
  "f_cyber",
  "f_dragon",
  "f_diamond",
  "f_neon",
  "f_phoenix",
  "e_lambo",
  "e_pegasus",
  "e_throne",
  "e_sports_car",
  "e_dragon",
  "e_falcon",
  "e_yacht",
  "e_royal_carriage",
  "e_jet",
  "b_king",
  "b_legend",
  "b_vip_diamond",
  "bu_gold",
  "bu_neon",
]);

function sanitizeCatalogMediaUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 15 * 1024 * 1024) return undefined;
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:video/") ||
    trimmed.startsWith("data:audio/") ||
    trimmed.startsWith("data:application/octet-stream")
  ) {
    return trimmed;
  }
  return undefined;
}

function sanitizeCatalogGift(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const g = raw as Record<string, unknown>;
  const id = sanitizeShortString(g.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!id || id === "gift_starter_default" || LEGACY_MOCK_GIFT_IDS.has(id) || g.isStarterDefault) {
    return null;
  }
  const nameAr = sanitizeShortString(g.nameAr || g.name, 100);
  if (!nameAr) return null;
  const allowedCats = new Set(["classic", "luxury", "romantic", "magic", "vip", "lucky", "cp", "celebrity"]);
  const catRaw = sanitizeShortString(g.category, 24);
  const category = allowedCats.has(catRaw) ? catRaw : "classic";
  const allowedAnim = new Set([
    "float",
    "particle",
    "svga",
    "explosion",
    "luxury_banner",
    "fullscreen_dragon",
    "lollipop_matrix",
  ]);
  const animRaw = sanitizeShortString(g.animationType, 32);
  const animationType = allowedAnim.has(animRaw) ? animRaw : "luxury_banner";
  const allowedSound = new Set([
    "chime",
    "fanfare",
    "roar",
    "sparkle",
    "magic",
    "laser",
    "applause",
    "slot",
    "dice",
  ]);
  const sndRaw = sanitizeShortString(g.soundEffect, 24);
  const soundEffect = allowedSound.has(sndRaw) ? sndRaw : "chime";

  const out: Record<string, unknown> = {
    id,
    name: sanitizeShortString(g.name || nameAr, 100) || nameAr,
    nameAr,
    category,
    coinPrice: Math.max(1, Math.min(1000000000, Math.round(Number(g.coinPrice) || 100))),
    diamondReward: Math.max(0, Math.min(1000000000, Math.round(Number(g.diamondReward) || 0))),
    icon: sanitizeShortString(g.icon, 24) || "🎁",
    accentColor: sanitizeShortString(g.accentColor, 32) || "#f59e0b",
    animationType,
    soundEffect,
    descriptionAr: sanitizeShortString(g.descriptionAr, 240) || "هدية حصرية من الإدارة",
    isLucky: Boolean(g.isLucky || category === "lucky"),
    updatedAt: typeof g.updatedAt === "string" && g.updatedAt ? g.updatedAt : new Date().toISOString(),
  };

  const imageUrl = sanitizeCatalogMediaUrl(g.imageUrl);
  const videoUrl = sanitizeCatalogMediaUrl(g.videoUrl);
  const soundUrl = sanitizeCatalogMediaUrl(g.soundUrl);
  if (imageUrl) out.imageUrl = imageUrl;
  if (videoUrl) out.videoUrl = videoUrl;
  if (soundUrl) out.soundUrl = soundUrl;
  if (
    typeof g.effectDurationSec === "number" &&
    Number.isFinite(g.effectDurationSec) &&
    g.effectDurationSec >= 1 &&
    g.effectDurationSec <= 120
  ) {
    out.effectDurationSec = Math.round(g.effectDurationSec * 10) / 10;
  }
  return out;
}

function sanitizeCatalogStoreItem(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = sanitizeShortString(item.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!id || LEGACY_MOCK_STORE_IDS.has(id)) return null;
  const nameAr = sanitizeShortString(item.nameAr || item.nameEn || item.name, 100);
  if (!nameAr) return null;
  const allowedTypes = new Set(["frame", "entrance", "badge", "bubble"]);
  const typeRaw = sanitizeShortString(item.type, 24);
  if (!allowedTypes.has(typeRaw)) return null;

  const resolvedEn = sanitizeShortString(item.nameEn || item.name || nameAr, 100) || nameAr;
  const out: Record<string, unknown> = {
    id,
    type: typeRaw,
    name: resolvedEn,
    nameEn: resolvedEn,
    nameAr,
    priceCoins: Math.max(0, Math.min(1000000000, Math.round(Number(item.priceCoins) || 0))),
    durationDays: Math.max(1, Math.min(3650, Math.round(Number(item.durationDays) || 30))),
    icon: sanitizeShortString(item.icon, 24) || "✨",
    accentColor: sanitizeShortString(item.accentColor, 32) || "#f59e0b",
    descriptionAr: sanitizeShortString(item.descriptionAr, 240) || "عنصر حصري من المتجر",
    updatedAt:
      typeof item.updatedAt === "string" && item.updatedAt
        ? item.updatedAt
        : new Date().toISOString(),
  };
  if (typeof item.previewGradient === "string" && item.previewGradient.trim()) {
    out.previewGradient = sanitizeShortString(item.previewGradient, 120);
  }
  const previewUrl = sanitizeCatalogMediaUrl(item.previewUrl);
  const videoUrl = sanitizeCatalogMediaUrl(item.videoUrl);
  if (previewUrl) out.previewUrl = previewUrl;
  if (videoUrl) out.videoUrl = videoUrl;
  if (
    typeof item.effectDurationSec === "number" &&
    Number.isFinite(item.effectDurationSec) &&
    item.effectDurationSec >= 1 &&
    item.effectDurationSec <= 120
  ) {
    out.effectDurationSec = Math.round(item.effectDurationSec * 10) / 10;
  }
  return out;
}

function sanitizeCatalogBackground(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const bg = raw as Record<string, unknown>;
  const id = sanitizeShortString(bg.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
  const imageUrl = sanitizeCatalogMediaUrl(bg.imageUrl);
  if (!id || !imageUrl) return null;
  return {
    id,
    nameAr: sanitizeShortString(bg.nameAr, 100) || "خلفية غرفة مخصصة",
    imageUrl,
    createdAt: sanitizeShortString(bg.createdAt, 32) || new Date().toISOString().slice(0, 10),
    updatedAt:
      typeof bg.updatedAt === "string" && bg.updatedAt ? bg.updatedAt : new Date().toISOString(),
  };
}

function parseCatalogFileContent(rawContent: string): Partial<ServerCatalogState> | null {
  try {
    const parsed = JSON.parse(rawContent) as Partial<ServerCatalogState>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function loadServerCatalog(): ServerCatalogState {
  const candidates = [
    CATALOG_FILE,
    path.join(TMP_RUNTIME_DATA_DIR, "catalog.json"),
    BUNDLED_CATALOG_FILE,
  ];

  let primaryParsed: Partial<ServerCatalogState> | null = null;
  let snapshotParsed: Partial<ServerCatalogState> | null = null;

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const parsed = parseCatalogFileContent(fs.readFileSync(filePath, "utf8"));
    if (!parsed) continue;
    if (filePath === BUNDLED_CATALOG_FILE) {
      snapshotParsed = parsed;
    } else if (!primaryParsed) {
      primaryParsed = parsed;
    }
  }

  const base = primaryParsed || snapshotParsed || {};
  const deletedGiftIds = Array.isArray(base.deletedGiftIds)
    ? base.deletedGiftIds.map((id) => String(id)).slice(0, 500)
    : [];
  const deletedStoreIds = Array.isArray(base.deletedStoreIds)
    ? base.deletedStoreIds.map((id) => String(id)).slice(0, 500)
    : [];
  const deletedBackgroundIds = Array.isArray(base.deletedBackgroundIds)
    ? base.deletedBackgroundIds.map((id) => String(id)).slice(0, 500)
    : [];

  const deletedGiftSet = new Set(deletedGiftIds);
  const deletedStoreSet = new Set(deletedStoreIds);
  const deletedBgSet = new Set(deletedBackgroundIds);

  const mergeLists = (
    firstRaw: unknown[] | undefined,
    secondRaw: unknown[] | undefined,
    sanitizer: (x: unknown) => Record<string, unknown> | null,
    deletedSet: Set<string>
  ): Record<string, unknown>[] => {
    const out: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const list of [firstRaw || [], secondRaw || []]) {
      for (const item of list) {
        const clean = sanitizer(item);
        if (!clean) continue;
        const id = String(clean.id);
        if (deletedSet.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(clean);
      }
    }
    return out;
  };

  const gifts = mergeLists(
    Array.isArray(primaryParsed?.gifts) ? primaryParsed.gifts : [],
    Array.isArray(snapshotParsed?.gifts) ? snapshotParsed.gifts : [],
    sanitizeCatalogGift,
    deletedGiftSet
  );
  const storeItems = mergeLists(
    Array.isArray(primaryParsed?.storeItems) ? primaryParsed.storeItems : [],
    Array.isArray(snapshotParsed?.storeItems) ? snapshotParsed.storeItems : [],
    sanitizeCatalogStoreItem,
    deletedStoreSet
  );
  const roomBackgrounds = mergeLists(
    Array.isArray(primaryParsed?.roomBackgrounds) ? primaryParsed.roomBackgrounds : [],
    Array.isArray(snapshotParsed?.roomBackgrounds) ? snapshotParsed.roomBackgrounds : [],
    sanitizeCatalogBackground,
    deletedBgSet
  );

  return {
    version: typeof base.version === "number" ? base.version : 1,
    updatedAt: typeof base.updatedAt === "string" ? base.updatedAt : new Date().toISOString(),
    gifts,
    storeItems,
    roomBackgrounds,
    deletedGiftIds,
    deletedStoreIds,
    deletedBackgroundIds,
  };
}

function loadServerDashboardState(): ServerDashboardState {
  const candidates = [
    DASHBOARD_STATE_FILE,
    path.join(TMP_RUNTIME_DATA_DIR, "dashboard-state.json"),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<ServerDashboardState>;
        if (parsed && typeof parsed === "object") {
          return {
            version: typeof parsed.version === "number" ? parsed.version : 1,
            updatedAt:
              typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
            luckyConfig:
              parsed.luckyConfig && typeof parsed.luckyConfig === "object"
                ? parsed.luckyConfig
                : null,
            agoraConfig:
              parsed.agoraConfig && typeof parsed.agoraConfig === "object"
                ? parsed.agoraConfig
                : null,
            userOverrides:
              parsed.userOverrides && typeof parsed.userOverrides === "object"
                ? parsed.userOverrides
                : {},
            closedRoomIds: Array.isArray(parsed.closedRoomIds)
              ? parsed.closedRoomIds.map(String).slice(-300)
              : [],
            customRooms: Array.isArray(parsed.customRooms) ? parsed.customRooms.slice(-200) : [],
            roomModOverrides:
              parsed.roomModOverrides && typeof parsed.roomModOverrides === "object"
                ? parsed.roomModOverrides
                : {},
            agents: Array.isArray(parsed.agents) ? parsed.agents.slice(-200) : [],
            agencyStatusOverrides:
              parsed.agencyStatusOverrides && typeof parsed.agencyStatusOverrides === "object"
                ? parsed.agencyStatusOverrides
                : {},
            adminTransactions: Array.isArray(parsed.adminTransactions)
              ? parsed.adminTransactions.slice(0, 100)
              : [],
            recentCommands: Array.isArray(parsed.recentCommands)
              ? parsed.recentCommands.slice(0, 100)
              : [],
          };
        }
      }
    } catch (err) {
      console.warn("Could not read server dashboard state file:", err);
    }
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    luckyConfig: null,
    agoraConfig: null,
    userOverrides: {},
    closedRoomIds: [],
    customRooms: [],
    roomModOverrides: {},
    agents: [],
    agencyStatusOverrides: {},
    adminTransactions: [],
    recentCommands: [],
  };
}

let serverCatalog: ServerCatalogState = loadServerCatalog();
let serverDashboardState: ServerDashboardState = loadServerDashboardState();
const catalogSseClients = new Set<express.Response>();
let broadcastWsEventToAll: ((payload: unknown) => void) | null = null;

function broadcastSseEvent(eventName: string, payload: unknown): void {
  const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  catalogSseClients.forEach((clientRes) => {
    try {
      clientRes.write(frame);
    } catch {
      catalogSseClients.delete(clientRes);
    }
  });
}

function persistAndBroadcastCatalog(): void {
  serverCatalog = {
    ...serverCatalog,
    version: serverCatalog.version + 1,
    updatedAt: new Date().toISOString(),
  };
  try {
    writeJsonAtomic(CATALOG_FILE, serverCatalog, 0o644);
  } catch (err) {
    console.warn("Could not persist server catalog:", err);
  }
  broadcastSseEvent("catalog:update", serverCatalog);
  broadcastWsEventToAll?.({
    type: "server:catalog_update",
    catalog: serverCatalog,
  });
}

function persistDashboardState(command?: ServerDashboardCommand): void {
  serverDashboardState = {
    ...serverDashboardState,
    version: serverDashboardState.version + 1,
    updatedAt: new Date().toISOString(),
    recentCommands: command
      ? [command, ...serverDashboardState.recentCommands].slice(0, 100)
      : serverDashboardState.recentCommands,
  };
  try {
    writeJsonAtomic(DASHBOARD_STATE_FILE, serverDashboardState, 0o644);
  } catch (err) {
    console.warn("Could not persist server dashboard state:", err);
  }
  if (command) {
    broadcastSseEvent("dashboard:command", command);
  }
  broadcastSseEvent("server:state", serverDashboardState);
  broadcastWsEventToAll?.({
    type: "server:dashboard_command",
    command: command || null,
    state: serverDashboardState,
  });
}

function verifyAdminSessionToken(
  token: string
): { ok: true; email: string; displayName: string; exp: number } | { ok: false } {
  if (!token || !token.startsWith("adm1.")) return { ok: false };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false };
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return { ok: false };

  const expectedSig = crypto
    .createHmac("sha256", ADMIN_SESSION_SECRET)
    .update(encoded)
    .digest("base64url");
  if (!constantTimeStringEqual(sig, expectedSig)) return { ok: false };

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      email?: unknown;
      displayName?: unknown;
      exp?: unknown;
    };
    if (
      typeof parsed.email !== "string" ||
      typeof parsed.displayName !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return { ok: false };
    }
    return {
      ok: true,
      email: parsed.email,
      displayName: parsed.displayName,
      exp: parsed.exp,
    };
  } catch {
    return { ok: false };
  }
}

const PERMANENT_FIREBASE_PROJECT_ID = "shosho-chat-3e571";
const PERMANENT_FIREBASE_WEB_API_KEY = "AIzaSyAAr9fCp9CsfGqTOpIMIx0EyVtechkLchQ";

function readFirebaseAppletConfig(): { apiKey: string; projectId: string } {
  return {
    apiKey: PERMANENT_FIREBASE_WEB_API_KEY,
    projectId: PERMANENT_FIREBASE_PROJECT_ID,
  };
}

const FIREBASE_APPLET_CFG = readFirebaseAppletConfig();
const FIREBASE_WEB_API_KEY = FIREBASE_APPLET_CFG.apiKey;
const FIREBASE_PROJECT_ID = FIREBASE_APPLET_CFG.projectId;

function decodeFirestoreValue(val: Record<string, unknown> | undefined): unknown {
  if (!val || typeof val !== "object") return undefined;
  if ("stringValue" in val) return String(val.stringValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    const arr = (val.arrayValue as { values?: Record<string, unknown>[] })?.values || [];
    return arr.map((v) => decodeFirestoreValue(v));
  }
  if ("mapValue" in val) {
    const fields =
      (val.mapValue as { fields?: Record<string, Record<string, unknown>> })?.fields || {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

async function fetchPublicFirestoreCollection(
  collectionName: string
): Promise<Record<string, unknown>[]> {
  if (!FIREBASE_PROJECT_ID) return [];
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/${encodeURIComponent(collectionName)}?pageSize=200`;
    const resp = await fetch(url, { method: "GET" });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      documents?: { name?: string; fields?: Record<string, Record<string, unknown>> }[];
    };
    const docs = Array.isArray(data.documents) ? data.documents : [];
    return docs.map((d) => {
      const obj: Record<string, unknown> = {};
      if (d.fields) {
        for (const [k, v] of Object.entries(d.fields)) {
          obj[k] = decodeFirestoreValue(v);
        }
      }
      if (!obj.id && typeof d.name === "string") {
        obj.id = d.name.split("/").pop() || "";
      }
      return obj;
    });
  } catch {
    return [];
  }
}

function encodeFirestoreValue(val: unknown): Record<string, unknown> | undefined {
  if (val === undefined) return undefined;
  if (val === null) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return undefined;
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val
          .map((item) => encodeFirestoreValue(item))
          .filter((v): v is Record<string, unknown> => Boolean(v)),
      },
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const encoded = encodeFirestoreValue(v);
      if (encoded) fields[k] = encoded;
    }
    return { mapValue: { fields } };
  }
  return undefined;
}

async function mirrorDocToFirestoreWithBearer(
  authHeader: string | undefined,
  collectionName: string,
  docId: string,
  docPayload: Record<string, unknown> | null
): Promise<void> {
  if (!FIREBASE_PROJECT_ID || !authHeader) return;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.startsWith("adm1.")) return;

  const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_ID
  )}/databases/(default)/documents/${encodeURIComponent(collectionName)}/${encodeURIComponent(
    docId
  )}`;

  try {
    if (docPayload === null) {
      await fetch(docUrl, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return;
    }

    const fields: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of Object.entries(docPayload)) {
      const encoded = encodeFirestoreValue(v);
      if (encoded) fields[k] = encoded;
    }

    await fetch(docUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    });
  } catch {
    // Non-fatal mirror best effort
  }
}

async function hydrateCatalogFromFirestoreIfEmpty(): Promise<void> {
  const [fsGifts, fsStore, fsBgs] = await Promise.all([
    fetchPublicFirestoreCollection("auravoice_gifts"),
    fetchPublicFirestoreCollection("auravoice_store_items"),
    fetchPublicFirestoreCollection("auravoice_room_backgrounds"),
  ]);

  const deletedGifts = new Set(serverCatalog.deletedGiftIds);
  const deletedStore = new Set(serverCatalog.deletedStoreIds);
  const deletedBgs = new Set(serverCatalog.deletedBackgroundIds);

  let changed = false;

  const mergeMissingOrNewer = (
    currentList: Record<string, unknown>[],
    remoteRaw: Record<string, unknown>[],
    sanitizer: (x: unknown) => Record<string, unknown> | null,
    deletedSet: Set<string>
  ): Record<string, unknown>[] => {
    const byId = new Map<string, Record<string, unknown>>();
    for (const item of currentList) {
      byId.set(String(item.id), item);
    }
    for (const raw of remoteRaw) {
      const clean = sanitizer(raw);
      if (!clean) continue;
      const id = String(clean.id);
      if (deletedSet.has(id)) continue;
      const existing = byId.get(id);
      if (!existing) {
        byId.set(id, clean);
        changed = true;
      } else {
        const existingTs = Date.parse(String(existing.updatedAt || "")) || 0;
        const remoteTs = Date.parse(String(clean.updatedAt || "")) || 0;
        if (remoteTs > existingTs) {
          byId.set(id, clean);
          changed = true;
        }
      }
    }
    return Array.from(byId.values());
  };

  if (fsGifts.length > 0) {
    serverCatalog.gifts = mergeMissingOrNewer(
      serverCatalog.gifts,
      fsGifts,
      sanitizeCatalogGift,
      deletedGifts
    );
  }
  if (fsStore.length > 0) {
    serverCatalog.storeItems = mergeMissingOrNewer(
      serverCatalog.storeItems,
      fsStore,
      sanitizeCatalogStoreItem,
      deletedStore
    );
  }
  if (fsBgs.length > 0) {
    serverCatalog.roomBackgrounds = mergeMissingOrNewer(
      serverCatalog.roomBackgrounds,
      fsBgs,
      sanitizeCatalogBackground,
      deletedBgs
    );
  }

  if (changed) {
    persistAndBroadcastCatalog();
  }
}

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
    return { ok: false, error: "مطلوب توكن مصادقة المدير." };
  }

  // 1. Accept verified server-signed Admin Bearer token
  if (token.startsWith("adm1.")) {
    const sessionCheck = verifyAdminSessionToken(token);
    if (sessionCheck.ok) {
      return { ok: true, email: sessionCheck.email };
    }
    return { ok: false, error: "جلسة المدير منتهية أو غير صالحة." };
  }

  // 2. Otherwise verify Firebase ID token against allowlisted admin emails
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
    const isClaimedMatch = Boolean(
      claimedAdminCredential && email === claimedAdminCredential.email.toLowerCase()
    );
    if (!email || !user?.emailVerified || (!ADMIN_ALLOWLIST_EMAILS.has(email) && !isClaimedMatch)) {
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
  const catalogJsonParser = express.json({ limit: "25mb" });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/admin/catalog")) {
      catalogJsonParser(req, res, next);
      return;
    }
    express.json({ limit: "256kb" })(req, res, next);
  });
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

  broadcastWsEventToAll = (payload: unknown) => {
    socketToSession.forEach((_sess, ws) => {
      safeWsSend(ws, payload);
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
    res.json({
      status: "ok",
      mode: "express_ws",
      firebaseProjectId: FIREBASE_PROJECT_ID || null,
      catalogVersion: serverCatalog.version,
      dashboardVersion: serverDashboardState.version,
      catalogCounts: {
        gifts: serverCatalog.gifts.length,
        storeItems: serverCatalog.storeItems.length,
        roomBackgrounds: serverCatalog.roomBackgrounds.length,
      },
      liveCatalogSubscribers: catalogSseClients.size,
      activeVoiceRooms: voiceRooms.size,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    });
  });

  // Admin Email + Password Auth Routes (Clean single-admin claim + scrypt verification + Bearer token)
  app.get("/api/admin/auth/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const envCfg = getEnvAdminConfig();
    if (envCfg) {
      res.json({
        configured: true,
        source: "env",
        emailHint: envCfg.email,
      });
      return;
    }
    if (claimedAdminCredential) {
      res.json({
        configured: true,
        source: "claimed",
        emailHint: claimedAdminCredential.email,
      });
      return;
    }
    res.json({
      configured: false,
      source: "unclaimed",
      emailHint: (process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "").trim().toLowerCase(),
    });
  });

  app.post("/api/admin/auth/claim", (req, res) => {
    const ipKey = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
      .split(",")[0]
      .trim();
    if (isAdminAuthRateLimited(`claim:${ipKey}`)) {
      res.status(429).json({ error: "محاولات كثيرة جداً، يرجى الانتظار قليلاً ثم المحاولة." });
      return;
    }

    if (getEnvAdminConfig() || claimedAdminCredential) {
      res.status(409).json({
        error: "حساب المدير مُعدّ بالفعل. يرجى تسجيل الدخول بالبريد الإلكتروني وكلمة المرور.",
      });
      return;
    }

    const body = (req.body || {}) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 60)
        : "مدير التطبيق";

    if (!isValidEmailFormat(email)) {
      recordAdminAuthFailure(`claim:${ipKey}`);
      res.status(400).json({ error: "يرجى إدخال صيغة بريد إلكتروني صحيحة لحساب المدير." });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون بين 6 و 128 حرفاً." });
      return;
    }

    const saltHex = crypto.randomBytes(16).toString("hex");
    const hashHex = hashPasswordScrypt(password, saltHex);

    claimedAdminCredential = {
      email,
      displayName,
      saltHex,
      hashHex,
      claimedAt: Date.now(),
    };
    savePersistedAdminAuth();
    clearAdminAuthFailures(`claim:${ipKey}`);

    const exp = Date.now() + ADMIN_SESSION_TTL_MS;
    const token = signAdminSessionToken({ email, displayName, exp });
    res.status(201).json({
      ok: true,
      token,
      email,
      displayName,
      expiresAt: exp,
    });
  });

  app.post("/api/admin/auth/login", (req, res) => {
    const ipKey = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
      .split(",")[0]
      .trim();
    if (isAdminAuthRateLimited(`login:${ipKey}`)) {
      res.status(429).json({ error: "محاولات دخول خاطئة كثيرة، يرجى الانتظار قليلاً ثم المحاولة." });
      return;
    }

    const body = (req.body || {}) as { email?: unknown; password?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmailFormat(email) || !password || password.length > 128) {
      res.status(400).json({ error: "يرجى إدخال البريد الإلكتروني وكلمة المرور بشكل صحيح." });
      return;
    }

    const envCfg = getEnvAdminConfig();
    if (envCfg) {
      const emailOk = constantTimeStringEqual(email, envCfg.email);
      const passOk = constantTimeStringEqual(password, envCfg.password);
      if (!emailOk || !passOk) {
        if (emailOk) recordAdminAuthFailure(`login:${ipKey}`);
        res.status(emailOk ? 401 : 404).json({
          error: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        });
        return;
      }
      clearAdminAuthFailures(`login:${ipKey}`);
      const displayName = "مدير التطبيق";
      const exp = Date.now() + ADMIN_SESSION_TTL_MS;
      const token = signAdminSessionToken({ email: envCfg.email, displayName, exp });
      res.json({ ok: true, token, email: envCfg.email, displayName, expiresAt: exp });
      return;
    }

    // First-run seamless claim strictly for allowlisted owner email (persisted to data/admin-auth.json)
    if (!claimedAdminCredential) {
      if (!ADMIN_ALLOWLIST_EMAILS.has(email)) {
        res.status(404).json({ error: "الحساب غير مسجل كمدير." });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." });
        return;
      }
      const saltHex = crypto.randomBytes(16).toString("hex");
      const hashHex = hashPasswordScrypt(password, saltHex);
      claimedAdminCredential = {
        email,
        displayName: "مدير التطبيق",
        saltHex,
        hashHex,
        claimedAt: Date.now(),
      };
      savePersistedAdminAuth();
      clearAdminAuthFailures(`login:${ipKey}`);
      const exp = Date.now() + ADMIN_SESSION_TTL_MS;
      const token = signAdminSessionToken({
        email: claimedAdminCredential.email,
        displayName: claimedAdminCredential.displayName,
        exp,
      });
      res.json({
        ok: true,
        token,
        email: claimedAdminCredential.email,
        displayName: claimedAdminCredential.displayName,
        expiresAt: exp,
      });
      return;
    }

    const emailOk = constantTimeStringEqual(email, claimedAdminCredential.email);
    if (!emailOk) {
      // Non-admin email: return 404 so normal users continue cleanly to Firebase auth
      res.status(404).json({ error: "الحساب غير مسجل كمدير." });
      return;
    }

    const derivedHash = hashPasswordScrypt(password, claimedAdminCredential.saltHex);
    const passOk = constantTimeStringEqual(derivedHash, claimedAdminCredential.hashHex);

    if (!passOk) {
      recordAdminAuthFailure(`login:${ipKey}`);
      res.status(401).json({ error: "كلمة مرور حساب المدير غير صحيحة." });
      return;
    }

    clearAdminAuthFailures(`login:${ipKey}`);
    const exp = Date.now() + ADMIN_SESSION_TTL_MS;
    const token = signAdminSessionToken({
      email: claimedAdminCredential.email,
      displayName: claimedAdminCredential.displayName,
      exp,
    });
    res.json({
      ok: true,
      token,
      email: claimedAdminCredential.email,
      displayName: claimedAdminCredential.displayName,
      expiresAt: exp,
    });
  });

  app.post("/api/admin/auth/update", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    if (getEnvAdminConfig()) {
      res.status(400).json({
        error: "حساب المدير مضبوط عبر متغيرات البيئة (ADMIN_EMAIL/ADMIN_PASSWORD).",
      });
      return;
    }

    const body = (req.body || {}) as {
      email?: unknown;
      password?: unknown;
      displayName?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim().slice(0, 60)
        : claimedAdminCredential?.displayName || "مدير التطبيق";

    if (!isValidEmailFormat(email)) {
      res.status(400).json({ error: "يرجى إدخال بريد إلكتروني صحيح." });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({ error: "كلمة المرور يجب أن تكون بين 6 و 128 حرفاً." });
      return;
    }

    const saltHex = crypto.randomBytes(16).toString("hex");
    const hashHex = hashPasswordScrypt(password, saltHex);
    claimedAdminCredential = {
      email,
      displayName,
      saltHex,
      hashHex,
      claimedAt: Date.now(),
    };
    savePersistedAdminAuth();

    const exp = Date.now() + ADMIN_SESSION_TTL_MS;
    const token = signAdminSessionToken({ email, displayName, exp });
    res.json({ ok: true, token, email, displayName, expiresAt: exp });
  });

  app.get("/api/admin/auth/me", (req, res) => {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    const check = verifyAdminSessionToken(token);
    if (!check.ok) {
      res.status(401).json({ error: "جلسة المدير غير صالحة أو منتهية." });
      return;
    }
    res.json({
      ok: true,
      email: check.email,
      displayName: check.displayName,
      expiresAt: check.exp,
    });
  });

  // ===========================================================================
  // PUBLIC + REAL-TIME SSE CATALOG & COMMAND SYNC ROUTES (All Users Receive Instantly)
  // ===========================================================================
  app.get("/api/catalog", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.json({ ok: true, mode: "express_ws", ...serverCatalog });
  });

  app.get("/api/server/state", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.json({
      ok: true,
      mode: "express_ws",
      catalog: serverCatalog,
      dashboardState: serverDashboardState,
    });
  });

  const handleSyncStream = (req: express.Request, res: express.Response) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    catalogSseClients.add(res);
    res.write(`event: catalog:init\ndata: ${JSON.stringify(serverCatalog)}\n\n`);
    res.write(`event: server:state\ndata: ${JSON.stringify(serverDashboardState)}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(keepAlive);
        catalogSseClients.delete(res);
      }
    }, 20000);

    req.on("close", () => {
      clearInterval(keepAlive);
      catalogSseClients.delete(res);
    });
  };

  app.get("/api/catalog/stream", handleSyncStream);
  app.get("/api/sync/stream", handleSyncStream);

  // Admin-Protected Catalog Mutation Endpoints (Persist + Broadcast to All Users + Mirror to Firestore)
  app.post("/api/admin/catalog/gifts", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const clean = sanitizeCatalogGift(req.body);
    if (!clean) {
      res.status(400).json({ error: "بيانات الهدية غير صالحة." });
      return;
    }
    const giftId = String(clean.id);
    serverCatalog.deletedGiftIds = serverCatalog.deletedGiftIds.filter((id) => id !== giftId);
    serverCatalog.gifts = [clean, ...serverCatalog.gifts.filter((g) => String(g.id) !== giftId)];
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(req.headers.authorization, "auravoice_gifts", giftId, clean);
    res.status(201).json({ ok: true, gift: clean, version: serverCatalog.version });
  });

  app.put("/api/admin/catalog/gifts/:id", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const giftId = sanitizeShortString(req.params.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
    const existing = serverCatalog.gifts.find((g) => String(g.id) === giftId) || { id: giftId };
    const merged = sanitizeCatalogGift({
      ...existing,
      ...(req.body || {}),
      id: giftId,
      updatedAt: new Date().toISOString(),
    });
    if (!merged) {
      res.status(400).json({ error: "تحديث الهدية غير صالح." });
      return;
    }
    serverCatalog.deletedGiftIds = serverCatalog.deletedGiftIds.filter((id) => id !== giftId);
    const exists = serverCatalog.gifts.some((g) => String(g.id) === giftId);
    serverCatalog.gifts = exists
      ? serverCatalog.gifts.map((g) => (String(g.id) === giftId ? merged : g))
      : [merged, ...serverCatalog.gifts];
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(req.headers.authorization, "auravoice_gifts", giftId, merged);
    res.json({ ok: true, gift: merged, version: serverCatalog.version });
  });

  app.delete("/api/admin/catalog/gifts/:id", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const giftId = sanitizeShortString(req.params.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
    serverCatalog.gifts = serverCatalog.gifts.filter((g) => String(g.id) !== giftId);
    if (giftId && !serverCatalog.deletedGiftIds.includes(giftId)) {
      serverCatalog.deletedGiftIds = [giftId, ...serverCatalog.deletedGiftIds].slice(0, 500);
    }
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(req.headers.authorization, "auravoice_gifts", giftId, null);
    res.json({ ok: true, deletedId: giftId, version: serverCatalog.version });
  });

  app.post("/api/admin/catalog/store-items", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const clean = sanitizeCatalogStoreItem(req.body);
    if (!clean) {
      res.status(400).json({ error: "بيانات عنصر المتجر غير صالحة." });
      return;
    }
    const itemId = String(clean.id);
    serverCatalog.deletedStoreIds = serverCatalog.deletedStoreIds.filter((id) => id !== itemId);
    serverCatalog.storeItems = [
      clean,
      ...serverCatalog.storeItems.filter((i) => String(i.id) !== itemId),
    ];
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(
      req.headers.authorization,
      "auravoice_store_items",
      itemId,
      clean
    );
    res.status(201).json({ ok: true, item: clean, version: serverCatalog.version });
  });

  app.put("/api/admin/catalog/store-items/:id", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const itemId = sanitizeShortString(req.params.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
    const existing = serverCatalog.storeItems.find((i) => String(i.id) === itemId) || { id: itemId };
    const merged = sanitizeCatalogStoreItem({
      ...existing,
      ...(req.body || {}),
      id: itemId,
      updatedAt: new Date().toISOString(),
    });
    if (!merged) {
      res.status(400).json({ error: "تحديث عنصر المتجر غير صالح." });
      return;
    }
    serverCatalog.deletedStoreIds = serverCatalog.deletedStoreIds.filter((id) => id !== itemId);
    const exists = serverCatalog.storeItems.some((i) => String(i.id) === itemId);
    serverCatalog.storeItems = exists
      ? serverCatalog.storeItems.map((i) => (String(i.id) === itemId ? merged : i))
      : [merged, ...serverCatalog.storeItems];
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(
      req.headers.authorization,
      "auravoice_store_items",
      itemId,
      merged
    );
    res.json({ ok: true, item: merged, version: serverCatalog.version });
  });

  app.delete("/api/admin/catalog/store-items/:id", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const itemId = sanitizeShortString(req.params.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
    serverCatalog.storeItems = serverCatalog.storeItems.filter((i) => String(i.id) !== itemId);
    if (itemId && !serverCatalog.deletedStoreIds.includes(itemId)) {
      serverCatalog.deletedStoreIds = [itemId, ...serverCatalog.deletedStoreIds].slice(0, 500);
    }
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(
      req.headers.authorization,
      "auravoice_store_items",
      itemId,
      null
    );
    res.json({ ok: true, deletedId: itemId, version: serverCatalog.version });
  });

  app.post("/api/admin/catalog/backgrounds", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const clean = sanitizeCatalogBackground(req.body);
    if (!clean) {
      res.status(400).json({ error: "بيانات الخلفية غير صالحة." });
      return;
    }
    const bgId = String(clean.id);
    serverCatalog.deletedBackgroundIds = serverCatalog.deletedBackgroundIds.filter(
      (id) => id !== bgId
    );
    serverCatalog.roomBackgrounds = [
      clean,
      ...serverCatalog.roomBackgrounds.filter((b) => String(b.id) !== bgId),
    ];
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(
      req.headers.authorization,
      "auravoice_room_backgrounds",
      bgId,
      {
        id: clean.id,
        nameAr: clean.nameAr,
        imageUrl: clean.imageUrl,
        createdAt: clean.createdAt,
        updatedAt: clean.updatedAt,
      }
    );
    res.status(201).json({ ok: true, background: clean, version: serverCatalog.version });
  });

  app.delete("/api/admin/catalog/backgrounds/:id", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const bgId = sanitizeShortString(req.params.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_");
    serverCatalog.roomBackgrounds = serverCatalog.roomBackgrounds.filter(
      (b) => String(b.id) !== bgId
    );
    if (bgId && !serverCatalog.deletedBackgroundIds.includes(bgId)) {
      serverCatalog.deletedBackgroundIds = [bgId, ...serverCatalog.deletedBackgroundIds].slice(
        0,
        500
      );
    }
    persistAndBroadcastCatalog();
    void mirrorDocToFirestoreWithBearer(
      req.headers.authorization,
      "auravoice_room_backgrounds",
      bgId,
      null
    );
    res.json({ ok: true, deletedId: bgId, version: serverCatalog.version });
  });

  app.post("/api/admin/catalog/sync", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }
    const body = (req.body || {}) as {
      gifts?: unknown[];
      storeItems?: unknown[];
      roomBackgrounds?: unknown[];
    };
    let changed = false;

    if (Array.isArray(body.gifts)) {
      const deletedSet = new Set(serverCatalog.deletedGiftIds);
      const existingIds = new Set(serverCatalog.gifts.map((g) => String(g.id)));
      for (const raw of body.gifts) {
        const clean = sanitizeCatalogGift(raw);
        if (clean) {
          const cid = String(clean.id);
          if (!deletedSet.has(cid) && !existingIds.has(cid)) {
            serverCatalog.gifts.push(clean);
            existingIds.add(cid);
            changed = true;
          }
        }
      }
    }
    if (Array.isArray(body.storeItems)) {
      const deletedSet = new Set(serverCatalog.deletedStoreIds);
      const existingIds = new Set(serverCatalog.storeItems.map((i) => String(i.id)));
      for (const raw of body.storeItems) {
        const clean = sanitizeCatalogStoreItem(raw);
        if (clean) {
          const cid = String(clean.id);
          if (!deletedSet.has(cid) && !existingIds.has(cid)) {
            serverCatalog.storeItems.push(clean);
            existingIds.add(cid);
            changed = true;
          }
        }
      }
    }
    if (Array.isArray(body.roomBackgrounds)) {
      const deletedSet = new Set(serverCatalog.deletedBackgroundIds);
      const existingIds = new Set(serverCatalog.roomBackgrounds.map((b) => String(b.id)));
      for (const raw of body.roomBackgrounds) {
        const clean = sanitizeCatalogBackground(raw);
        if (clean) {
          const cid = String(clean.id);
          if (!deletedSet.has(cid) && !existingIds.has(cid)) {
            serverCatalog.roomBackgrounds.push(clean);
            existingIds.add(cid);
            changed = true;
          }
        }
      }
    }

    if (changed) {
      persistAndBroadcastCatalog();
    }
    res.json({ ok: true, changed, ...serverCatalog });
  });

  // Authoritative Admin Dashboard Command Dispatch (Updates State + Broadcasts Instantly to ALL Users)
  app.post("/api/admin/commands", async (req, res) => {
    const authCheck = await verifyAdminFirebaseToken(req.headers.authorization);
    if (!authCheck.ok) {
      res.status(403).json({ error: authCheck.error || "غير مصرح" });
      return;
    }

    const body = (req.body || {}) as {
      id?: unknown;
      type?: unknown;
      payload?: unknown;
    };
    const cmdType = sanitizeShortString(body.type, 48);
    if (!cmdType) {
      res.status(400).json({ error: "نوع الأمر الإداري مطلوب." });
      return;
    }
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};
    const cmdId =
      sanitizeShortString(body.id, 96).replace(/[^a-zA-Z0-9_-]/g, "_") ||
      `cmd_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const nowIso = new Date().toISOString();

    if (cmdType === "ADD_BALANCE") {
      const userId = sanitizeShortString(payload.userId, 128);
      if (userId) {
        const prev = serverDashboardState.userOverrides[userId] || {};
        serverDashboardState.userOverrides[userId] = {
          ...prev,
          ...(typeof payload.coins === "number" ? { coins: Math.max(0, payload.coins) } : {}),
          ...(typeof payload.diamonds === "number"
            ? { diamonds: Math.max(0, payload.diamonds) }
            : {}),
          updatedAt: nowIso,
        };
      }
      if (payload.tx && typeof payload.tx === "object" && !Array.isArray(payload.tx)) {
        serverDashboardState.adminTransactions = [
          payload.tx as Record<string, unknown>,
          ...serverDashboardState.adminTransactions,
        ].slice(0, 100);
      }
    } else if (cmdType === "TOGGLE_BAN") {
      const userId = sanitizeShortString(payload.userId, 128);
      if (userId) {
        const prev = serverDashboardState.userOverrides[userId] || {};
        serverDashboardState.userOverrides[userId] = {
          ...prev,
          isBanned: Boolean(payload.isBanned),
          updatedAt: nowIso,
        };
      }
    } else if (cmdType === "TOGGLE_MUTE") {
      const userId = sanitizeShortString(payload.userId, 128);
      if (userId) {
        const prev = serverDashboardState.userOverrides[userId] || {};
        serverDashboardState.userOverrides[userId] = {
          ...prev,
          isMuted: Boolean(payload.isMuted),
          updatedAt: nowIso,
        };
      }
    } else if (cmdType === "SET_VIP_LEVEL") {
      const userId = sanitizeShortString(payload.userId, 128);
      if (userId) {
        const prev = serverDashboardState.userOverrides[userId] || {};
        serverDashboardState.userOverrides[userId] = {
          ...prev,
          vipLevel: Math.max(0, Math.min(20, Math.round(Number(payload.vipLevel) || 0))),
          updatedAt: nowIso,
        };
      }
    } else if (cmdType === "CLOSE_ROOM") {
      const roomId = sanitizeShortString(payload.roomId, 128);
      if (roomId) {
        if (!serverDashboardState.closedRoomIds.includes(roomId)) {
          serverDashboardState.closedRoomIds = [roomId, ...serverDashboardState.closedRoomIds].slice(
            0,
            300
          );
        }
        serverDashboardState.customRooms = serverDashboardState.customRooms.filter(
          (r) => String(r.id) !== roomId
        );
      }
    } else if (cmdType === "CREATE_ROOM") {
      const room =
        payload.room && typeof payload.room === "object" && !Array.isArray(payload.room)
          ? (payload.room as Record<string, unknown>)
          : null;
      if (room && typeof room.id === "string") {
        const rid = room.id;
        serverDashboardState.closedRoomIds = serverDashboardState.closedRoomIds.filter(
          (id) => id !== rid
        );
        serverDashboardState.customRooms = [
          room,
          ...serverDashboardState.customRooms.filter((r) => String(r.id) !== rid),
        ].slice(0, 200);
      }
    } else if (cmdType === "TOGGLE_ROOM_MODERATOR") {
      const roomId = sanitizeShortString(payload.roomId, 128);
      if (roomId) {
        const moderators = Array.isArray(payload.moderators)
          ? payload.moderators.map((id) => String(id)).slice(0, 100)
          : [];
        const bannedUserIds = Array.isArray(payload.bannedUserIds)
          ? payload.bannedUserIds.map((id) => String(id)).slice(0, 200)
          : undefined;
        serverDashboardState.roomModOverrides[roomId] = {
          moderators,
          ...(bannedUserIds ? { bannedUserIds } : {}),
          updatedAt: nowIso,
        };
      }
    } else if (cmdType === "UPDATE_LUCKY_CONFIG") {
      if (
        payload.luckyConfig &&
        typeof payload.luckyConfig === "object" &&
        !Array.isArray(payload.luckyConfig)
      ) {
        serverDashboardState.luckyConfig = payload.luckyConfig as Record<string, unknown>;
      }
    } else if (cmdType === "UPDATE_AGORA_CONFIG") {
      if (
        payload.agoraConfig &&
        typeof payload.agoraConfig === "object" &&
        !Array.isArray(payload.agoraConfig)
      ) {
        serverDashboardState.agoraConfig = payload.agoraConfig as Record<string, unknown>;
      }
    } else if (cmdType === "CREATE_AGENT" || cmdType === "TOPUP_AGENT") {
      const agent =
        payload.agent && typeof payload.agent === "object" && !Array.isArray(payload.agent)
          ? (payload.agent as Record<string, unknown>)
          : null;
      if (agent && typeof agent.id === "string") {
        const aid = agent.id;
        serverDashboardState.agents = [
          agent,
          ...serverDashboardState.agents.filter((a) => String(a.id) !== aid),
        ].slice(0, 200);
      }
    } else if (cmdType === "UPDATE_AGENCY_STATUS") {
      const agencyId = sanitizeShortString(payload.agencyId, 128);
      const status = sanitizeShortString(payload.status, 32);
      if (agencyId && status) {
        serverDashboardState.agencyStatusOverrides[agencyId] = { status, updatedAt: nowIso };
      }
    } else if (cmdType === "PURGE_MOCK_CATALOGS") {
      const legacyGifts = Array.isArray(payload.legacyGiftIds)
        ? payload.legacyGiftIds.map(String)
        : [];
      const legacyStore = Array.isArray(payload.legacyStoreIds)
        ? payload.legacyStoreIds.map(String)
        : [];
      const legacyGiftSet = new Set([...LEGACY_MOCK_GIFT_IDS, ...legacyGifts]);
      const legacyStoreSet = new Set([...LEGACY_MOCK_STORE_IDS, ...legacyStore]);
      serverCatalog.gifts = serverCatalog.gifts.filter((g) => !legacyGiftSet.has(String(g.id)));
      serverCatalog.storeItems = serverCatalog.storeItems.filter(
        (i) => !legacyStoreSet.has(String(i.id))
      );
      serverCatalog.deletedGiftIds = Array.from(
        new Set([...serverCatalog.deletedGiftIds, ...legacyGiftSet])
      ).slice(0, 500);
      serverCatalog.deletedStoreIds = Array.from(
        new Set([...serverCatalog.deletedStoreIds, ...legacyStoreSet])
      ).slice(0, 500);
      persistAndBroadcastCatalog();
    }

    const command: ServerDashboardCommand = {
      id: cmdId,
      type: cmdType,
      payload,
      issuedBy: authCheck.email || "admin",
      createdAt: Date.now(),
    };
    persistDashboardState(command);
    res.json({ ok: true, command, version: serverDashboardState.version });
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
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server },
        hmr: process.env.DISABLE_HMR === "true" ? false : true,
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

  void hydrateCatalogFromFirestoreIfEmpty().catch(() => {});

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server + Self-Hosted Voice Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
