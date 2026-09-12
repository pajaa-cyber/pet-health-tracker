import { collection, doc, getDoc, updateDoc, arrayUnion, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// generateInviteCode() never checked uniqueness before this fix, and the
// two writes (household + inviteCodes lookup) were separate setDoc calls:
// a crash/network failure between them could orphan a household with no
// working invite code, and a code collision would make the second setDoc
// an implicit *update* on an existing inviteCodes doc, which the rules
// deny (allow update, delete: if false), throwing after the household doc
// had already committed.
//
// Fix: both writes now go through a single writeBatch, which Firestore
// commits atomically (all-or-nothing) — a collision on the inviteCodes
// write now fails the WHOLE batch, so the household is never left
// half-created. On failure we simply regenerate a fresh code and retry
// the entire batch (retrying the household `set` too is safe: since the
// prior batch committed nothing, the household document still doesn't
// exist, so re-setting it at the same doc ref is still a `create` under
// the rules). We retry on any commit failure rather than trying to
// distinguish "collision" from other errors first, because the batch's
// atomicity already guarantees no partial state either way — the only
// downside of retrying on a non-collision error (e.g. a real network
// failure) is a few wasted attempts before the real error surfaces via
// lastError, which is an acceptable tradeoff for keeping this simple.
const MAX_INVITE_CODE_ATTEMPTS = 5;

export async function createHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  householdName: string
): Promise<Household> {
  const member: HouseholdMember = { userId, displayName, joinedAt: Date.now() };
  const docRef = doc(collection(db, 'households'));

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    const household: Household = {
      id: docRef.id,
      name: householdName,
      members: [member],
      inviteCode,
      createdAt: Date.now(),
    };

    const batch = writeBatch(db);
    batch.set(docRef, household);
    batch.set(doc(db, 'inviteCodes', inviteCode), { householdId: docRef.id });

    try {
      await batch.commit();
      return household;
    } catch (e) {
      lastError = e;
      // Regenerate and retry the whole batch — see rationale above.
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to create household: could not commit after retrying invite code generation');
}

export async function joinHousehold(
  db: Firestore,
  userId: string,
  displayName: string,
  inviteCode: string
): Promise<void> {
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', inviteCode));

  if (!inviteSnap.exists()) {
    throw new Error('Invite code not found');
  }

  const { householdId } = inviteSnap.data() as { householdId: string };
  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };

  await updateDoc(doc(db, 'households', householdId), {
    members: arrayUnion(newMember),
  });
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
