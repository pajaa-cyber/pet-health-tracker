import { collection, doc, getDoc, arrayUnion, writeBatch, type Firestore } from '@react-native-firebase/firestore';
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
      // Denormalized userId-only mirror of `members`, written in the same
      // atomic batch so the two can never diverge. firestore.rules and
      // storage.rules check membership via `request.auth.uid in
      // memberIds` — see the Household type for the full rationale.
      memberIds: [userId],
      inviteCode,
      createdAt: Date.now(),
    };

    const batch = writeBatch(db);
    batch.set(docRef, household);
    batch.set(doc(db, 'inviteCodes', inviteCode), { householdId: docRef.id });
    // users/{uid} -> { householdId } lets the app find "which household am
    // I in" on a fresh launch via a single-document get() (see
    // HouseholdContext.tsx) instead of a query Firestore would reject (same
    // reasoning as the inviteCodes lookup above). firestore.rules only
    // allows this as a `create` (doc must not already exist), so retrying
    // this same batch.set on invite-code collision is still safe: the prior
    // batch committed nothing, so this doc still doesn't exist either.
    batch.set(doc(db, 'users', userId), { householdId: docRef.id });

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

  // Batched with the users/{uid} pointer write below so both succeed or
  // fail together — a user must never end up a household member without
  // the pointer that lets the app find that household again on relaunch,
  // or vice versa. This does NOT change any existing join security
  // property: it's still a single `update` on the household doc with
  // exactly the same members/joinCodeUsed shape isJoining() validates.
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), {
    members: arrayUnion(newMember),
    // Kept in exact lockstep with `members` above — same write, same
    // arrayUnion semantics (append-only, idempotent). isJoining() in
    // firestore.rules requires BOTH arrays to grow by exactly one and to
    // still contain all prior entries, and requires the requester's own
    // uid to be the one added to memberIds; a join write that updated
    // only one of the two arrays is rejected.
    memberIds: arrayUnion(userId),
    // Ties this write to proof the caller actually knows the household's
    // invite code — firestore.rules' isJoining() requires this to equal
    // the household's own stored inviteCode. Without it, anyone who learns
    // a household's document ID could join via arrayUnion alone, with zero
    // knowledge of the real code (see firestore.rules for the full
    // rationale). This value is intentionally the code the user typed in,
    // not a derived/looked-up one, so a wrong or stale code fails the
    // rule's equality check rather than silently succeeding.
    joinCodeUsed: inviteCode,
  });
  // See createHousehold's users/{uid} write above: same pointer doc, same
  // reason. firestore.rules only allows this as a `create`, so a user who
  // already belongs to a household (and thus already has this doc) has the
  // WHOLE batch rejected if they attempt to join another — an intentional
  // defense-in-depth backstop for "one household per user" in this plan's
  // scope, not a bug (RootNavigator is the primary UX gate).
  batch.set(doc(db, 'users', userId), { householdId });
  await batch.commit();
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
