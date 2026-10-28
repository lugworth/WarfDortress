import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  Bytes,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  getDocFromServer,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { GameState } from './types';
import { packFortressSnapshot, SNAPSHOT_FORMAT, unpackFortressSnapshot } from './cloud-snapshot';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
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

let connectionTested = false;
export async function testFirestoreConnection() {
  if (connectionTested || typeof window === 'undefined') return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export interface CloudFortressSave {
  id: string;
  userId: string;
  worldName: string;
  dwarvenName: string;
  seed: string;
  ticks: number;
  year: number;
  season: string;
  wealth: number;
  population: number;
  resources: GameState['resources'];
}

const SAVE_ID_CHARS = /[^a-zA-Z0-9_-]/g;

// 53-bit string hash (cyrb53); short, stable, and only used to namespace ids.
function hashId(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Firestore document id for a player's fortress (the rules allow 1-64 of
 * [A-Za-z0-9_-]). Ids are namespaced per player so two players who pick the
 * same seed do not compete for one document.
 */
export function getCloudSaveId(state: Pick<GameState, 'id'>, userId: string): string {
  return `${hashId(userId)}-${state.id.replace(SAVE_ID_CHARS, '')}`.slice(0, 64);
}

// Archives made before ids were namespaced used the fortress id alone.
function getLegacyCloudSaveId(state: Pick<GameState, 'id'>): string {
  return state.id.replace(SAVE_ID_CHARS, '').slice(0, 64);
}

async function resolveSaveId(state: GameState, userId: string): Promise<string> {
  const legacyId = getLegacyCloudSaveId(state);
  if (legacyId) {
    try {
      // Readable only by its owner; keep updating an archive the player already has.
      const legacy = await getDoc(doc(db, 'saves', legacyId));
      if (legacy.exists() && legacy.data().userId === userId) return legacyId;
    } catch {
      // Missing or someone else's: use this player's namespaced id.
    }
  }
  return getCloudSaveId(state, userId);
}

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'permission-denied';
}

/**
 * Saves the archive summary and, when the deployed rules allow it, a compressed
 * snapshot of the whole fortress. `full` reports whether the snapshot was stored.
 */
export async function saveFortressToCloud(state: GameState): Promise<{ saveId: string; full: boolean }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google to save fortresses to the cloud.');
  }

  const saveId = (await resolveSaveId(state, user.uid)) || `fort-${Date.now()}`;
  const path = `saves/${saveId}`;
  const summary = {
    id: saveId,
    userId: user.uid,
    worldName: state.world.name.slice(0, 120),
    dwarvenName: state.world.dwarvenName.slice(0, 80),
    seed: state.world.seed.slice(0, 64),
    ticks: state.ticks,
    year: state.year,
    season: state.season.slice(0, 40),
    wealth: state.resources.wealth,
    population: state.dwarves.length,
    resources: state.resources,
    updatedAt: serverTimestamp(),
  };

  let snapshot: Bytes | null = null;
  try {
    snapshot = Bytes.fromUint8Array(await packFortressSnapshot(state));
  } catch (error) {
    console.warn('Saving a cloud summary only:', error);
  }

  if (snapshot) {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'saves', saveId), summary);
      batch.set(doc(db, 'snapshots', saveId), {
        userId: user.uid,
        format: SNAPSHOT_FORMAT,
        ticks: state.ticks,
        data: snapshot,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return { saveId, full: true };
    } catch (error) {
      // Rules deployed before snapshots existed reject the batch; keep saving summaries.
      if (!isPermissionDenied(error)) handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  try {
    await setDoc(doc(db, 'saves', saveId), summary);
    return { saveId, full: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/** The archived fortress, or null when there is no readable snapshot for this save. */
export async function loadFortressSnapshot(saveId: string): Promise<GameState | null> {
  if (!auth.currentUser) return null;
  try {
    const snap = await getDoc(doc(db, 'snapshots', saveId));
    const data = snap.exists() ? snap.data() : null;
    if (!data || data.format !== SNAPSHOT_FORMAT || !(data.data instanceof Bytes)) return null;
    return await unpackFortressSnapshot(data.data.toUint8Array());
  } catch {
    return null;
  }
}

export async function listUserCloudSaves(): Promise<CloudFortressSave[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = 'saves';
  try {
    const q = query(collection(db, 'saves'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CloudFortressSave);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export default app;
