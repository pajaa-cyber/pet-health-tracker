import {
  collection, collectionGroup, doc, getDoc, setDoc, updateDoc, onSnapshot, query, where,
  type Firestore, type Unsubscribe,
} from '@react-native-firebase/firestore';
import { SitterAccessGrant, SitterInviteCode } from '../types/sitterAccess';

// Same CSPRNG-with-Math.random()-fallback approach as householdService.ts's
// invite codes — not duplicated as a shared util because that file's version
// isn't exported, and this is a handful of lines, not worth a new shared
// module for.
function secureRandomIndex(max: number): number {
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoObj.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateSitterCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[secureRandomIndex(chars.length)];
  }
  return code;
}

export async function createSitterInvite(
  db: Firestore,
  householdId: string,
  petIds: string[],
  expiresAt: number
): Promise<string> {
  const code = generateSitterCode();
  const invite: SitterInviteCode = { householdId, petIds, expiresAt };
  await setDoc(doc(db, 'sitterInviteCodes', code), invite);
  return code;
}

export async function redeemSitterInvite(
  db: Firestore,
  sitterUid: string,
  code: string
): Promise<void> {
  const codeSnap = await getDoc(doc(db, 'sitterInviteCodes', code));
  if (!codeSnap.exists()) {
    throw new Error('Invite code not found');
  }
  const { householdId, petIds, expiresAt } = codeSnap.data() as SitterInviteCode;

  const grant: SitterAccessGrant = { sitterUid, householdId, petIds, expiresAt, revoked: false, code };
  await setDoc(doc(db, 'households', householdId, 'sitterAccess', sitterUid), grant);
}

export async function revokeSitterAccess(
  db: Firestore,
  householdId: string,
  sitterUid: string
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'sitterAccess', sitterUid), { revoked: true });
}

export function subscribeToSitterGrants(
  db: Firestore,
  householdId: string,
  callback: (grants: SitterAccessGrant[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'sitterAccess'),
    (snap) => callback(snap.docs.map((d) => d.data() as SitterAccessGrant)),
    (error) => {
      console.error('subscribeToSitterGrants listener error', error);
      callback([]);
    }
  );
}

// A sitter's own client doesn't know which household(s) granted them access
// ahead of time — this collection-group query finds every sitterAccess
// document across every household where sitterUid matches the caller's own
// uid. Provable under this project's rules the same way a normal single-
// collection query is: the where() clause matches exactly what the rule
// checks against resource.data (see firestore.rules' sitterAccess block).
export function subscribeToMySitterGrants(
  db: Firestore,
  sitterUid: string,
  callback: (grants: SitterAccessGrant[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collectionGroup(db, 'sitterAccess'), where('sitterUid', '==', sitterUid)),
    (snap) => callback(snap.docs.map((d) => d.data() as SitterAccessGrant)),
    (error) => {
      console.error('subscribeToMySitterGrants listener error', error);
      callback([]);
    }
  );
}
