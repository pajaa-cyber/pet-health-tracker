# Sitter access and trial/limits wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sitter access (owner grants a non-member time-limited, expiry-enforced
read access to specific pets) and wiring `src/limits/limits.ts` to a real
(stubbed) household-level trial field instead of hardcoded constants.

**Architecture:** Two independent additions on top of this project's existing
household-scoped Firestore/rules patterns. Trial state is two new optional
fields on the `households/{householdId}` document, auto-started by a
`HouseholdContext` effect mirroring its existing migration-trigger effect.
Sitter access is two new collections (`sitterAccess` under each household,
keyed by the sitter's own uid so rules can enforce it with a single `get()`;
`sitterInviteCodes` at the root, mirroring `inviteCodes`) plus widened `allow
read` rules across every pet-scoped and household-level collection, enforced
server-side via `request.time`.

**Tech Stack:** Same as every prior plan — Expo prebuild/dev-client,
`@react-native-firebase/firestore` modular API, React Navigation, Jest
(mocked Firestore for service logic, `@firebase/rules-unit-testing` against
the real emulator for rules).

**Spec:** `docs/superpowers/specs/2026-09-23-sitter-access-and-trial-design.md`

## Global Constraints

- Trial-field auto-start and sitter-access rules must ship in the same task
  (or an earlier one) than any UI that depends on them — a `canX` check
  reading `household.trialEndsAt` before that field can ever be set would
  silently and permanently deny everyone.
- `canAddCustomField`, `canAddHouseholdMember`, `canAddDocumentPage` all gain
  a `household` parameter — every existing call site is updated in the same
  task that changes the signature (see Task 1's Files list; missing one
  would fail `tsc`, not silently pass).
- No `paidUntil`/`subscriptionStatus: 'paid'` field exists anywhere in this
  plan. This project's `households/{householdId}` `allow update` rule has no
  field allowlist (by design, for `documentsStorageBytes`'s sake), so a
  client-writable "I'm paid" field would let any member grant the whole
  household free premium — that field is deliberately deferred to the real
  Google Play Billing sub-project, where it can be set from a
  server-verified purchase instead of a plain client write.
- `sitterAccess`'s document ID **must** be the sitter's own uid — load-bearing
  for the whole rules-enforcement approach (a query-based "does a grant
  exist for me" check across an unknown householdId is not the shape this
  project's rules can prove safe for an arbitrary reader; keying by uid lets
  every check be a single known-path `get()`, the same idiom
  `isHouseholdMember` already uses).
- **Known, deliberate simplification:** `joinHousehold`'s pre-join "is this
  household full" check (`householdService.ts`, via the `inviteCodes.
  memberCount` mirror) stays free-tier-constant-only in this plan — it has
  no visibility into the target household's `trialEndsAt` (a non-member has
  no read access to the household document, only to the `inviteCodes`
  mirror), and mirroring subscription state onto `inviteCodes` too is not
  worth the added complexity for what was already a soft, non-rules-enforced
  advisory cap before this plan. A subscribed/trialing household that has
  grown past 4 members may show a new joiner an inaccurate "household is
  full" message; the actual join, if attempted anyway by a member with the
  invite code, is unaffected (rules never enforced this cap either). Leave
  this as-is; do not "fix" it as part of this plan.
- `firestore.rules` changes in this plan are **never auto-deployed** — the
  final task's real `firebase deploy --only firestore:rules` needs the
  owner's explicit go-ahead, every time, per `CLAUDE.md`.
- Never `increment()` on any new denormalized field; never mix `set()`/
  `update()` calls in one `writeBatch()` — both are established, hard-won
  rules in this codebase (see `CLAUDE.md`'s Documents/passport paragraph and
  Plan 7's `memberCount`/`writeBatch` history).

---

### Task 1: Trial fields + `limits.ts` wired to subscription state

**Files:**
- Modify: `src/types/household.ts`
- Modify: `src/limits/limits.ts`
- Modify: `src/navigation/AddPetScreen.tsx`
- Modify: `src/navigation/EditPetScreen.tsx`
- Modify: `src/navigation/HouseholdScreen.tsx`
- Modify: `src/navigation/AddDocumentScreen.tsx`
- Modify: `src/navigation/PetHomeScreen.tsx`
- Modify: `src/navigation/DocumentListScreen.tsx`
- Test: `__tests__/limits.test.ts` (extend)

**Interfaces:**
- Produces: `isSubscriptionActive(household: { trialEndsAt?: number | null }): boolean`;
  `canAddCustomField(pet, household)`, `canAddHouseholdMember(household)`,
  `canAddDocumentPage(pageCountSoFar, household)` (all gain a `household`
  parameter, same return type as before); `canGeneratePassport(household):
  boolean`, `passportLimitMessage(): string`; `canShareDocument(household):
  boolean`, `shareDocumentLimitMessage(): string`.
- Consumes: nothing new (this task only touches `limits.ts` and its callers).

- [ ] **Step 1: Add trial fields to the `Household` type**

In `src/types/household.ts`, add after `documentsStorageBytes?: number;`:

```typescript
  // Sub-project A of Plan 9 ("Subscriptions and release"). Set once, together,
  // by HouseholdContext's trial-start effect — never changed after. Optional:
  // absent until that effect has run at least once for this household.
  trialStartedAt?: number | null;
  trialEndsAt?: number | null;
```

- [ ] **Step 2: Write the failing tests for the new/changed `limits.ts` functions**

Replace `__tests__/limits.test.ts` entirely with:

```typescript
import {
  isSubscriptionActive, FREE_CUSTOM_FIELDS_PER_PET, FREE_HOUSEHOLD_MEMBERS, FREE_DOCUMENT_PHOTOS_PER_PET,
  canAddCustomField, customFieldLimitMessage,
  canAddHouseholdMember, householdMemberLimitMessage, isHouseholdFull,
  canAddDocumentPage, documentPhotoLimitMessage,
  canGeneratePassport, passportLimitMessage,
  canShareDocument, shareDocumentLimitMessage,
} from '../src/limits/limits';

const NOW = 1_700_000_000_000;
const activeHousehold = { trialEndsAt: NOW + 1000 };
const expiredHousehold = { trialEndsAt: NOW - 1000 };
const neverStartedHousehold = { trialEndsAt: null };

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('isSubscriptionActive', () => {
  it('is true while trialEndsAt is in the future', () => {
    expect(isSubscriptionActive(activeHousehold)).toBe(true);
  });
  it('is false once trialEndsAt has passed', () => {
    expect(isSubscriptionActive(expiredHousehold)).toBe(false);
  });
  it('is false when trialEndsAt was never set', () => {
    expect(isSubscriptionActive(neverStartedHousehold)).toBe(false);
  });
});

describe('canAddCustomField', () => {
  const petUnderCap = { customFields: [{ label: 'a', value: '1' }] };
  const petAtCap = { customFields: Array.from({ length: FREE_CUSTOM_FIELDS_PER_PET }, () => ({ label: 'a', value: '1' })) };

  it('enforces the free cap when not subscribed', () => {
    expect(canAddCustomField(petUnderCap, expiredHousehold)).toBe(true);
    expect(canAddCustomField(petAtCap, expiredHousehold)).toBe(false);
  });
  it('is always true while subscribed, regardless of the count', () => {
    expect(canAddCustomField(petAtCap, activeHousehold)).toBe(true);
  });
});

describe('canAddHouseholdMember', () => {
  const fullHousehold = { members: Array.from({ length: FREE_HOUSEHOLD_MEMBERS }, () => ({})) };

  it('enforces the free cap when not subscribed', () => {
    expect(canAddHouseholdMember({ ...fullHousehold, ...expiredHousehold })).toBe(false);
  });
  it('is always true while subscribed, regardless of member count', () => {
    expect(canAddHouseholdMember({ ...fullHousehold, ...activeHousehold })).toBe(true);
  });
});

describe('canAddDocumentPage', () => {
  it('enforces the free cap when not subscribed', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET - 1, expiredHousehold)).toBe(true);
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET, expiredHousehold)).toBe(false);
  });
  it('is always true while subscribed, regardless of the count', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET, activeHousehold)).toBe(true);
  });
});

describe('canGeneratePassport / canShareDocument', () => {
  it('are gated entirely behind subscription status', () => {
    expect(canGeneratePassport(expiredHousehold)).toBe(false);
    expect(canGeneratePassport(activeHousehold)).toBe(true);
    expect(canShareDocument(expiredHousehold)).toBe(false);
    expect(canShareDocument(activeHousehold)).toBe(true);
  });
});

describe('messages', () => {
  it('are non-empty strings mentioning the relevant constant', () => {
    expect(customFieldLimitMessage()).toContain(String(FREE_CUSTOM_FIELDS_PER_PET));
    expect(householdMemberLimitMessage()).toContain(String(FREE_HOUSEHOLD_MEMBERS));
    expect(documentPhotoLimitMessage()).toContain(String(FREE_DOCUMENT_PHOTOS_PER_PET));
    expect(passportLimitMessage().length).toBeGreaterThan(0);
    expect(shareDocumentLimitMessage().length).toBeGreaterThan(0);
  });
});

describe('isHouseholdFull (unchanged — used by the pre-join check, see Global Constraints)', () => {
  it('is true at exactly the free cap', () => {
    expect(isHouseholdFull(FREE_HOUSEHOLD_MEMBERS)).toBe(true);
    expect(isHouseholdFull(FREE_HOUSEHOLD_MEMBERS - 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/limits.test.ts`
Expected: FAIL — most of the imported names don't exist yet / wrong signatures.

- [ ] **Step 3: Rewrite `limits.ts`**

Replace `src/limits/limits.ts` entirely with:

```typescript
export function isSubscriptionActive(household: { trialEndsAt?: number | null }): boolean {
  return (household.trialEndsAt ?? 0) > Date.now();
}

export const FREE_CUSTOM_FIELDS_PER_PET = 3;
export const FREE_HOUSEHOLD_MEMBERS = 4;
export const FREE_DOCUMENT_PHOTOS_PER_PET = 30;

export function canAddCustomField(
  pet: { customFields?: { label: string; value: string }[] },
  household: { trialEndsAt?: number | null }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return (pet.customFields?.length ?? 0) < FREE_CUSTOM_FIELDS_PER_PET;
}

export function customFieldLimitMessage(): string {
  return `The free plan includes ${FREE_CUSTOM_FIELDS_PER_PET} custom fields per pet. Upgrading unlocks unlimited custom fields.`;
}

// Unchanged on purpose — still used by householdService.ts's joinHousehold
// pre-check, which has no access to trialEndsAt. See this plan's Global
// Constraints.
export function isHouseholdFull(memberCount: number): boolean {
  return memberCount >= FREE_HOUSEHOLD_MEMBERS;
}

export function householdMemberLimitMessage(): string {
  return `The free plan includes up to ${FREE_HOUSEHOLD_MEMBERS} household members. Upgrading lifts the limit.`;
}

export function canAddHouseholdMember(
  household: { trialEndsAt?: number | null; members: unknown[] }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return !isHouseholdFull(household.members.length);
}

export function canAddDocumentPage(
  pageCountSoFar: number,
  household: { trialEndsAt?: number | null }
): boolean {
  if (isSubscriptionActive(household)) return true;
  return pageCountSoFar < FREE_DOCUMENT_PHOTOS_PER_PET;
}

export function documentPhotoLimitMessage(): string {
  return `The free plan includes ${FREE_DOCUMENT_PHOTOS_PER_PET} document photos per pet. Upgrading unlocks unlimited photos.`;
}

export function canGeneratePassport(household: { trialEndsAt?: number | null }): boolean {
  return isSubscriptionActive(household);
}

export function passportLimitMessage(): string {
  return 'Generating a pet passport is a paid feature. Start your free trial or upgrade to use it.';
}

export function canShareDocument(household: { trialEndsAt?: number | null }): boolean {
  return isSubscriptionActive(household);
}

export function shareDocumentLimitMessage(): string {
  return 'Sharing documents is a paid feature. Start your free trial or upgrade to use it.';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/limits.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Update every existing call site's signature**

`src/navigation/AddPetScreen.tsx` — `useHousehold()` is already imported and
`household` already destructured (confirmed at the top of this file). Change
line `const atLimit = !canAddCustomField(data);` to:

```typescript
        const atLimit = !canAddCustomField(data, household ?? { trialEndsAt: null });
```

`src/navigation/EditPetScreen.tsx` — `household` is already destructured at
the top of this file. Change both occurrences:

```typescript
        title={!canAddCustomField(pet, household ?? { trialEndsAt: null }) ? customFieldLimitMessage() : 'Add a custom field'}
        variant="outline"
        disabled={!canAddCustomField(pet, household ?? { trialEndsAt: null })}
```

`src/navigation/HouseholdScreen.tsx` — change:

```typescript
  const atLimit = household ? !canAddHouseholdMember(household) : false;
```

No change needed here — `household` (when non-null) already carries
`trialEndsAt` once Task 1 Step 1 lands, and `canAddHouseholdMember`'s new
signature accepts the same shape it already receives. Confirm this compiles;
if `tsc` complains about a missing `trialEndsAt` on the type passed in, it's
because `household` is typed as `Household | null` and TypeScript narrows
correctly inside the ternary — no edit needed, this step is a verification
checkpoint, not a code change.

`src/navigation/AddDocumentScreen.tsx` — `household` is already destructured.
Change:

```typescript
    if (!canAddDocumentPage(petPageCountSoFar + pageUrls.length)) {
```
to:
```typescript
    if (!canAddDocumentPage(petPageCountSoFar + pageUrls.length, household ?? { trialEndsAt: null })) {
```

`src/navigation/PetHomeScreen.tsx` — `household` is already destructured
(confirmed near the top of this file). Import `canGeneratePassport,
passportLimitMessage` from `'../limits/limits'` alongside this file's
existing imports. Change `handleGeneratePassport` (currently):

```typescript
  const handleGeneratePassport = async () => {
    setGeneratingPassport(true);
    setPassportError(null);
    try {
      await generatePassport(pet, vaccines, vets);
    } catch (e: any) {
      setPassportError(e.message);
    } finally {
      setGeneratingPassport(false);
    }
  };
```
to:
```typescript
  const handleGeneratePassport = async () => {
    if (!household || !canGeneratePassport(household)) {
      setPassportError(passportLimitMessage());
      return;
    }
    setGeneratingPassport(true);
    setPassportError(null);
    try {
      await generatePassport(pet, vaccines, vets);
    } catch (e: any) {
      setPassportError(e.message);
    } finally {
      setGeneratingPassport(false);
    }
  };
```

`src/navigation/DocumentListScreen.tsx` — `household` is already
destructured. Import `canShareDocument, shareDocumentLimitMessage` from
`'../limits/limits'`. This screen currently has no local error state (the
share icon just navigates); add one, matching this file's existing
`useState` conventions:

```typescript
  const [shareError, setShareError] = useState<string | null>(null);
```

Change the share icon's `onPress` (currently
`() => navigation.navigate('ShareDocument', { documentId: item.id })`) to:

```typescript
              onPress={() => {
                if (!household || !canShareDocument(household)) {
                  setShareError(shareDocumentLimitMessage());
                  return;
                }
                navigation.navigate('ShareDocument', { documentId: item.id });
              }}
```

Render `{shareError && <ErrorText>{shareError}</ErrorText>}` directly below
the existing `showStorageWarning` banner block. This file's existing
`components/ui` import line is currently:

```typescript
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
```

Change it to add `ErrorText`:

```typescript
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState, ErrorText } from '../components/ui';
```

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit` — expect zero errors (this is what actually proves
every call site was updated; a missed one fails here, not silently).
Run: `npx jest` — expect every non-rules suite to pass.

- [ ] **Step 7: Commit**

```bash
git add src/types/household.ts src/limits/limits.ts src/navigation/AddPetScreen.tsx src/navigation/EditPetScreen.tsx src/navigation/HouseholdScreen.tsx src/navigation/AddDocumentScreen.tsx src/navigation/PetHomeScreen.tsx src/navigation/DocumentListScreen.tsx __tests__/limits.test.ts
git commit -m "feat: wire limits.ts to household trial state instead of hardcoded-only constants"
```

---

### Task 2: Trial auto-start

**Files:**
- Modify: `src/household/householdService.ts`
- Modify: `src/household/HouseholdContext.tsx`
- Test: `__tests__/householdService.test.ts` (extend)

**Interfaces:**
- Consumes: `Household` (Task 1, now carries `trialStartedAt`/`trialEndsAt`).
- Produces: `startTrialIfNeeded(db, householdId, household): Promise<void>` —
  a no-op if `household.trialStartedAt` is already set.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/householdService.test.ts` (its existing mock setup —
`mockUpdateDoc`, `doc()` returning `mockHouseholdDocRef` for the
`'households'` path — already covers this; no mock changes needed):

```typescript
  it('startTrialIfNeeded sets trialStartedAt/trialEndsAt 14 days apart, only when unset', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await startTrialIfNeeded(fakeDb, 'h1', { trialStartedAt: null } as any);

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockHouseholdDocRef, {
      trialStartedAt: 1_700_000_000_000,
      trialEndsAt: 1_700_000_000_000 + 14 * 24 * 60 * 60 * 1000,
    });
    jest.restoreAllMocks();
  });

  it('startTrialIfNeeded does nothing when trialStartedAt is already set', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await startTrialIfNeeded(fakeDb, 'h1', { trialStartedAt: 1_600_000_000_000 } as any);

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
```

Add `startTrialIfNeeded` to this file's existing import line from
`'../src/household/householdService'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/householdService.test.ts`
Expected: FAIL — `startTrialIfNeeded is not a function`.

- [ ] **Step 3: Implement `startTrialIfNeeded`**

Append to `src/household/householdService.ts`:

```typescript
const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

// Called from HouseholdContext's trial-start effect (see that file) — a
// no-op once trialStartedAt is set, so it's safe to call on every load.
// A literal computed timestamp, not any kind of increment/transform, so
// this carries none of the increment()-on-RNFB risk documented elsewhere
// in this codebase.
export async function startTrialIfNeeded(
  db: Firestore,
  householdId: string,
  household: Pick<Household, 'trialStartedAt'>
): Promise<void> {
  if (household.trialStartedAt) return;
  const now = Date.now();
  await updateDoc(doc(db, 'households', householdId), {
    trialStartedAt: now,
    trialEndsAt: now + TRIAL_LENGTH_MS,
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/householdService.test.ts`
Expected: PASS, all cases including the two new ones.

- [ ] **Step 5: Wire the effect into `HouseholdContext.tsx`**

This file already has a `migratedHouseholdIdRef` effect (Step 3 in its own
comments) with this exact shape — mirror it, don't invent a new pattern.
Add, right after that existing migration effect:

```typescript
  // Sub-project A of Plan 9: start this household's 14-day trial the first
  // time it's ever seen with no trialStartedAt — covers both a brand-new
  // household (this fires within moments of createHousehold) and every
  // pre-existing household (this fires the next time any of its members
  // opens the app after this ships). Same fire-and-forget, ref-guarded
  // shape as the migration effect above; errors just logged, never blocks
  // rendering.
  const trialStartedHouseholdIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!household) return;
    if (household.trialStartedAt) return;
    if (trialStartedHouseholdIdRef.current === household.id) return;
    trialStartedHouseholdIdRef.current = household.id;

    startTrialIfNeeded(firestore, household.id, household).catch(console.error);
  }, [household]);
```

Add `startTrialIfNeeded` to this file's existing import from
`'./householdService'`.

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npx jest` — expect every non-rules suite to pass.

- [ ] **Step 7: Commit**

```bash
git add src/household/householdService.ts src/household/HouseholdContext.tsx __tests__/householdService.test.ts
git commit -m "feat: auto-start a household's 14-day trial the first time it's seen with none"
```

---

### Task 3: Trial status card on `HouseholdScreen`

**Files:**
- Modify: `src/navigation/HouseholdScreen.tsx`

**Interfaces:**
- Consumes: `household.trialEndsAt` (Task 1); `isSubscriptionActive` (Task 1,
  `../limits/limits`).
- Produces: nothing new for later tasks — this is a leaf UI addition.

- [ ] **Step 1: Add the trial-status card**

In `src/navigation/HouseholdScreen.tsx`, import `isSubscriptionActive` from
`'../limits/limits'` alongside the existing limits import on that line. Add,
directly below the existing invite-code `<Card>` block (before the
`<MutedText>{household?.members.length ?? 0} of {FREE_HOUSEHOLD_MEMBERS} members</MutedText>`
line):

```typescript
      {household && (
        <Card style={{ gap: spacing.xs }}>
          <Subtitle>
            {isSubscriptionActive(household)
              ? `Free trial — ${Math.max(0, Math.ceil(((household.trialEndsAt ?? 0) - Date.now()) / (24 * 60 * 60 * 1000)))} days left`
              : 'Trial ended'}
          </Subtitle>
        </Card>
      )}
```

This is read-only for this sub-project — no "Upgrade" button yet (that's
the real Google Play Billing sub-project's entry point, out of scope here
per the design spec).

- [ ] **Step 2: Manual verification**

No new unit test for this — it's a pure render of already-tested
(`isSubscriptionActive`, Task 1) logic into JSX with no branching this
project's UI-testing convention covers (this codebase has no component
render tests anywhere; screens are verified on-device, per `CLAUDE.md`).
Run `npx tsc --noEmit` to confirm it compiles.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/HouseholdScreen.tsx
git commit -m "feat: show trial status on the Household screen"
```

---

### Task 4: Sitter access — types, service, and Firestore rules

**Files:**
- Create: `src/types/sitterAccess.ts`
- Create: `src/sitters/sitterService.ts`
- Modify: `firestore.rules`
- Test: `__tests__/sitterService.test.ts`
- Test: `__tests__/firestore.rules.test.ts` (extend)

**Interfaces:**
- Consumes: `Household` (Task 1); `isHouseholdMember` (existing rules
  helper).
- Produces: `SitterAccessGrant` type; `createSitterInvite(db, householdId,
  petIds, expiresAt): Promise<string>` (returns the generated code);
  `redeemSitterInvite(db, sitterUid, code): Promise<void>`;
  `revokeSitterAccess(db, householdId, sitterUid): Promise<void>`;
  `subscribeToSitterGrants(db, householdId, callback): Unsubscribe`;
  `subscribeToMySitterGrants(db, sitterUid, callback): Unsubscribe`.

- [ ] **Step 1: Write the types**

Create `src/types/sitterAccess.ts`:

```typescript
export interface SitterAccessGrant {
  sitterUid: string; // same value as this document's own ID — see firestore.rules
  householdId: string;
  petIds: string[];
  expiresAt: number; // epoch millis
  revoked: boolean;
  code: string; // the sitterInviteCodes code redeemed to create this grant
}

export interface SitterInviteCode {
  householdId: string;
  petIds: string[];
  expiresAt: number;
}
```

- [ ] **Step 2: Write the failing tests for `sitterService.ts`**

Create `__tests__/sitterService.test.ts`:

```typescript
import type { Firestore } from '@react-native-firebase/firestore';

const mockCodeDocRef = { id: 'ABC123' };
const mockGrantDocRef = { id: 'sitter-uid-1' };
const mockCollectionGroupRef = { __name: 'collectionGroup:sitterAccess' };
const mockCollectionRef = {};
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __isQuery: true, args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ __where: args }));
const mockCollectionGroup = jest.fn(() => mockCollectionGroupRef);

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn(() => mockCollectionRef),
  collectionGroup: (...args: unknown[]) => mockCollectionGroup(...args),
  doc: jest.fn((_refOrDb: unknown, ...segments: string[]) => {
    if (segments.includes('sitterInviteCodes')) return mockCodeDocRef;
    if (segments.includes('sitterAccess')) return mockGrantDocRef;
    return mockCodeDocRef;
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

import {
  createSitterInvite, redeemSitterInvite, revokeSitterAccess,
  subscribeToSitterGrants, subscribeToMySitterGrants,
} from '../src/sitters/sitterService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sitterService', () => {
  it('createSitterInvite writes a sitterInviteCodes doc and returns its code', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    const code = await createSitterInvite(fakeDb, 'h1', ['pet-1', 'pet-2'], 2000);

    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    expect(mockSetDoc).toHaveBeenCalledWith(mockCodeDocRef, {
      householdId: 'h1', petIds: ['pet-1', 'pet-2'], expiresAt: 2000,
    });
  });

  it('redeemSitterInvite reads the code doc, then writes a matching sitterAccess doc', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000 }),
    });
    mockSetDoc.mockResolvedValue(undefined);

    await redeemSitterInvite(fakeDb, 'sitter-uid-1', 'ABC123');

    expect(mockSetDoc).toHaveBeenCalledWith(mockGrantDocRef, {
      sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'],
      expiresAt: 2000, revoked: false, code: 'ABC123',
    });
  });

  it('redeemSitterInvite throws a friendly error for an unknown code', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(redeemSitterInvite(fakeDb, 'sitter-uid-1', 'NOPE99')).rejects.toThrow('Invite code not found');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('revokeSitterAccess sets revoked: true on the sitter\'s own grant doc', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await revokeSitterAccess(fakeDb, 'h1', 'sitter-uid-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockGrantDocRef, { revoked: true });
  });

  it('subscribeToSitterGrants subscribes to the household\'s sitterAccess collection', () => {
    const callback = jest.fn();
    const fakeGrant = { sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000, revoked: false, code: 'ABC123' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeGrant }] });
      return () => {};
    });

    subscribeToSitterGrants(fakeDb, 'h1', callback);

    expect(callback).toHaveBeenCalledWith([fakeGrant]);
  });

  it('subscribeToMySitterGrants queries the sitterAccess collection group by sitterUid', () => {
    const callback = jest.fn();
    const fakeGrant = { sitterUid: 'sitter-uid-1', householdId: 'h1', petIds: ['pet-1'], expiresAt: 2000, revoked: false, code: 'ABC123' };
    mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
      cb({ docs: [{ data: () => fakeGrant }] });
      return () => {};
    });

    subscribeToMySitterGrants(fakeDb, 'sitter-uid-1', callback);

    expect(mockCollectionGroup).toHaveBeenCalledWith(fakeDb, 'sitterAccess');
    expect(mockWhere).toHaveBeenCalledWith('sitterUid', '==', 'sitter-uid-1');
    expect(callback).toHaveBeenCalledWith([fakeGrant]);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest __tests__/sitterService.test.ts`
Expected: FAIL — `Cannot find module '../src/sitters/sitterService'`.

- [ ] **Step 4: Implement `sitterService.ts`**

Create `src/sitters/sitterService.ts`:

```typescript
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/sitterService.test.ts`
Expected: PASS, all 7 cases.

- [ ] **Step 6: Add the Firestore rules helpers and collections**

In `firestore.rules`, add these two helper functions directly after the
existing `isHouseholdMember` function (before the first `match
/households/{householdId}` block):

```
    // Sub-project A of Plan 9. A sitter's read grant lives at a document ID
    // equal to their own uid — this is what makes every check below a
    // single known-path get(), the same idiom isHouseholdMember uses, with
    // no query needed. get() on a missing document errors, which Firestore
    // treats as a denial — same fail-closed reasoning as isHouseholdMember,
    // so there is no explicit "grant exists" check below. Each function
    // reads the grant document exactly once (a `let` binding, not a
    // repeated get() per field) — referencing sitterGrant(...) three times
    // in one expression would otherwise cost three separate reads per check.
    function isValidSitterForPet(householdId, petId) {
      let grant = get(/databases/$(database)/documents/households/$(householdId)/sitterAccess/$(request.auth.uid)).data;
      return request.auth != null &&
        grant.revoked == false &&
        grant.expiresAt > request.time &&
        petId in grant.petIds;
    }

    // For events/vets, which carry petIds as a field rather than being
    // nested under one pet.
    function isValidSitterForAnyPet(householdId, petIds) {
      let grant = get(/databases/$(database)/documents/households/$(householdId)/sitterAccess/$(request.auth.uid)).data;
      return request.auth != null &&
        grant.revoked == false &&
        grant.expiresAt > request.time &&
        grant.petIds.hasAny(petIds);
    }

    // Used only by sitterAccess's own create rule below — a `let` inside a
    // named function (Firestore rules only allows `let` bindings inside a
    // function body, never inline within an `allow` expression itself, so
    // this cannot be written directly in the match block below). One get(),
    // not three, for the same reason as the functions above.
    function matchesSitterInviteCode(code, householdId, petIds, expiresAt) {
      let inviteCode = get(/databases/$(database)/documents/sitterInviteCodes/$(code)).data;
      return inviteCode.householdId == householdId &&
        inviteCode.petIds == petIds &&
        inviteCode.expiresAt == expiresAt;
    }
```

- [ ] **Step 7: Widen every existing `allow read` that should admit a valid sitter**

In `firestore.rules`, change each of these (leave `allow create`/`update`/
`delete` on every one of them untouched — a sitter is read-only, full stop):

`match /households/{householdId}/pets/{petId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/pets/{petId}/vaccines/{vaccineId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/pets/{petId}/medications/{medicationId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/pets/{petId}/weightLogs/{logId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/pets/{petId}/expenses/{expenseId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/pets/{petId}/vetVisits/{visitId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, petId);
```

`match /households/{householdId}/events/{eventId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForAnyPet(householdId, resource.data.petIds);
```

`match /households/{householdId}/vets/{vetId}`:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForAnyPet(householdId, resource.data.petIds);
```

`match /households/{householdId}/documents/{documentId}` — `petId` is a
*field* on this document, not a path segment:
```
      allow read: if isHouseholdMember(householdId) || isValidSitterForPet(householdId, resource.data.petId);
```

`match /households/{householdId}/documents/{documentId}/pages/{pageId}` —
neither `petId` nor a path segment gives this directly; read the parent
document to find it:
```
      allow read: if isHouseholdMember(householdId) ||
        isValidSitterForPet(householdId, get(/databases/$(database)/documents/households/$(householdId)/documents/$(documentId)).data.petId);
```

- [ ] **Step 8: Add the `sitterAccess` and `sitterInviteCodes` rules blocks**

Add, directly after the `documents/{documentId}/pages/{pageId}` block in
`firestore.rules`:

```
    // Sub-project A of Plan 9. Document ID == the sitter's own uid — see
    // sitterGrant() above for why.
    match /households/{householdId}/sitterAccess/{sitterUid} {
      // Direct-path access: any household member managing sitters, or the
      // sitter reading their own grant.
      allow get: if isHouseholdMember(householdId) || (request.auth != null && request.auth.uid == sitterUid);
      // collectionGroup query access (subscribeToMySitterGrants): provable
      // per-document since the query's own where('sitterUid','==',uid)
      // clause matches this condition exactly — the same reasoning
      // firestore.rules already documents for every other query in this
      // file, just satisfied instead of failed this time.
      allow list: if request.auth != null && resource.data.sitterUid == request.auth.uid;
      // The sitter creates their own grant by redeeming a code — the write
      // must exactly match what that code specifies, so a sitter can never
      // grant themselves broader pets or a later expiry than the code
      // allows. This is the same "cross-check against the exact document
      // driving this write" pattern isJoining() uses for joinCodeUsed.
      allow create: if request.auth != null && request.auth.uid == sitterUid &&
        request.resource.data.sitterUid == sitterUid &&
        request.resource.data.householdId == householdId &&
        request.resource.data.revoked == false &&
        request.resource.data.keys().hasOnly(['sitterUid', 'householdId', 'petIds', 'expiresAt', 'revoked', 'code']) &&
        request.resource.data.code is string &&
        matchesSitterInviteCode(request.resource.data.code, householdId, request.resource.data.petIds, request.resource.data.expiresAt);
      // Revoking early: any household member can flip revoked to true, and
      // only that field — no other field on an existing grant is ever
      // updatable via this rule.
      allow update: if isHouseholdMember(householdId) &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['revoked']) &&
        request.resource.data.revoked == true;
      allow delete: if false;
    }

    // Maps a shareable sitter-invite code to what it grants, mirroring
    // inviteCodes exactly: allow get ONLY, never list (see inviteCodes'
    // own comment for why an unrestricted list would let any signed-in
    // user dump every code -> household mapping).
    match /sitterInviteCodes/{code} {
      allow get: if request.auth != null;
      allow list: if false;
      allow create: if isHouseholdMember(request.resource.data.householdId) &&
        request.resource.data.keys().hasOnly(['householdId', 'petIds', 'expiresAt']) &&
        request.resource.data.expiresAt > request.time;
      allow update: if false;
      allow delete: if false;
    }
```

- [ ] **Step 9: Write the new `firestore.rules.test.ts` cases**

Append to `__tests__/firestore.rules.test.ts`, inside the existing
`describe('household security rules', ...)` block (reuse the existing
`seedPetHousehold` helper defined there):

```typescript
  // Sub-project A of Plan 9: sitter access.
  const seedSitterGrant = async (overrides: Partial<{ petIds: string[]; expiresAt: number; revoked: boolean; code: string }> = {}) => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sitterInviteCodes', 'SITCODE1'), {
        householdId: 'h1', petIds: overrides.petIds ?? ['pet-1'], expiresAt: overrides.expiresAt ?? Date.now() + 100000,
      });
      await setDoc(doc(context.firestore(), 'households', 'h1', 'sitterAccess', 'sitter-1'), {
        sitterUid: 'sitter-1', householdId: 'h1',
        petIds: overrides.petIds ?? ['pet-1'], expiresAt: overrides.expiresAt ?? Date.now() + 100000,
        revoked: overrides.revoked ?? false, code: overrides.code ?? 'SITCODE1',
      });
    });
  };

  const seedGrantedPet = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', speciesOther: null,
        breed: 'Labrador', birthDate: 0, birthDatePrecision: 'exact', approximateAgeMonths: null,
        arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#EF4444',
        sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
        microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
        customFields: [], status: 'active',
      });
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-2'), {
        id: 'pet-2', householdId: 'h1', name: 'Milo', species: 'cat', speciesOther: null,
        breed: '', birthDate: 0, birthDatePrecision: 'exact', approximateAgeMonths: null,
        arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#3B82F6',
        sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
        microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
        customFields: [], status: 'active',
      });
    });
  };

  it('allows a valid, non-expired sitter to read a pet they were granted', async () => {
    await seedPetHousehold();
    await seedGrantedPet();
    await seedSitterGrant();
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertSucceeds(getDoc(doc(sitterDb, 'households', 'h1', 'pets', 'pet-1')));
  });

  it('denies an expired sitter', async () => {
    await seedPetHousehold();
    await seedGrantedPet();
    await seedSitterGrant({ expiresAt: Date.now() - 1000 });
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertFails(getDoc(doc(sitterDb, 'households', 'h1', 'pets', 'pet-1')));
  });

  it('denies a sitter reading a pet they were not granted', async () => {
    await seedPetHousehold();
    await seedGrantedPet();
    await seedSitterGrant({ petIds: ['pet-1'] });
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertFails(getDoc(doc(sitterDb, 'households', 'h1', 'pets', 'pet-2')));
  });

  it('denies a revoked sitter even before their expiresAt', async () => {
    await seedPetHousehold();
    await seedGrantedPet();
    await seedSitterGrant({ revoked: true });
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertFails(getDoc(doc(sitterDb, 'households', 'h1', 'pets', 'pet-1')));
  });

  it('denies a sitter writing anything', async () => {
    await seedPetHousehold();
    await seedGrantedPet();
    await seedSitterGrant();
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertFails(updateDoc(doc(sitterDb, 'households', 'h1', 'pets', 'pet-1'), { name: 'Hacked' }));
  });

  it('a household member can revoke a sitter grant, flipping only revoked', async () => {
    await seedPetHousehold();
    await seedSitterGrant();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1', 'sitterAccess', 'sitter-1'), { revoked: true })
    );
  });

  it('denies redeeming a code with broader petIds than the code specifies', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sitterInviteCodes', 'SITCODE1'), {
        householdId: 'h1', petIds: ['pet-1'], expiresAt: Date.now() + 100000,
      });
    });
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertFails(
      setDoc(doc(sitterDb, 'households', 'h1', 'sitterAccess', 'sitter-1'), {
        sitterUid: 'sitter-1', householdId: 'h1', petIds: ['pet-1', 'pet-2'],
        expiresAt: Date.now() + 100000, revoked: false, code: 'SITCODE1',
      })
    );
  });

  it('allows redeeming a code exactly matching its own petIds/expiresAt', async () => {
    await seedPetHousehold();
    const expiresAt = Date.now() + 100000;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'sitterInviteCodes', 'SITCODE1'), {
        householdId: 'h1', petIds: ['pet-1'], expiresAt,
      });
    });
    const sitterDb = testEnv.authenticatedContext('sitter-1').firestore();
    await assertSucceeds(
      setDoc(doc(sitterDb, 'households', 'h1', 'sitterAccess', 'sitter-1'), {
        sitterUid: 'sitter-1', householdId: 'h1', petIds: ['pet-1'],
        expiresAt, revoked: false, code: 'SITCODE1',
      })
    );
  });

  it('a household member can create a sitter invite code', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'sitterInviteCodes', 'SITCODE1'), {
        householdId: 'h1', petIds: ['pet-1'], expiresAt: Date.now() + 100000,
      })
    );
  });

  it('denies a non-member creating a sitter invite code for someone else\'s household', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'sitterInviteCodes', 'SITCODE1'), {
        householdId: 'h1', petIds: ['pet-1'], expiresAt: Date.now() + 100000,
      })
    );
  });
```

This test file's imports already include everything these cases need
(`doc`, `getDoc`, `setDoc`, `updateDoc`, `assertSucceeds`, `assertFails`) —
no new import line required.

- [ ] **Step 10: Run the emulator rules tests**

Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`
Expected: every test passes, including the new ones (requires the Firebase
CLI and a JRE — see `CLAUDE.md`'s Testing section; plain `npx jest` on this
file fails with `ECONNREFUSED`, which is not a code defect).

- [ ] **Step 11: Full verification**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npx jest` — expect every non-rules suite to pass (the rules suite
itself only passes under the emulator, per Step 10).

- [ ] **Step 12: Commit**

```bash
git add src/types/sitterAccess.ts src/sitters/sitterService.ts firestore.rules __tests__/sitterService.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: sitter access data model, service, and rules-enforced expiry"
```

---

### Task 5: "Invite a Sitter" screen

**Files:**
- Create: `src/navigation/InviteSitterScreen.tsx`
- Modify: `src/navigation/AddSheet.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `createSitterInvite` (Task 4, `../sitters/sitterService`);
  `subscribeToPets`, `activePets` (existing, `../pets/petService`);
  `petColor` (existing, `../theme/petColors`); `DateField` (existing,
  `../components/DateField`).
- Produces: nothing later tasks depend on directly (Task 6's sitters list
  reads live data via `subscribeToSitterGrants`, not through this screen).

- [ ] **Step 1: Write `InviteSitterScreen.tsx`**

Create `src/navigation/InviteSitterScreen.tsx`, following `AddVetScreen.tsx`'s
exact pet-multi-select pattern (`togglePet`, the same `Pressable` row
styling) since that's this project's one established multi-pet-picker UI —
not inventing a second one:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Pressable, Share } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { createSitterInvite } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { petColor } from '../theme/petColors';
import { Pet } from '../types/pet';
import { DateField } from '../components/DateField';
import { ScreenContainer, Button, Title, BodyText, MutedText, ErrorText } from '../components/ui';
import { colors, spacing, radii } from '../theme/theme';

export function InviteSitterScreen() {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [petIds, setPetIds] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const togglePet = (petId: string) => {
    setPetIds((prev) => (prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]));
  };

  const handleGenerate = async () => {
    if (!household || petIds.length === 0 || expiresAt == null) return;
    setError(null);
    setLoading(true);
    try {
      const generated = await createSitterInvite(firestore, household.id, petIds, expiresAt);
      setCode(generated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!code) return;
    Share.share({
      message: `You've been invited to sit for our pets on Pet Health Tracker! Use sitter code: ${code}`,
    });
  };

  if (code) {
    return (
      <ScreenContainer style={{ justifyContent: 'center', flexGrow: 1 }}>
        <Title>Sitter code generated</Title>
        <Title style={{ letterSpacing: 4 }}>{code}</Title>
        <MutedText>Share this with your sitter. It expires on {new Date(expiresAt!).toLocaleDateString()}.</MutedText>
        <Button title="Share sitter code" onPress={handleShare} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Title>Invite a sitter</Title>
      <BodyText style={{ fontWeight: '700' }}>Which pets?</BodyText>
      <View style={{ gap: spacing.sm }}>
        {pets.map((pet) => {
          const selected = petIds.includes(pet.id);
          return (
            <Pressable
              key={pet.id}
              onPress={() => togglePet(pet.id)}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
                borderRadius: radii.md, borderWidth: 1.5,
                borderColor: selected ? petColor(pet) : colors.border,
                backgroundColor: selected ? colors.surfaceTint : colors.surface,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(pet) }} />
              <BodyText>{pet.name}</BodyText>
            </Pressable>
          );
        })}
      </View>
      <DateField label="Access ends on" value={expiresAt} onChange={setExpiresAt} />
      {error && <ErrorText>{error}</ErrorText>}
      <Button
        title="Generate sitter code"
        onPress={handleGenerate}
        disabled={petIds.length === 0 || expiresAt == null}
        loading={loading}
      />
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Register the route in `RootNavigator.tsx`**

In `src/navigation/RootNavigator.tsx`, import `InviteSitterScreen` from
`'./InviteSitterScreen'` and add, inside the `household ? (...)` branch,
alongside the existing `AddVet`/`EditVet` screens:

```typescript
            <Stack.Screen
              name="InviteSitter"
              component={InviteSitterScreen}
              options={{ headerShown: true, title: 'Invite a sitter', headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#FFFFFF' }}
            />
```

(This screen is registered at `RootNavigator`'s top level, not inside
`MainNavigator`, matching `AddVet`/`AddEvent`'s existing precedent for a
`topLevel: true` add-sheet action reachable from anywhere.)

- [ ] **Step 3: Add the "Invite a Sitter" entry to `AddSheet.tsx`**

In `src/navigation/AddSheet.tsx`'s `ADD_ACTIONS` array, add one entry
(pick any unused accent colour from this project's existing palette — none
of the current entries use `#EAB308`):

```typescript
  { label: 'Invite a Sitter', emoji: '🐕‍🦺', color: '#EAB308', route: 'InviteSitter', needsPet: false, topLevel: true },
```

- [ ] **Step 4: Full verification**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npx jest` — expect every non-rules suite to still pass (no new unit
tests in this task — this screen has no branching logic beyond what
`createSitterInvite` (already tested in Task 4) and `DateField`/pet-picker
(both pre-existing, reused verbatim) already cover, matching this
codebase's established precedent of not unit-testing Add-screens
themselves — see Task 4's `AddVetScreen.tsx`/`AddDocumentScreen.tsx`
precedent, neither of which has its own test file either).

- [ ] **Step 5: Commit**

```bash
git add src/navigation/InviteSitterScreen.tsx src/navigation/AddSheet.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add the Invite a Sitter screen, reachable from the global + sheet"
```

---

### Task 6: Sitters list + revoke, on `HouseholdScreen`

**Files:**
- Modify: `src/navigation/HouseholdScreen.tsx`

**Interfaces:**
- Consumes: `subscribeToSitterGrants`, `revokeSitterAccess` (Task 4,
  `../sitters/sitterService`); `SitterAccessGrant` (Task 4,
  `../types/sitterAccess`).

- [ ] **Step 1: Add the sitters list**

In `src/navigation/HouseholdScreen.tsx`, import `subscribeToSitterGrants,
revokeSitterAccess` from `'../sitters/sitterService'` and `SitterAccessGrant`
from `'../types/sitterAccess'`. Add state and a subscription, following
this file's existing `useEffect`/`useState` conventions:

```typescript
  const [sitterGrants, setSitterGrants] = useState<SitterAccessGrant[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToSitterGrants(firestore, household.id, setSitterGrants);
  }, [household?.id]);

  const activeSitterGrants = sitterGrants.filter((g) => !g.revoked && g.expiresAt > Date.now());

  const handleRevokeSitter = (grant: SitterAccessGrant) => {
    if (!household) return;
    Alert.alert(
      'Revoke sitter access',
      'This sitter will immediately lose access to the pets they were granted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSitterAccess(firestore, household.id, grant.sitterUid);
            } catch (e: any) {
              Alert.alert('Could not revoke access', e.message);
            }
          },
        },
      ]
    );
  };
```

Add, directly below the existing `<FlatList data={household?.members ?? []} .../>` block (before the `{__DEV__ && (...)}` dev-only section):

```typescript
      {activeSitterGrants.length > 0 && (
        <>
          <Subtitle>Sitters</Subtitle>
          <FlatList
            data={activeSitterGrants}
            keyExtractor={(g) => g.sitterUid}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Subtitle>{item.petIds.length} pet{item.petIds.length === 1 ? '' : 's'}</Subtitle>
                  <MutedText>Until {new Date(item.expiresAt).toLocaleDateString()}</MutedText>
                </View>
                <Button title="Revoke" variant="outline" onPress={() => handleRevokeSitter(item)} />
              </Card>
            )}
          />
        </>
      )}
```

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npx jest` — expect every non-rules suite to still pass (no new unit
test — this is a render of already-tested `sitterService.ts` functions,
matching this file's existing member-list section, which also has no
dedicated render test).

- [ ] **Step 3: Commit**

```bash
git add src/navigation/HouseholdScreen.tsx
git commit -m "feat: list active sitter grants on the Household screen, with revoke"
```

---

### Task 7: Redeeming a sitter invite

**Files:**
- Modify: `src/navigation/HouseholdSetupScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`

**Interfaces:**
- Consumes: `redeemSitterInvite` (Task 4, `../sitters/sitterService`);
  `subscribeToMySitterGrants` (Task 4, same file) — used by Task 8's
  `SitterViewScreen`, not this task, but the routing decision below is what
  makes that screen reachable at all.

- [ ] **Step 1: Add a third mode to `HouseholdSetupScreen.tsx`**

This screen currently has a `mode: 'create' | 'join'` state driving two
`Chip`s. Replace the whole file with this widened, three-way version (the
`create`/`join` branches are unchanged from the current file — only the
`mode` type, imports, the new handler, the third `Chip`, and the third
render branch are new):

```typescript
import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { createHousehold, joinHousehold } from '../household/householdService';
import { redeemSitterInvite } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { ScreenContainer, TextField, Button, ErrorText, Title, MutedText, Chip } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdSetupScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join' | 'sitter'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [sitterCode, setSitterCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await createHousehold(firestore, user.uid, user.email ?? 'Owner', name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await joinHousehold(firestore, user.uid, user.email ?? 'Member', inviteCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemSitterCode = async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      await redeemSitterInvite(firestore, user.uid, sitterCode);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scroll style={{ justifyContent: 'center', flexGrow: 1 }}>
      <Title style={{ marginBottom: spacing.sm }}>Set up your household</Title>
      <MutedText style={{ marginBottom: spacing.md }}>
        Create a new household for your pets, join one with an invite code, or redeem a sitter code.
      </MutedText>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <Chip label="Create new" selected={mode === 'create'} onPress={() => setMode('create')} />
        <Chip label="Join existing" selected={mode === 'join'} onPress={() => setMode('join')} />
        <Chip label="I'm a sitter" selected={mode === 'sitter'} onPress={() => setMode('sitter')} />
      </View>
      {mode === 'create' ? (
        <>
          <TextField label="Household name" placeholder="e.g. The Smith Family" value={name} onChangeText={setName} />
          <Button title="Create household" onPress={handleCreate} loading={loading} />
        </>
      ) : mode === 'join' ? (
        <>
          <TextField
            label="Invite code"
            placeholder="6-character code"
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          <Button title="Join household" onPress={handleJoin} loading={loading} />
        </>
      ) : (
        <>
          <TextField
            label="Sitter code"
            placeholder="8-character code"
            autoCapitalize="characters"
            value={sitterCode}
            onChangeText={setSitterCode}
          />
          <Button title="Redeem sitter code" onPress={handleRedeemSitterCode} loading={loading} />
        </>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </ScreenContainer>
  );
}
```

- [ ] **Step 2: Route a signed-in, no-household user with a sitter grant to `SitterViewScreen`**

In `src/navigation/RootNavigator.tsx`, the current gate is `household ? (...)
: <HouseholdSetupScreen />`. A user who just redeemed a sitter code has no
`household` (they were never added to `memberIds`) — `HouseholdContext`
correctly still resolves `household: null` for them. Add a new piece of
state: whether this signed-in, no-household user has at least one sitter
grant, using `subscribeToMySitterGrants` from Task 4.

Add, near the top of `RootNavigator`, importing `subscribeToMySitterGrants`
from `'../sitters/sitterService'`, `SitterAccessGrant` from
`'../types/sitterAccess'`, `firestore` from `'../firebase/config'`, and
`SitterViewScreen` from `'./SitterViewScreen'` (Task 8):

```typescript
  const [sitterGrants, setSitterGrants] = useState<SitterAccessGrant[]>([]);

  useEffect(() => {
    if (!user || household) {
      setSitterGrants([]);
      return;
    }
    return subscribeToMySitterGrants(firestore, user.uid, setSitterGrants);
  }, [user, household]);

  const activeSitterGrants = sitterGrants.filter((g) => !g.revoked && g.expiresAt > Date.now());
```

Change the gate from:
```typescript
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
```
to:
```typescript
        ) : activeSitterGrants.length > 0 ? (
          <Stack.Screen name="SitterView" component={SitterViewScreen} />
        ) : (
          <Stack.Screen name="HouseholdSetup" component={HouseholdSetupScreen} />
        )}
```

This file's current first line is `import React from 'react';` (no named
imports). Change it to:

```typescript
import React, { useState, useEffect } from 'react';
```

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit` — expect zero errors (this will fail until Task 8
creates `SitterViewScreen.tsx` — if executing tasks in order, do Task 8's
Step 1 file-creation first, or accept a transient red state within this one
task's own work-in-progress; the task isn't complete until `tsc` passes
clean).
Run: `npx jest` — expect every non-rules suite to still pass.

- [ ] **Step 4: Commit**

```bash
git add src/navigation/HouseholdSetupScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: redeem a sitter invite code, and route a sitter to their own read-only view"
```

---

### Task 8: `SitterViewScreen`

**Files:**
- Create: `src/navigation/SitterViewScreen.tsx`

**Interfaces:**
- Consumes: `subscribeToMySitterGrants` (Task 4); `subscribeToPets` (existing,
  `../pets/petService`, called per-household for the pets this sitter can
  see); `petColor` (existing, `../theme/petColors`); `speciesDisplay`,
  `SPECIES_EMOJI` (existing, `../pets/species`).

- [ ] **Step 1: Write `SitterViewScreen.tsx`**

A minimal, read-only screen — no tabs, no "+", no edit affordances anywhere.
Reuses `PetHomeScreen`'s existing per-pet record navigation is explicitly
**not** done here (that screen assumes a household member's full navigation
context, `usePetSelection()`, etc.) — this is a deliberately separate,
narrower screen, per the design spec's "a sitter is someone without their
own household in this app" scope decision.

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { subscribeToMySitterGrants } from '../sitters/sitterService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { SitterAccessGrant } from '../types/sitterAccess';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { SPECIES_EMOJI, speciesDisplay } from '../pets/species';
import { ScreenContainer, Title, Subtitle, MutedText, Card } from '../components/ui';
import { spacing } from '../theme/theme';

// A grant plus the resolved Pet objects it covers, from that grant's own
// household — one entry per household that has ever granted this sitter
// access, since subscribeToMySitterGrants can return grants from more than
// one household at once.
interface GrantedHousehold {
  grant: SitterAccessGrant;
  pets: Pet[];
}

export function SitterViewScreen() {
  const { user, logOut } = useAuth();
  const [grants, setGrants] = useState<SitterAccessGrant[]>([]);
  const [granted, setGranted] = useState<GrantedHousehold[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMySitterGrants(firestore, user.uid, setGrants);
  }, [user]);

  useEffect(() => {
    const activeGrants = grants.filter((g) => !g.revoked && g.expiresAt > Date.now());
    const unsubs = activeGrants.map((grant) =>
      subscribeToPets(firestore, grant.householdId, (allPets) => {
        setGranted((prev) => {
          const withoutThis = prev.filter((g) => g.grant.householdId !== grant.householdId);
          const grantedPets = allPets.filter((p) => grant.petIds.includes(p.id));
          return [...withoutThis, { grant, pets: grantedPets }];
        });
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [grants]);

  const allPets = granted.flatMap((g) => g.pets);

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>Pets you're sitting for</Title>
      <MutedText>Read-only access, granted by the pet's household.</MutedText>
      <FlatList
        data={allPets}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: petColor(item) }} />
            <View>
              <Subtitle>{SPECIES_EMOJI[item.species] ?? '🐾'} {item.name}</Subtitle>
              <MutedText>{speciesDisplay(item)}{item.breed ? ` · ${item.breed}` : ''}</MutedText>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text style={{ padding: spacing.md }}>No active sitter access right now.</Text>}
      />
    </ScreenContainer>
  );
}
```

(This screen deliberately does not yet drill into a pet's vaccines/meds/vet
visits — that's a real navigation surface a later task can add once this
shell exists and has been seen working; the rules from Task 4 already grant
read access to every subcollection, so nothing about *this* task blocks it.)

- [ ] **Step 2: Full verification**

Run: `npx tsc --noEmit` — expect zero errors (this also resolves Task 7's
transient red state, if tasks were executed in written order).
Run: `npx jest` — expect every non-rules suite to still pass.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/SitterViewScreen.tsx
git commit -m "feat: add SitterViewScreen, a read-only pet list for a signed-in sitter"
```

---

### Task 9: Deploy rules, whole-plan verification, and the on-device checklist

**Files:** none new — this task is verification and a manual deploy, not
code.

- [ ] **Step 1: Deploy the rules**

```bash
firebase deploy --only firestore:rules --project pet-tracker-app-63512
```

Expected output ends with `+ Deploy complete!`. Per this project's own
standing rule (`CLAUDE.md`), this needs the owner's explicit go-ahead before
running, every time — ask first.

- [ ] **Step 2: Full verification pass**

Run: `npx tsc --noEmit` — expect zero errors.
Run: `npx jest` — expect every non-rules test to pass.
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"` — expect every rules test to pass.

- [ ] **Step 3: On-device checklist**

Build from the plan's own worktree via `npx expo run:android`. Per
`CLAUDE.md`'s "Local build environment," recreate `android/local.properties`
and copy `google-services.json` into `android/app/` if this is a fresh
worktree/checkout.

Trial:
- On the owner's real, pre-existing household (which has never had a
  `trialStartedAt`), confirm the trial-status card on the Household tab
  shows "Free trial — 14 days left" shortly after opening the app —
  confirming the auto-start effect actually fired for existing data, not
  just brand-new households.
- Generate a passport and share a document (both previously ungated) and
  confirm they still work — the household is now mid-trial, so
  `canGeneratePassport`/`canShareDocument` should both be `true`.
- Add a 5th household member (or confirm one is already possible) while
  mid-trial, confirming the free 4-member cap is genuinely lifted, not just
  the UI hiding the warning.

Sitter access:
- From the owner's phone, invite a sitter for one pet with a near-future
  end date via "Invite a Sitter," and share the generated code (copy it
  manually for this test — no second device with a receiving app needed if
  testing solo).
- On a second phone/account (or a second emulator user, or a throwaway test
  account signed into the same app), sign up, choose "I'm a sitter," redeem
  the code — confirm it lands on `SitterViewScreen`, not the normal
  household setup flow, and shows exactly the one granted pet, nothing else.
- Confirm that sitter account **cannot** see a second pet that wasn't
  granted, and cannot edit anything (attempt is silently unavailable — no
  edit UI exists on `SitterViewScreen` at all, so this is really confirming
  no other screen in the app is reachable for this account).
- From the owner's phone, revoke that sitter's access via the Household
  tab's sitters list — confirm the sitter's `SitterViewScreen` goes empty
  (may require a force-close/relaunch to see the change, since there's no
  push-driven "your access was just revoked" toast in this sub-project).
- Let a sitter grant's `expiresAt` pass naturally (or seed one with a
  near-immediate expiry for testing) and confirm the same result — access
  is gone once the date passes, not just once revoked.

- [ ] **Step 4: Update `NEXTSTEPS.md`/`CLAUDE.md`**

Once the checklist passes, follow this project's now-established pattern
(see the Plan 8 merge for the exact shape): add a
`docs/history/YYYY-MM-DD-sitter-access-and-trial.md` file recording the
build and on-device verification, add its entry to
`docs/history/plan-log.md`, add a compact architecture-reference paragraph
to `CLAUDE.md`'s "Architecture invariants" section (the `sitterAccess`/
`sitterInviteCodes` collection shape, the `sitterGrant()`/
`isValidSitterForPet()` rules helpers, the collection-group-query discovery
mechanism, the trial-field auto-start pattern, and the deliberate
`paidUntil`-does-not-exist-yet gap), and update `NEXTSTEPS.md`'s resume
state (real Google Play Billing and release prep remain as separate,
later sub-projects of Plan 9 — not started by this plan).
