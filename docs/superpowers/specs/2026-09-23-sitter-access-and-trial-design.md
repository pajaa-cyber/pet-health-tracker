# Sitter access and trial/limits wiring — Design

## Goal

Phase 7 of the execution pack (`docs/superpowers/specs/2026-09-13-execution-pack.md`,
"Phase 7") is "Subscriptions and release" — sitter access, real subscription
enforcement, Google Play Billing, and app-store release prep, bundled as one
phase (~14 tasks). Brainstormed with the owner on 2026-09-23 and **split into
three sub-projects**, since Google Play Billing can't be tested or shipped
until a Play Console/merchant account exists (the owner is handling that
separately, on no fixed timeline):

- **Sub-project A (this spec):** sitter access, and wiring `src/limits/limits.ts`
  to a real (but stubbed) subscription/trial state instead of hardcoded
  constants. Fully buildable and testable today, no real billing required.
- **Sub-project B (later):** real Google Play Billing — replaces the stub
  subscription field with one driven by verified purchases.
- **Sub-project C (later, close to actual publish):** app icon, splash screen,
  store listing, privacy policy, crash reporting.

This spec covers **sub-project A only**.

## Trial and subscription state

`households/{householdId}` gains two new optional fields, following the same
"new fields are optional, no migration needed" convention as every other
field added to this project's documents:

```
trialStartedAt: number | null   // epoch millis, set once, never changed after
trialEndsAt: number | null      // trialStartedAt + 14 days, set at the same time
```

**No `paidUntil`/`subscriptionStatus: 'paid'` field exists yet — deliberately.**
This project's `households/{householdId}` rules `allow update` has no field
allowlist (unlike `allow create`), by design, so `documentsStorageBytes` and
similar denormalized fields can be written by any member without a rules
change per field. A subscription-entitlement field would inherit that same
permissiveness — meaning any household member's client could grant the whole
household "paid" status for free by writing that field directly. Real
entitlement can only be trustworthy once it's set from a server-verified
purchase (sub-project B). `trialStartedAt` has no such risk: it's a one-shot,
time-bound, self-service field with no exploitable value, so it stays
member-writable like everything else on this document.

`src/limits/limits.ts` gains one new function all the others route through:

```typescript
export function isSubscriptionActive(household: { trialEndsAt?: number | null }): boolean {
  return (household.trialEndsAt ?? 0) > Date.now();
}
```

Every existing `canAddX(...)` function (`canAddCustomField`,
`canAddHouseholdMember`, `canAddDocumentPage`) and the two new
passport/sharing/sitter-access gates below take the household as an
additional parameter and return `true` unconditionally when
`isSubscriptionActive(household)` — this is the "no other call site changes"
swap Plan 8's own design spec already anticipated. When the trial (and later,
a real subscription) is inactive, free-tier constants apply exactly as they
do today.

**Nothing a user has already typed in is ever hidden or deleted by falling
out of trial/paid status.** Every existing `canAddX` only gates creating a
*new* item past the cap — a household that had 5 members during its trial
and then lapses keeps all 5, readable and functional; it just can't add a
6th until back under the cap. This is already how every `canAddX` in this
codebase works today (Plans 4, 7, 8) — sub-project A extends the same
pattern to Documents' passport/sharing gates and adds it fresh for sitter
access, it doesn't change the underlying rule.

**Passport and document-sharing gates, newly added:** `canGeneratePassport(household)`
and `canShareDocument(household)`, both trivial (`isSubscriptionActive(household)`) —
Plan 8 built these features fully functional and ungated specifically so this
sub-project only has to add the gate, not the feature.

## Trial lifecycle

`HouseholdContext.tsx` gains one more fire-and-forget effect, the same shape
as its existing one-time migration trigger: the first time `household` loads
with `trialStartedAt` unset, write `trialStartedAt: Date.now()` and
`trialEndsAt: Date.now() + 14 * DAY_MS` immediately. This covers both a
brand-new household (the spec's "14-day trial at signup") and every
pre-existing household, including the owner's own real one — there is no
separate "first paywall hit" code path; the trial is simply always started by
the time any gate is checked; a `canX` check reads `isSubscriptionActive`
which is derived from `trialEndsAt`, so if that effect hasn't landed yet for
whatever reason, the household is correctly treated as not-yet-active rather
than crashing or defaulting open.

A small trial-status affordance on `HouseholdScreen` (a new `Card`, matching
existing conventions there) shows "Free trial — N days left" while active, or
"Trial ended" once `trialEndsAt` has passed with no real subscription — this
is UI-only for sub-project A (no "upgrade" button yet; that's sub-project B's
Play Billing entry point).

## Sitter access

### Data model

```
households/{householdId}/sitterAccess/{sitterUid}
  {
    sitterUid: string     // same as the document ID — this is what makes
                           // rules enforcement possible with a single get(),
                           // no query, matching isHouseholdMember's own idiom
    petIds: string[]
    expiresAt: number      // epoch millis
    revoked: boolean
  }

sitterInviteCodes/{code}
  {
    householdId: string
    petIds: string[]
    expiresAt: number
  }
```

`sitterInviteCodes` mirrors the existing `inviteCodes` collection exactly:
readable by any signed-in user, resolved by a single-document `get()` on a
known code, never a query — the same reason `inviteCodes` exists at all
(a query filtered by code can't be proven safe for a non-member under this
project's rules, per the household-join precedent).

### Auth

A sitter needs a real account — this app has no anonymous auth, and every
existing rule is built around `request.auth.uid`. They sign up or sign in the
exact same way any user does (`AuthContext.tsx`, unchanged), then redeem an
invite code, which is the only new step.

### Redeeming an invite

`redeemSitterInvite(db, code)`: reads `sitterInviteCodes/{code}`, then writes
`households/{householdId}/sitterAccess/{callerUid}` with `petIds`/`expiresAt`
copied verbatim from the code doc and `revoked: false`. The create rule
enforces that the written `petIds`/`expiresAt` **exactly match** the invite
code's own document (a `get()` cross-check, the same anti-tamper shape as
`isJoining()`'s `hasAll(existingMembers)`) — a sitter can never grant
themselves broader pets or a later expiry than what the code specifies.

### Rules enforcement

A new rules helper:

```
function isValidSitter(householdId, petId) {
  let grant = get(/databases/$(database)/documents/households/$(householdId)/sitterAccess/$(request.auth.uid));
  return grant != null
    && !grant.data.revoked
    && grant.data.expiresAt > request.time
    && petId in grant.data.petIds;
}
```

`request.time` is the server's own clock, not client-suppliable — this is
what makes expiry an actual security boundary and not just a UI hint, per
the execution pack's own explicit requirement ("Expiry must be enforced in
the security rules, not only hidden in the interface").

Every `allow read` under `households/{householdId}/pets/{petId}/**` widens
from `isHouseholdMember(householdId)` to
`isHouseholdMember(householdId) || isValidSitter(householdId, petId)` — the
sitter sees everything about their granted pet(s) (profile, vaccines,
medications, vet visits, weight, expenses, documents), nothing curated by
record type, matching the spec's plain "read access" wording and keeping the
rules change mechanical and uniform across every collection rather than
picking and choosing per type.

`vets` and `events` are household-level with a `petIds` array rather than
nested under one pet, so their read rule instead checks
`resource.data.petIds.hasAny(get(.../sitterAccess/$(request.auth.uid)).data.petIds)` —
same underlying grant doc, adapted to the array-membership shape those two
collections already use.

**Writes are never granted to a sitter** — every `allow create`/`update`/`delete`
stays `isHouseholdMember(householdId)` only. A sitter is read-only, full
stop; this needs no new rule, just confirming no existing `allow write`-ish
rule accidentally already matches a broader condition that would leak this.

### Revoking early

A plain `update({ revoked: true })` on the sitter's own `sitterAccess` doc,
performed by any household member (same `isHouseholdMember` write rule every
other household-level collection already has — no new rule needed). One
button on a new sitter-management view.

### UI

- **"Invite a Sitter"** — a new top-level entry in `AddSheet.tsx`'s
  `ADD_ACTIONS` (`topLevel: true`, matching `Add a Vet`/`Add to Calendar`'s
  existing pattern, since pet selection here is a multi-select step inside
  the screen itself, the same way `AddVetScreen`'s own `petIds` picker
  already works — not the single-pet `ChoosePetForAdd` flow). The screen:
  pick one or more pets, pick an end date, generate the code, show it as
  something shareable (a plain string to copy/send — no deep-link
  infrastructure exists in this app yet, and building one is out of scope
  here).
- **A sitters list**, added to `HouseholdScreen` (the natural home — it
  already shows household members and their management actions): every
  non-expired, non-revoked `sitterAccess` grant across the household, which
  pet(s) it covers, when it expires, and a "Revoke" button.
- **"Redeem a sitter invite"** — reachable from wherever a new user currently
  lands before joining/creating a household (`HouseholdSetupScreen` or
  equivalent), as a third option alongside "Create a household"/"Join a
  household." Redeeming does **not** touch `memberIds`/`members` or the
  `users/{uid}.householdId` pointer — it only writes the `sitterAccess` doc
  covered above, and routes to `SitterViewScreen` (see below) rather than
  the normal household flow.

### Navigating to a sitter's granted pets

**A real gap, caught in spec self-review, not asked about upfront:**
`HouseholdContext.tsx` resolves the signed-in user's household entirely
through their own `users/{uid}.householdId` pointer, and `RootNavigator`
mounts the normal `MainTabs` experience only once that resolves — a sitter
was never added to `memberIds`, so that pointer stays unset for them and
they'd be stuck on "set up your household" forever with no path to the pets
they were actually granted.

**Scope decision for this sub-project: a sitter is someone without their own
household in this app.** After redeeming a code, if `users/{uid}.householdId`
is still unset, route to a new, separate **`SitterViewScreen`** instead of
the normal household setup flow — a minimal, read-only screen listing the
granted pet(s) (queried directly from that sitter's own `sitterAccess` docs
across whatever households granted them access, not through
`HouseholdContext` at all) and reusing existing pet-detail
components/screens in read-only mode. Someone who is *both* a pet owner in
this app *and* sitting for someone else simultaneously is **explicitly out
of scope** — supporting one real household per signed-in user plus N sitter
grants would mean rebuilding navigation around multi-household membership,
which nothing else in this app does today and which this feature's actual
use case (a neighbor, friend, or professional sitter without their own
household in the app) doesn't need.

## Testing

New `__tests__/firestore.rules.test.ts` cases:

- A valid, non-expired sitter can read a pet they were granted, and every
  subcollection under it.
- An expired sitter (server-time-based, not a client-suppliable value) is
  denied.
- A sitter granted only Pet A is denied Pet B in the same household.
- A revoked sitter is denied even before their `expiresAt`.
- A sitter cannot write anything.
- Redeeming a code can't grant broader `petIds` or a later `expiresAt` than
  the code specifies.
- `events`/`vets` read access correctly follows `hasAny(petIds)`.

New/extended unit tests: `isSubscriptionActive`, the trial-lifecycle effect
(new household vs. pre-existing household vs. already-started), and every
`canAddX`/`canGeneratePassport`/`canShareDocument` with an active-trial
household passed in (always `true`, regardless of the count/cap value).

## Explicitly out of scope (sub-projects B and C)

- Real Google Play Billing, receipt verification, any `paidUntil`/
  `subscriptionStatus: 'paid'` field or write path.
- An "Upgrade" button or any purchase UI — the trial-status card is
  read-only in this sub-project.
- App icon, splash screen, store listing, privacy policy, crash reporting.
- A second/repeatable trial per household — `trialStartedAt` is set once,
  ever, per household; there is no "offer a trial again" mechanism distinct
  from the single auto-start effect above (a literal second trial would be
  an abuse vector with no upside at this stage).
- Deep-linking a sitter invite code (share as plain text only, for now).
- Being both a household member and a sitter for a different household at
  the same time — a sitter is scoped to someone without their own household
  in this app; see "Navigating to a sitter's granted pets" above.

## Global constraints for the implementation plan

- Sitter-access rules and the trial-field auto-start must ship together with
  or before the UI that depends on them — a `canX` check reading
  `household.trialEndsAt` before that field can ever be set would silently
  and permanently deny everyone.
- `canAddCustomField`, `canAddHouseholdMember`, and `canAddDocumentPage` all
  gain a `household` parameter — every existing call site needs updating in
  the same task that changes the signature, not deferred.
- `sitterAccess`'s document ID **must** be the sitter's own uid — this is
  load-bearing for the whole rules-enforcement approach (a query-based
  "does a grant exist for me" check is not provable safe under this
  project's rules language, per the same reasoning that already ruled out a
  query-based `inviteCodes` lookup in Plan 1).
- Follow the `limits.ts` cap pattern exactly for anything new, no deviation.
- `HouseholdContext.tsx`'s new trial-start effect follows its existing
  migration-trigger effect's shape (a `useRef` guard against re-firing
  within one session, fire-and-forget, errors just logged) — don't invent a
  second pattern for "run this once per household."
