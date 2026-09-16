import { collection, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';
import { isHouseholdFull, householdMemberLimitMessage } from '../limits/limits';

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
    batch.set(doc(db, 'inviteCodes', inviteCode), { householdId: docRef.id, memberCount: 1 });
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

  const { householdId, memberCount } = inviteSnap.data() as { householdId: string; memberCount?: number };

  // memberCount is a denormalized mirror of the household's member count
  // (see firestore.rules) — the only way a non-member client can see it,
  // since it has no read access to the household document itself. Checking
  // it here, before attempting the join write at all, is what lets this
  // throw a friendly, specific message instead of a bare permission-denied
  // error surfacing from a rules rejection. A missing memberCount (a
  // household created before this field existed) is treated as 0 — the
  // safe, fail-open direction. HouseholdScreen's reconcileMemberCount
  // self-heals this the first time any member opens the Household tab.
  if (isHouseholdFull(memberCount ?? 0)) {
    throw new Error(householdMemberLimitMessage());
  }

  const newMember: HouseholdMember = { userId, displayName, joinedAt: Date.now() };

  // Batched with the users/{uid} pointer write and the inviteCodes
  // memberCount increment below so all three succeed or fail together — a
  // user must never end up a household member without the pointer that
  // lets the app find that household again on relaunch, or vice versa.
  // This does NOT change any existing join security property: it's still
  // a single `update` on the household doc with exactly the same
  // members/joinCodeUsed shape isJoining() validates.
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
    // knowledge of the real invite code (see firestore.rules for the full
    // rationale). This value is intentionally the code the user typed in,
    // not a derived/looked-up one, so a wrong or stale code fails the
    // rule's equality check rather than silently succeeding.
    joinCodeUsed: inviteCode,
  });
  batch.update(doc(db, 'inviteCodes', inviteCode), {
    memberCount: increment(1),
  });
  // See createHousehold's users/{uid} write above: same pointer doc, same
  // reason. firestore.rules only allows this as a `create` when the
  // pointer doesn't already exist, so a user who already belongs to a
  // household (and thus already has this doc) has the WHOLE batch rejected
  // if they attempt to join another — an intentional defense-in-depth
  // backstop for "one household per user" in this plan's original scope
  // (RootNavigator is the primary UX gate), not a bug. Plan 7 partially
  // relaxes this: the backstop is now "one CURRENT household per user" —
  // a REMOVED member's pointer can be overwritten (via the users/{userId}
  // recovery rule), since Firestore classifies that as an `update`, not a
  // `create`, and this same batch.set call is what exercises that rule.
  batch.set(doc(db, 'users', userId), { householdId });
  await batch.commit();
}

export async function removeMember(
  db: Firestore,
  householdId: string,
  inviteCode: string,
  member: HouseholdMember,
  remainingMemberCount: number
): Promise<void> {
  // No new rules permission is needed for this write — isMember(resource.data)
  // already allows any current member to update members/memberIds with no
  // field-shape restriction (see the big isMember/isJoining comment block at
  // the top of firestore.rules). The actual fix this plan makes is the
  // users/{userId} recovery-path rule below, which lets the REMOVED member's
  // own client repair their stale pointer the next time they try to create
  // or join a household — this function does not touch users/{removedUid}
  // at all, deliberately avoiding any dependency on write ordering within
  // this batch.
  //
  // memberCount is written here as the caller-supplied ABSOLUTE remaining
  // count, not an increment(-1) — increment() can never correct an already-
  // wrong stored value, and a pre-existing (pre-Plan-7) household's
  // inviteCodes doc has no memberCount field at all, so a naive decrement
  // would drift permanently (a double-removal from two phones would double-
  // decrement; a removed member who still holds the invite code could also
  // write an inflated count directly, permanently blocking future joins).
  // reconcileMemberCount below additionally self-heals this value against
  // the true `members.length` every time any member opens the Household tab.
  const batch = writeBatch(db);
  batch.update(doc(db, 'households', householdId), {
    members: arrayRemove(member),
    memberIds: arrayRemove(member.userId),
  });
  batch.update(doc(db, 'inviteCodes', inviteCode), {
    memberCount: remainingMemberCount,
  });
  await batch.commit();
}

// Self-healing correction for `inviteCodes/{code}`'s memberCount mirror —
// called whenever any member opens the Household tab (see HouseholdScreen)
// so a missing/stale/tampered value converges on the real `members.length`
// without requiring every membership-changing code path to get the math
// exactly right on its own.
export async function reconcileMemberCount(
  db: Firestore,
  inviteCode: string,
  actualCount: number
): Promise<void> {
  await updateDoc(doc(db, 'inviteCodes', inviteCode), { memberCount: actualCount });
}

export async function getHousehold(
  db: Firestore,
  householdId: string
): Promise<Household | null> {
  const docSnap = await getDoc(doc(db, 'households', householdId));
  return docSnap.exists() ? (docSnap.data() as Household) : null;
}
