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
import firebaseAppletConfig from '../../firebase-applet-config.json';

export const firebaseConfig = firebaseAppletConfig;

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

let currentStatus: FirebaseConnectionStatus = {
  isConfigured: Boolean(firebaseConfig?.projectId),
  isConnected: false,
  isTesting: false,
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
  message: 'جاري تهيئة الاتصال السحابي...',
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

export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } {
  if (!appInstance) {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    dbInstance = firebaseConfig.firestoreDatabaseId
      ? getFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
      : getFirestore(appInstance);
    authInstance = getAuth(appInstance);
  }
  return { app: appInstance, db: dbInstance!, auth: authInstance! };
}

const initialized = initFirebase();
export const app = initialized.app;
export const db = initialized.db;
export const auth = initialized.auth;

export function getFirebaseDb(): Firestore {
  if (!dbInstance) initFirebase();
  return dbInstance!;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) initFirebase();
  return authInstance!;
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
      userId: currentAuth.currentUser?.uid,
      email: currentAuth.currentUser?.email,
      emailVerified: currentAuth.currentUser?.emailVerified,
      isAnonymous: currentAuth.currentUser?.isAnonymous,
      tenantId: currentAuth.currentUser?.tenantId,
      providerInfo:
        currentAuth.currentUser?.providerData?.map((provider) => ({
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
    default:
      return msg || 'تعذر إتمام عملية المصادقة، يرجى المحاولة مرة أخرى.';
  }
}

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const cred = await signInWithPopup(getFirebaseAuth(), googleProvider);
  return cred.user;
}

export async function registerWithEmailPassword(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  if (displayName.trim()) {
    await updateProfile(cred.user, { displayName: displayName.trim() }).catch(() => {});
  }
  return cred.user;
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function subscribeToAuthState(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

async function testConnection(): Promise<void> {
  const start = performance.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
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
  updateStatus({ isTesting: true });
  const start = performance.now();

  try {
    initFirebase();
    try {
      await getDocFromServer(doc(getFirebaseDb(), 'test', 'connection'));
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
