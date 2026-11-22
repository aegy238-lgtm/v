import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
interface FirebaseAppletConfigShape {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

export const PERMANENT_FIREBASE_CONFIG: FirebaseAppletConfigShape = {
  apiKey: 'AIzaSyAAr9fCp9CsfGqTOpIMIx0EyVtechkLchQ',
  authDomain: 'shosho-chat-3e571.firebaseapp.com',
  projectId: 'shosho-chat-3e571',
  storageBucket: 'shosho-chat-3e571.firebasestorage.app',
  messagingSenderId: '633233573986',
  appId: '1:633233573986:web:4bc3c29544f858b534a93b',
  firestoreDatabaseId: '',
};

export const firebaseConfig: FirebaseAppletConfigShape = {
  ...PERMANENT_FIREBASE_CONFIG,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface FirebaseConnectionStatus {
  isConfigured: boolean;
  isConnected: boolean;
  isTesting: boolean;
  projectId: string;
  databaseId?: string;
  latencyMs?: number;
  lastCheckedAt?: string;
  message?: string;
  serverTimestamp?: string;
  error?: string;
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let currentStatus: FirebaseConnectionStatus = {
  isConfigured: isFirebaseConfigured,
  isConnected: false,
  isTesting: false,
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  message: 'جاري تهيئة الاتصال السحابي بـ shosho-chat-3e571...',
};

const listeners = new Set<(status: FirebaseConnectionStatus) => void>();

export function subscribeToFirebaseStatus(
  callback: (status: FirebaseConnectionStatus) => void
): () => void {
  listeners.add(callback);
  callback({ ...currentStatus });
  return () => {
    listeners.delete(callback);
  };
}

function updateStatus(updates: Partial<FirebaseConnectionStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  listeners.forEach((cb) => {
    try {
      cb({ ...currentStatus });
    } catch (e) {
      console.error('Error notifying status listener:', e);
    }
  });
}

export function initFirebase(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
} {
  if (!isFirebaseConfigured) {
    return { app: null, db: null, auth: null };
  }
  if (!appInstance) {
    try {
      appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      dbInstance = firebaseConfig.firestoreDatabaseId
        ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
        : getFirestore(appInstance);
      authInstance = getAuth(appInstance);
    } catch (err) {
      console.warn('[Firebase] Safe init fallback (missing or invalid config):', err);
      appInstance = null;
      dbInstance = null;
      authInstance = null;
      updateStatus({
        isConfigured: false,
        isConnected: false,
        isTesting: false,
        error: err instanceof Error ? err.message : 'تعذر تهيئة Firebase',
        message: 'يرجى التحقق من متغيرات البيئة VITE_FIREBASE_* في إعدادات الاستضافة.',
      });
    }
  }
  return { app: appInstance, db: dbInstance, auth: authInstance };
}

const initialized = initFirebase();
export const app: FirebaseApp | null = initialized.app;
export const db: Firestore | null = initialized.db;
export const auth: Auth | null = initialized.auth;

export function getFirebaseDb(): Firestore | null {
  if (!dbInstance && isFirebaseConfigured) initFirebase();
  return dbInstance;
}

export function getFirebaseAuth(): Auth | null {
  if (!authInstance && isFirebaseConfigured) initFirebase();
  return authInstance;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentAuth = getFirebaseAuth();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid,
      email: currentAuth?.currentUser?.email,
      emailVerified: currentAuth?.currentUser?.emailVerified,
      isAnonymous: currentAuth?.currentUser?.isAnonymous,
      tenantId: currentAuth?.currentUser?.tenantId,
      providerInfo:
        currentAuth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function translateFirebaseAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const msg = error instanceof Error ? error.message : String(error || '');

  switch (code) {
    case 'auth/email-already-in-use':
      return 'هذا البريد الإلكتروني مستخدم بالفعل. يمكنك تسجيل الدخول مباشرة.';
    case 'auth/invalid-email':
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    case 'auth/weak-password':
      return 'كلمة المرور ضعيفة، يجب أن تحتوي على 6 أحرف على الأقل.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'auth/operation-not-allowed':
      return 'تسجيل الدخول بالبريد وكلمة المرور غير مفعّل بعد في Firebase Console (Authentication → Sign-in method → Email/Password).';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'تم إغلاق نافذة Google قبل إتمام تسجيل الدخول.';
    case 'auth/popup-blocked':
      return 'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة والمحاولة مجدداً.';
    case 'auth/too-many-requests':
      return 'تم تنفيذ محاولات متكررة، يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    case 'auth/network-request-failed':
      return 'تعذر الاتصال بالشبكة، تحقق من اتصال الإنترنت وحاول مرة أخرى.';
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return `النطاق الحالي (${host || 'هذا الرابط'}) غير مضاف في النطاقات المصرح بها في Firebase Console (Authentication → Settings → Authorized domains). أضف النطاق لتفعيل الدخول عبر Google أو استخدم الدخول بالبريد وكلمة المرور.`;
    }
    default:
      return msg || 'تعذر إتمام عملية المصادقة، يرجى المحاولة مرة أخرى.';
  }
}

function requireFirebaseAuth(): Auth {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) {
    throw new Error(
      'إعدادات Firebase غير مضافة في الاستضافة بعد (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID). يمكنك الدخول كزائر أو إضافة متغيرات Firebase في إعدادات الاستضافة.'
    );
  }
  return currentAuth;
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(requireFirebaseAuth(), googleProvider);
  return cred.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(
    requireFirebaseAuth(),
    email.trim(),
    password
  );
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  return cred.user;
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(
    requireFirebaseAuth(),
    email.trim(),
    password
  );
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) return;
  await signOut(currentAuth);
}

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  const currentAuth = getFirebaseAuth();
  if (!currentAuth) {
    queueMicrotask(() => callback(null));
    return () => {};
  }
  try {
    return onAuthStateChanged(currentAuth, callback);
  } catch (err) {
    console.warn('[Firebase] onAuthStateChanged fallback:', err);
    queueMicrotask(() => callback(null));
    return () => {};
  }
}

async function testConnection(): Promise<void> {
  const currentDb = getFirebaseDb();
  if (!isFirebaseConfigured || !currentDb) {
    updateStatus({
      isConfigured: false,
      isConnected: false,
      isTesting: false,
      projectId: firebaseConfig.projectId || 'غير مضبوط',
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      lastCheckedAt: new Date().toISOString(),
      message: 'أضف متغيرات VITE_FIREBASE_* في الاستضافة لتفعيل الربط السحابي.',
    });
    return;
  }
  const start = performance.now();
  try {
    await getDocFromServer(doc(currentDb, 'test', 'connection'));
    const latency = Math.round(performance.now() - start);
    updateStatus({
      isConfigured: true,
      isConnected: true,
      isTesting: false,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      latencyMs: latency,
      lastCheckedAt: new Date().toISOString(),
      message: `متصل بقاعدة بيانات ${firebaseConfig.projectId} (${latency}ms)`,
    });
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      updateStatus({
        isConfigured: true,
        isConnected: false,
        isTesting: false,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        latencyMs: latency,
        lastCheckedAt: new Date().toISOString(),
        error: 'the client is offline',
        message: 'تعذر الاتصال بخادم Firestore (client is offline).',
      });
    } else {
      updateStatus({
        isConfigured: true,
        isConnected: true,
        isTesting: false,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        latencyMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: `تم التحقق من الاتصال بخادم Firebase (${firebaseConfig.projectId})`,
      });
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

export async function testFirebaseConnection(force = false): Promise<FirebaseConnectionStatus> {
  if (currentStatus.isTesting && !force) return currentStatus;
  if (!isFirebaseConfigured) {
    const result: FirebaseConnectionStatus = {
      isConfigured: false,
      isConnected: false,
      isTesting: false,
      projectId: firebaseConfig.projectId || 'غير مضبوط',
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      lastCheckedAt: new Date().toISOString(),
      error: 'متغيرات Firebase غير مضافة في الاستضافة',
      message: 'أضف متغيرات VITE_FIREBASE_* في إعدادات البيئة بالاستضافة ثم أعد النشر.',
    };
    updateStatus(result);
    return result;
  }
  updateStatus({ isTesting: true });
  const start = performance.now();

  try {
    initFirebase();
    const currentDb = getFirebaseDb();
    if (!currentDb) {
      throw new Error('تعذر تهيئة Firestore');
    }
    try {
      await getDocFromServer(doc(currentDb, 'test', 'connection'));
      const latency = Math.round(performance.now() - start);
      const result: FirebaseConnectionStatus = {
        isConfigured: true,
        isConnected: true,
        isTesting: false,
        projectId: firebaseConfig.projectId,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        latencyMs: latency,
        lastCheckedAt: new Date().toISOString(),
        message: `تم التحقق بنجاح: قاعدة بيانات Firebase (${firebaseConfig.projectId}) متصلة وشغالة (${latency}ms)`,
      };
      updateStatus(result);
      return result;
    } catch (fsErr: any) {
      if (
        fsErr?.code === 'permission-denied' ||
        fsErr?.message?.includes('insufficient permissions') ||
        fsErr?.code === 'not-found'
      ) {
        const fsLatency = Math.round(performance.now() - start);
        const result: FirebaseConnectionStatus = {
          isConfigured: true,
          isConnected: true,
          isTesting: false,
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
          latencyMs: fsLatency,
          lastCheckedAt: new Date().toISOString(),
          message: `تم التحقق بنجاح: قاعدة بيانات Firebase (${firebaseConfig.projectId}) متصلة بنجاح.`,
        };
        updateStatus(result);
        return result;
      }
    }

    // Fallback check via Firestore REST endpoint in case WebChannel transport was blocked by proxy/firewall
    try {
      const restRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(firebaseConfig.projectId)}/databases/(default)/documents/auravoice_rooms?pageSize=1`
      );
      if (restRes.ok || restRes.status === 404 || restRes.status === 403) {
        const restLatency = Math.round(performance.now() - start);
        const result: FirebaseConnectionStatus = {
          isConfigured: true,
          isConnected: true,
          isTesting: false,
          projectId: firebaseConfig.projectId,
          databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
          latencyMs: restLatency,
          lastCheckedAt: new Date().toISOString(),
          message: `تم التحقق بنجاح: قاعدة بيانات Firebase (${firebaseConfig.projectId}) متصلة وشغالة (${restLatency}ms)`,
        };
        updateStatus(result);
        return result;
      }
    } catch {
      // Ignore and report offline status below
    }

    const latency = Math.round(performance.now() - start);
    const result: FirebaseConnectionStatus = {
      isConfigured: true,
      isConnected: false,
      isTesting: false,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      latencyMs: latency,
      lastCheckedAt: new Date().toISOString(),
      error: 'تعذر الوصول إلى خوادم Firebase',
      message: 'تنبيه: يرجى التحقق من اتصال الإنترنت أو إعدادات المشروع في Firebase Console.',
    };
    updateStatus(result);
    return result;
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    const result: FirebaseConnectionStatus = {
      isConfigured: true,
      isConnected: false,
      isTesting: false,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
      latencyMs: latency,
      lastCheckedAt: new Date().toISOString(),
      error: err?.message || 'تعذر الاتصال بـ Firebase',
      message: `تنبيه الاتصال: ${err?.message || 'تحقق من اتصال الإنترنت'}`,
    };
    updateStatus(result);
    return result;
  }
}

export function stripUndefinedForFirestore<T>(input: T): T {
  if (input === null || input === undefined || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedForFirestore(item)) as unknown as T;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(input as Record<string, any>)) {
    if (v !== undefined) {
      clean[k] = stripUndefinedForFirestore(v);
    }
  }
  return clean as T;
}
