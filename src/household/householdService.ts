import { collection, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import { Household, HouseholdMember } from '../types/household';
import { isHouseholdFull, householdMemberLimitMessage } from '../limits/limits';

// Prefers the platform CSPRNG (crypto.getRandomValues, available in Hermes
// on recent React Native versions) over Math.random(), which is not
// cryptographically secure and was previously used unconditionally here —
// a logged, low-severity known gap (invite codes are not currently
// exploitable, but a predictable PRNG is the wrong primitive for anything
// access-granting). Falls back to Math.random() when crypto.getRandomValues
// isn't present, so this can never behave worse than the code it replaces
// regardless of the Hermes version actually running on a given device —
// deliberately chosen so this doesn't need a native dependency (no
// expo-crypto, no prebuild/rebuild cycle) or device verification to ship
// safely.
function secureRandomIndex(max: number): number {
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoObj.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[secureRandomIndex(chars.length)];
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

  // The users/{uid} pointer write goes FIRST, before the household write —
  // order matters here for two independent reasons found via on-device
  // testing (2026-09-23, a real join and a real remove-then-rejoin from a
  // second phone):
  //
  // 1. RNFB's writeBatch() fails with a bare permission-denied — no
  //    per-write detail — as soon as a THIRD write (a `set()`/create) joins
  //    two `update()`s in one atomic batch, even though every pair of those
  //    three writes succeeds fine in every other combination (isolated
  //    singly, batched two at a time). The emulator's web-SDK rules tests
  //    never caught this because they never batch three writes across three
  //    different top-level collections together. So this write can't be
  //    batched with the two below at all.
  //
  // 2. It must run BEFORE the household write, not after, for the recovery
  //    path (users/{userId}'s `allow update` rule below) to work when
  //    rejoining the SAME household a user was just removed from: that rule
  //    only allows overwriting the pointer while the caller is NOT YET in
  //    the target household's `memberIds`. Writing the household update
  //    first would re-add the caller to that household's `memberIds` before
  //    this pointer write ever runs, permanently failing that check for the
  //    "removed, then immediately rejoins with the same invite code" case
  //    specifically (a first-time join, or a join to a DIFFERENT household,
  //    aren't affected either way — this only matters when old and new
  //    householdId are the same).
  //
  // The narrow guarantee this trades away: a crash between this call and the
  // household batch below could leave a user with a pointer to a household
  // whose `memberIds` doesn't yet contain them. `HouseholdContext`'s
  // subscription already treats a permission-denied on the household read
  // (which is exactly what that produces) as "no household" and falls back
  // to Set Up Your Household — recoverable by reopening the app or
  // rejoining, not data loss.
  //
  // See createHousehold's own users/{uid} write for why this is normally a
  // `create`: firestore.rules only allows it when the pointer doesn't
  // already exist, so a user who already belongs to a household has this
  // write rejected if they attempt to join another — an intentional
  // defense-in-depth backstop for "one household per user," not a bug.
  // Plan 7 partially relaxes this: the backstop is now "one CURRENT
  // household per user" — a REMOVED member's pointer can be overwritten,
  // since Firestore classifies that as an `update`, not a `create`, and
  // this same call is what exercises that rule.
  await setDoc(doc(db, 'users', userId), { householdId });

  // Two writes, batched atomically: the household membership write and the
  // inviteCodes memberCount mirror. They must succeed or fail together —
  // a member added without the count updated (or vice versa) is exactly the
  // "memberCount drift" class of bug already fixed once in removeMember (see
  // its own comment).
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
  // A literal caller-computed value, NOT increment(1) — on-device testing
  // found that RNFB's increment() FieldValue sentinel fails this exact rule
  // check (`request.resource.data.memberCount is int`) when evaluated
  // server-side, even though the identical rule against the identical
  // increment() call passes cleanly under the emulator using the web
  // `firebase` SDK. The two SDKs apparently serialize the increment() field
  // transform differently over the wire, and only RNFB's form trips the
  // rule. A plain literal number (the same style removeMember already uses,
  // for an unrelated reason — see its own comment) sidesteps the whole SDK
  // discrepancy and was confirmed working via the same on-device test.
  batch.update(doc(db, 'inviteCodes', inviteCode), {
    memberCount: (memberCount ?? 0) + 1,
  });
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
