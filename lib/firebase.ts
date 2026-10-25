import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { GameState } from './types';
import { cloudSavePath, serializeFortress, SAVE_VERSION } from './save-system';

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
  throw new Error('Cloud storage could not complete this request. Please check your sign-in and try again.');
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
  schemaVersion?: number;
  snapshot?: string;
}

export async function saveFortressToCloud(state: GameState): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in with Google to save fortresses to the cloud.');
  }

  const saveId = state.id;
  const path = cloudSavePath(user.uid, saveId);
  const snapshot = serializeFortress(state);

  try {
    await setDoc(doc(db, path), {
      schemaVersion: SAVE_VERSION,
      snapshot,
      id: saveId,
      userId: user.uid,
      worldName: state.world.name.slice(0, 120),
      dwarvenName: state.world.dwarvenName.slice(0, 80),
      seed: state.world.seed,
      ticks: state.ticks,
      year: state.year,
      season: state.season.slice(0, 40),
      wealth: state.resources.wealth,
      population: state.dwarves.length,
      resources: state.resources,
      updatedAt: serverTimestamp(),
    });
    return saveId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function listUserCloudSaves(): Promise<CloudFortressSave[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = 'saves';
  try {
    const [current, legacy] = await Promise.all([
      getDocs(collection(db, 'users', user.uid, 'saves')),
      getDocs(query(collection(db, 'saves'), where('userId', '==', user.uid))),
    ]);
    return [...current.docs, ...legacy.docs].map((d) => d.data() as CloudFortressSave);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export default app;
