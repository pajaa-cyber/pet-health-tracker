# Medical records, documents, and the pet passport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** every scanned document (vaccination booklets, lab results, anything
photographed rather than typed in) lives in one place per pet, one Firestore
document per photo (fixing the current 1 MiB-per-vet-visit failure mode), and
a printable one-page pet passport can be generated and shared from the phone
with no server involved.

**Architecture:** a new household-level `documents` collection with a `pages`
subcollection (one photo per page-document — the actual fix), a one-time
migration off the old `VetVisit.documentUrls` array, a new "Documents" tile on
the existing per-pet `PetHomeScreen` hub, and a shared on-device PDF-generation
module (`expo-print` + `expo-sharing`) used by both document-sharing and
passport generation.

**Tech Stack:** React Native (Expo, prebuild/dev-client) + `@react-native-firebase/firestore`
(modular API) + `expo-image-picker`/`expo-image-manipulator` (existing, reused
unchanged) + `expo-print`/`expo-sharing` (new).

**Spec:** [docs/superpowers/specs/2026-09-23-medical-records-documents-passport-design.md](../specs/2026-09-23-medical-records-documents-passport-design.md) —
the plan argues from this spec; read it first for the "why" behind every
decision below. Also inherits `docs/superpowers/specs/2026-09-13-execution-pack.md`
("Phase 6") and this project's own architecture invariants (`CLAUDE.md`).

## Global Constraints

- **Phase 0 (billing) is unresolved.** Photos stay as compressed base64 data
  URIs via the existing `pickAndProcessImage` pipeline — never introduce Cloud
  Storage code.
- **Never use Firestore's `increment()` FieldValue anywhere in this plan.**
  On-device testing during Plan 7 found RNFB's `increment()` fails certain
  rules checks server-side even though the identical call passes under the
  emulator's web SDK. Every denormalized counter in this plan
  (`documentsStorageBytes`, `pageCount`) is written as a literal
  caller-computed number, matching `removeMember`'s existing style in
  `householdService.ts`.
- **A `writeBatch()` that mixes a `set()`/create with an `update()` in the
  same batch can fail on real RNFB hardware** (also found during Plan 7) —
  every batch in this plan is homogeneous (all `set()`, or all `update()`),
  never mixed. Flagging this explicitly since it is easy to reach for a mixed
  batch without thinking about it.
- Reuse `pickAndProcessImage` (`src/pets/imageUpload.ts`) unchanged for all
  photo capture — same 640px-wide resize, 0.5-quality JPEG compression as
  everywhere else in the app.
- Reuse `usePetSelection()` / `<PetSelector>` for `DocumentListScreen`, per
  CLAUDE.md's standing instruction for every new list screen.
- Follow the `src/limits/limits.ts` cap pattern exactly — one `FREE_<X>`
  constant, one `canAdd<X>(...)` predicate, one `<x>LimitMessage()` string —
  no deviation, no new pattern invented.
- Follow the exact Firestore rules pattern every other pet-record /
  household-level collection already uses: `allow read, delete: if
  isHouseholdMember(householdId)`, `allow create: if isHouseholdMember(...) &&
  request.resource.data.keys().hasOnly([...])`, `allow update: if
  isHouseholdMember(householdId)` (no `hasAll`/`diff()` hijack protection —
  that machinery exists only for the household-join boundary).
- `expo-print` and `expo-sharing` are new native dependencies — installing
  them requires `npx expo prebuild --platform android` to regenerate
  `android/`, which is tracked in git and must be committed alongside the
  code that needs it (same handling as the `@react-native-community/datetimepicker`
  addition).
- This codebase has no component-level UI tests anywhere (confirmed: no
  `*Screen.test.tsx` file exists for any of the ~30 existing screens) — UI
  screens in this plan are verified on-device (Task 10), not with unit tests.
  Service/logic-layer code (Firestore services, migration, limits, PDF/HTML
  builders) is unit-tested, matching the codebase's own established split.

---

### Task 1: `Document`/`DocumentPage` types, `documentService.ts`, `limits.ts` cap, Firestore rules

**Files:**
- Create: `src/types/document.ts`
- Create: `src/documents/documentService.ts`
- Modify: `src/limits/limits.ts`
- Modify: `firestore.rules`
- Test: `__tests__/documentService.test.ts`
- Test: `__tests__/limits.test.ts`
- Test: `__tests__/firestore.rules.test.ts`

**Interfaces:**
- Produces: `Document { id, householdId, petId, title, category, date, sourceVisitId, pageCount, createdAt }`, `DocumentPage { id, order, photoUrl }`; `createDocument(db, householdId, petId, title, category, date, pageUrls: string[], sourceVisitId?): Promise<Document>`; `subscribeToDocuments(db, householdId, petId, callback): Unsubscribe`; `subscribeToDocumentPages(db, householdId, documentId, callback): Unsubscribe`; `FREE_DOCUMENT_PHOTOS_PER_PET = 30`, `canAddDocumentPage(pageCountSoFar: number): boolean`, `documentPhotoLimitMessage(): string`.
- Consumes: nothing from earlier tasks — this is the restructure everything else depends on.

- [ ] **Step 1: Write the type file**

```typescript
// src/types/document.ts
export interface Document {
  id: string;
  householdId: string;
  petId: string;
  title: string;
  category: string; // free-ish label: "Vaccination booklet", "Lab result", "Other" — not a rigid enum
  date: number; // epoch millis — when the document is *from*, not when it was scanned
  sourceVisitId: string | null; // set only for documents created by the vet-visit migration (Task 2)
  pageCount: number; // denormalized so DocumentListScreen can show "12 pages" without a subcollection read per card
  createdAt: number;
}

export interface DocumentPage {
  id: string;
  order: number; // 0-based, display/share order
  photoUrl: string; // same data-URI scheme as Pet.photoUrl and the old VetVisit.documentUrls entries
}
```

- [ ] **Step 2: Write the failing tests for `documentService.ts`**

```typescript
// __tests__/documentService.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

// documentService.ts's real code always calls doc(collectionRef) with a
// SINGLE argument for a new auto-ID ref (the same convention
// householdService.ts's createHousehold already uses for docRef =
// doc(collection(db, 'households'))) — there is no path string to switch on
// at the doc() call itself. The two call sites are distinguished instead by
// WHICH collection() call produced the ref they're built from, matched by
// object identity below — collection()'s own arguments DO carry a real path.
const mockDocumentsCollectionRef = { __name: 'documents' };
const mockPagesCollectionRef = { __name: 'pages' };
const mockCreatedDocumentRef = { id: 'doc-1' };
const mockCreatedPageRefs = [{ id: 'page-1' }, { id: 'page-2' }];
let pageRefCallCount = 0;
const mockOnSnapshot = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, commit: mockBatchCommit }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => {
    if (pathSegments[pathSegments.length - 1] === 'pages') return mockPagesCollectionRef;
    return mockDocumentsCollectionRef;
  }),
  doc: jest.fn((collectionRef: unknown) => {
    if (collectionRef === mockPagesCollectionRef) return mockCreatedPageRefs[pageRefCallCount++];
    return mockCreatedDocumentRef;
  }),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { createDocument, subscribeToDocuments, subscribeToDocumentPages } from '../src/documents/documentService';

const fakeDb = {} as Firestore;

beforeEach(() => {
  jest.clearAllMocks();
  pageRefCallCount = 0;
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('documentService', () => {
  it('creates a document and writes one page doc per photo, all in one batch', async () => {
    const result = await createDocument(
      fakeDb, 'h1', 'pet-1', 'Rabies booklet', 'Vaccination booklet', 1700000000000,
      ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']
    );

    expect(result).toEqual({
      id: 'doc-1', householdId: 'h1', petId: 'pet-1', title: 'Rabies booklet',
      category: 'Vaccination booklet', date: 1700000000000, sourceVisitId: null,
      pageCount: 2, createdAt: expect.any(Number),
    });
    expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedDocumentRef, result);
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRefs[0], {
      id: 'page-1', order: 0, photoUrl: 'data:image/jpeg;base64,AAA',
    });
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRefs[1], {
      id: 'page-2', order: 1, photoUrl: 'data:image/jpeg;base64,BBB',
    });
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it('sets sourceVisitId when provided (the migration path)', async () => {
    const result = await createDocument(
      fakeDb, 'h1', 'pet-1', 'Vet visit — 1/1/2024', 'Vet visit document', 1700000000000,
      ['data:image/jpeg;base64,AAA'], 'visit-1'
    );
    expect(result.sourceVisitId).toBe('visit-1');
  });

  it('subscribes to a pet\'s documents', () => {
    const callback = jest.fn();
    subscribeToDocuments(fakeDb, 'h1', 'pet-1', callback);
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('subscribes to a document\'s pages', () => {
    const callback = jest.fn();
    subscribeToDocumentPages(fakeDb, 'h1', 'doc-1', callback);
    expect(mockOnSnapshot).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest __tests__/documentService.test.ts`
Expected: FAIL — `Cannot find module '../src/documents/documentService'`.

- [ ] **Step 4: Write `documentService.ts`**

Path pattern: `households/{householdId}/documents/{documentId}` and
`households/{householdId}/documents/{documentId}/pages/{pageId}` —
household-level (not nested under a specific pet or vet visit), matching the
`vets`/`events` precedent.

```typescript
// src/documents/documentService.ts
import { collection, doc, onSnapshot, writeBatch, type Firestore, type Unsubscribe } from '@react-native-firebase/firestore';
import { Document, DocumentPage } from '../types/document';

// A single homogeneous batch (all set() calls — never mix with update(), see
// this plan's Global Constraints) writes the parent document and every page
// document together, so a document with N pages either fully exists or
// doesn't exist at all — never partially.
export async function createDocument(
  db: Firestore,
  householdId: string,
  petId: string,
  title: string,
  category: string,
  date: number,
  pageUrls: string[],
  sourceVisitId: string | null = null
): Promise<Document> {
  const batch = writeBatch(db);
  const documentRef = doc(collection(db, 'households', householdId, 'documents'));

  const newDocument: Document = {
    id: documentRef.id,
    householdId,
    petId,
    title,
    category,
    date,
    sourceVisitId,
    pageCount: pageUrls.length,
    createdAt: Date.now(),
  };
  batch.set(documentRef, newDocument);

  pageUrls.forEach((photoUrl, order) => {
    const pageRef = doc(collection(db, 'households', householdId, 'documents', documentRef.id, 'pages'));
    batch.set(pageRef, { id: pageRef.id, order, photoUrl });
  });

  await batch.commit();
  return newDocument;
}

export function subscribeToDocuments(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (documents: Document[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'documents'),
    (snap) => {
      const documents = snap.docs
        .map((d) => d.data() as Document)
        .filter((d) => d.petId === petId)
        .sort((a, b) => b.date - a.date);
      callback(documents);
    },
    (error) => {
      console.error('subscribeToDocuments listener error', error);
      callback([]);
    }
  );
}

export function subscribeToDocumentPages(
  db: Firestore,
  householdId: string,
  documentId: string,
  callback: (pages: DocumentPage[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'documents', documentId, 'pages'),
    (snap) => {
      const pages = snap.docs.map((d) => d.data() as DocumentPage).sort((a, b) => a.order - b.order);
      callback(pages);
    },
    (error) => {
      console.error('subscribeToDocumentPages listener error', error);
      callback([]);
    }
  );
}
```

Note: filtering by `petId` client-side (rather than a Firestore `where()`
query) matches this codebase's existing convention for small per-household
collections — see `AddSheet.tsx`'s pets subscription and `vets`' own
`VetsScreen.tsx` filtering, both of which subscribe to the whole household-level
collection and filter in JS.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest __tests__/documentService.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 6: Write the failing test for the `limits.ts` addition**

Append to `__tests__/limits.test.ts` (read the existing file first — it
already tests `canAddCustomField`/`isHouseholdFull` following this exact
shape; add these in the same `describe` structure):

```typescript
import { FREE_DOCUMENT_PHOTOS_PER_PET, canAddDocumentPage, documentPhotoLimitMessage } from '../src/limits/limits';

describe('document photo limit', () => {
  it('allows adding a page while under the free limit', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET - 1)).toBe(true);
  });

  it('denies adding a page once at the free limit', () => {
    expect(canAddDocumentPage(FREE_DOCUMENT_PHOTOS_PER_PET)).toBe(false);
  });

  it('returns a friendly message naming the limit', () => {
    expect(documentPhotoLimitMessage()).toContain(String(FREE_DOCUMENT_PHOTOS_PER_PET));
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx jest __tests__/limits.test.ts`
Expected: FAIL — `canAddDocumentPage` is not exported.

- [ ] **Step 8: Add the cap to `limits.ts`**

Append to `src/limits/limits.ts` (do not restructure the existing exports):

```typescript
export const FREE_DOCUMENT_PHOTOS_PER_PET = 30;

export function canAddDocumentPage(pageCountSoFar: number): boolean {
  return pageCountSoFar < FREE_DOCUMENT_PHOTOS_PER_PET;
}

export function documentPhotoLimitMessage(): string {
  return `The free plan includes ${FREE_DOCUMENT_PHOTOS_PER_PET} document photos per pet. Upgrading unlocks unlimited photos.`;
}
```

`pageCountSoFar` is the pet's TOTAL page count across all its documents (not
one document's page count) — the caller (Task 4's `AddDocumentScreen`) sums
`pageCount` across every `Document` for that pet before calling this.

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx jest __tests__/limits.test.ts`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 10: Write the failing rules tests**

Append to `__tests__/firestore.rules.test.ts` (read the existing `vets` block
added in Plan 7 first — mirror its exact shape):

```typescript
  // documents is household-level (not nested under a pet or vet visit) —
  // matching vets'/events' precedent. pages is its subcollection: one
  // Firestore document per photo, the actual fix for the old
  // VetVisit.documentUrls 1 MiB failure mode.
  const validDocument = {
    id: 'doc-1', householdId: 'h1', petId: 'pet-1', title: 'Rabies booklet',
    category: 'Vaccination booklet', date: 1700000000000, sourceVisitId: null,
    pageCount: 1, createdAt: 1700000000000,
  };
  const validPage = { id: 'page-1', order: 0, photoUrl: 'data:image/jpeg;base64,AAA' };

  it('allows a member to create a document', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(setDoc(doc(memberDb, 'households', 'h1', 'documents', 'doc-1'), validDocument));
  });

  it('denies a non-member from creating a document', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(setDoc(doc(strangerDb, 'households', 'h1', 'documents', 'doc-1'), validDocument));
  });

  it('denies creating a document with a field outside the allowlist', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(memberDb, 'households', 'h1', 'documents', 'doc-1'), { ...validDocument, extra: 'sneaky' })
    );
  });

  it('allows a member to read a document and its pages', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'documents', 'doc-1'), validDocument);
      await setDoc(doc(context.firestore(), 'households', 'h1', 'documents', 'doc-1', 'pages', 'page-1'), validPage);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1', 'documents', 'doc-1')));
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1', 'documents', 'doc-1', 'pages', 'page-1')));
  });

  it('denies a non-member from reading a document or its pages', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'documents', 'doc-1'), validDocument);
      await setDoc(doc(context.firestore(), 'households', 'h1', 'documents', 'doc-1', 'pages', 'page-1'), validPage);
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'documents', 'doc-1')));
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'documents', 'doc-1', 'pages', 'page-1')));
  });

  it('allows a member to create a page under a document', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'documents', 'doc-1'), validDocument);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(setDoc(doc(memberDb, 'households', 'h1', 'documents', 'doc-1', 'pages', 'page-1'), validPage));
  });
```

- [ ] **Step 11: Run the rules tests to verify they fail**

Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`
Expected: FAIL — no `documents`/`pages` match block exists yet, every
`assertSucceeds` above fails with permission-denied.

- [ ] **Step 12: Add the rules blocks**

Add to `firestore.rules`, directly after the existing `vets` match block
(same file region, same style):

```
    // Household-level (not per-pet, not tied to a specific vet visit) —
    // matching vets'/events' precedent. pages is documents' subcollection:
    // one Firestore document per photo is the actual fix for the old
    // VetVisit.documentUrls array's 1 MiB-per-document failure mode.
    match /households/{householdId}/documents/{documentId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly([
          'id', 'householdId', 'petId', 'title', 'category', 'date',
          'sourceVisitId', 'pageCount', 'createdAt'
        ]);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }

    match /households/{householdId}/documents/{documentId}/pages/{pageId} {
      allow read: if isHouseholdMember(householdId);
      allow create: if isHouseholdMember(householdId) &&
        request.resource.data.keys().hasOnly(['id', 'order', 'photoUrl']);
      allow update: if isHouseholdMember(householdId);
      allow delete: if isHouseholdMember(householdId);
    }
```

- [ ] **Step 13: Run the rules tests to verify they pass**

Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`
Expected: PASS, all tests including the 6 new ones.

- [ ] **Step 14: Commit**

```bash
git add src/types/document.ts src/documents/documentService.ts src/limits/limits.ts firestore.rules __tests__/documentService.test.ts __tests__/limits.test.ts __tests__/firestore.rules.test.ts
git commit -m "feat: add Document/DocumentPage types, documentService, and the document-photo free-tier cap"
```

---

### Task 2: Migration off `VetVisit.documentUrls`

**Files:**
- Create: `src/documents/migration.ts`
- Modify: `src/household/HouseholdContext.tsx`
- Test: `__tests__/migration.test.ts`

**Interfaces:**
- Consumes: `createDocument` is NOT reused here directly (migration needs full
  control over the batch to also clear the old field in a guaranteed-separate
  second pass) — `Document`/`DocumentPage` types from Task 1, `VetVisit` from
  `src/types/vetVisit.ts`, `Pet` from `src/types/pet.ts`.
- Produces: `migrateVetVisitDocuments(db, householdId, pets: Pet[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/migration.test.ts
import type { Firestore } from '@react-native-firebase/firestore';

// migration.ts mixes TWO different doc() calling conventions from the real
// RNFB API: explicit-path calls like doc(db, 'households', householdId)
// (path segments ARE available to switch on), and single-argument auto-ID
// calls like doc(collection(db, ..., 'documents')) (no path segments at the
// doc() call itself — the collection() call that produced the ref is what
// carries the real path, so those two are matched by referential identity
// against collection()'s own mocked return values instead).
const mockDocumentsCollectionRef = { __name: 'documents' };
const mockPagesCollectionRef = { __name: 'pages' };
const mockCreatedDocumentRef = { id: 'new-doc-1' };
const mockCreatedPageRef = { id: 'new-page-1' };
const mockHouseholdDocRef = { id: 'household-ref' };
const mockVisitDocRef = { id: 'visit-ref' };
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({ set: mockBatchSet, update: mockBatchUpdate, commit: mockBatchCommit }));

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => {
    if (pathSegments[pathSegments.length - 1] === 'pages') return mockPagesCollectionRef;
    if (pathSegments[pathSegments.length - 1] === 'documents') return mockDocumentsCollectionRef;
    return {}; // the pets/{petId}/vetVisits collection read via getDocs — its identity doesn't matter, getDocs is mocked directly below
  }),
  doc: jest.fn((refOrCollectionRef: unknown, ...pathSegments: string[]) => {
    if (refOrCollectionRef === mockPagesCollectionRef) return mockCreatedPageRef;
    if (refOrCollectionRef === mockDocumentsCollectionRef) return mockCreatedDocumentRef;
    if (pathSegments.includes('vetVisits')) return mockVisitDocRef;
    if (pathSegments[0] === 'households') return mockHouseholdDocRef;
    return {};
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { migrateVetVisitDocuments } from '../src/documents/migration';

const fakeDb = {} as Firestore;
const pets = [{ id: 'pet-1' } as any];

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
});

describe('migrateVetVisitDocuments', () => {
  it('does nothing if the household is already marked migrated', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ documentsMigratedAt: 123 }) });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });

  it('migrates a vet visit with documentUrls into a new Document + pages, then clears the old field', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) }); // not yet migrated
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          data: () => ({
            id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: 'Annual checkup',
            documentUrls: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
          }),
        },
      ],
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    // Per-visit batch: one set() for the new Document, one set() per page — all creates, never mixed with update().
    expect(mockBatchSet).toHaveBeenCalledWith(
      mockCreatedDocumentRef,
      expect.objectContaining({ petId: 'pet-1', sourceVisitId: 'visit-1', pageCount: 2, category: 'Vet visit document' })
    );
    expect(mockBatchSet).toHaveBeenCalledWith(mockCreatedPageRef, expect.objectContaining({ order: 0, photoUrl: 'data:image/jpeg;base64,AAA' }));

    // Cleanup batch: all update() calls, never mixed with a set().
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockVisitDocRef, { documentUrls: [] });
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('skips a vet visit with no documentUrls', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    mockGetDocs.mockResolvedValue({
      docs: [{ data: () => ({ id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: '', documentUrls: [] }) }],
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    expect(mockBatchSet).not.toHaveBeenCalled();
    // Still marks the household migrated even with nothing to migrate.
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/migration.test.ts`
Expected: FAIL — `Cannot find module '../src/documents/migration'`.

- [ ] **Step 3: Write `migration.ts`**

```typescript
// src/documents/migration.ts
import { collection, doc, getDoc, getDocs, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import { Pet } from '../types/pet';
import { VetVisit } from '../types/vetVisit';
import { Document } from '../types/document';

// Runs once per household. Two passes, never interleaved:
//   1. For every VetVisit with documentUrls, write a new Document + its pages
//      in one all-set() batch (never mixed with an update()).
//   2. Only after every pass-1 batch has committed, a second all-update()
//      batch clears documentUrls on each migrated visit and marks the
//      household migrated.
// This ordering is what makes a crash mid-migration safe: the OLD data is
// still fully intact (documentUrls untouched) until pass 2, which only runs
// after every new Document has already landed — so re-running next launch
// either finds nothing left to do, or safely retries pass 1 for whatever
// wasn't migrated yet (a visit whose documentUrls is already [] is skipped).
export async function migrateVetVisitDocuments(db: Firestore, householdId: string, pets: Pet[]): Promise<void> {
  const householdSnap = await getDoc(doc(db, 'households', householdId));
  if (!householdSnap.exists()) return;
  if ((householdSnap.data() as { documentsMigratedAt?: number }).documentsMigratedAt) return;

  const migratedVisits: { petId: string; visitId: string }[] = [];

  for (const pet of pets) {
    const visitsSnap = await getDocs(collection(db, 'households', householdId, 'pets', pet.id, 'vetVisits'));
    for (const visitDoc of visitsSnap.docs) {
      const visit = visitDoc.data() as VetVisit;
      if (!visit.documentUrls || visit.documentUrls.length === 0) continue;

      const batch = writeBatch(db);
      const documentRef = doc(collection(db, 'households', householdId, 'documents'));
      const dateLabel = new Date(visit.date).toLocaleDateString();
      const newDocument: Document = {
        id: documentRef.id,
        householdId,
        petId: pet.id,
        title: visit.reason ? `${visit.reason} — ${dateLabel}` : `Vet visit — ${dateLabel}`,
        category: 'Vet visit document',
        date: visit.date,
        sourceVisitId: visit.id,
        pageCount: visit.documentUrls.length,
        createdAt: Date.now(),
      };
      batch.set(documentRef, newDocument);
      visit.documentUrls.forEach((photoUrl, order) => {
        const pageRef = doc(collection(db, 'households', householdId, 'documents', documentRef.id, 'pages'));
        batch.set(pageRef, { id: pageRef.id, order, photoUrl });
      });
      await batch.commit();

      migratedVisits.push({ petId: pet.id, visitId: visit.id });
    }
  }

  const cleanupBatch = writeBatch(db);
  for (const { petId, visitId } of migratedVisits) {
    cleanupBatch.update(doc(db, 'households', householdId, 'pets', petId, 'vetVisits', visitId), { documentUrls: [] });
  }
  cleanupBatch.update(doc(db, 'households', householdId), { documentsMigratedAt: Date.now() });
  await cleanupBatch.commit();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest __tests__/migration.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Wire migration to run once per household load**

Read `src/household/HouseholdContext.tsx` in full first. Add a new `useEffect`
that fires once `household` and its pets are available — reuse the existing
pets subscription already in this file if one exists; if not, add a
lightweight one-time `getDocs` read of the pets collection specifically for
this migration call (do not add a live `onSnapshot` pets subscription to this
context just for migration — that would duplicate the fan-out this project's
`NEXTSTEPS.md` already logs as a known gap). Call
`migrateVetVisitDocuments(firestore, household.id, pets)` fire-and-forget
(`.catch(console.error)`, not awaited in a way that blocks rendering) once per
`household.id` change — a `useRef` guard prevents re-running for the same
household id within one app session (the function's own `documentsMigratedAt`
check is what prevents re-running across sessions).

- [ ] **Step 6: Commit**

```bash
git add src/documents/migration.ts src/household/HouseholdContext.tsx __tests__/migration.test.ts
git commit -m "feat: migrate VetVisit.documentUrls into the new documents/pages collections"
```

---

### Task 3: `DocumentListScreen` + `PetHomeScreen` Documents tile

**Files:**
- Create: `src/navigation/DocumentListScreen.tsx`
- Modify: `src/navigation/PetHomeScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `subscribeToDocuments` (Task 1), `Document` type (Task 1),
  `RecordListHeader`/`DashedAddButton`/`GuidedEmptyState` (existing, from
  Colourful Reskin Part B), `petColor` (existing).
- Produces: route `DocumentList` (params: `{ petId }`), navigable via
  `navigation.navigate('DocumentList', { petId })`.

- [ ] **Step 1: Write `DocumentListScreen.tsx`**

Mirrors `VaccineListScreen.tsx`'s exact structure (read it first) — the same
reskinned pattern every other record-list screen already uses:

```typescript
// src/navigation/DocumentListScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Image, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocuments, subscribeToDocumentPages } from '../documents/documentService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Document } from '../types/document';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function DocumentListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToDocuments(firestore, household.id, petId, setDocuments);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Documents"
        subtitle={`${pet?.name ?? 'Pet'} · ${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <Pressable
              onPress={() => navigation.navigate('DocumentViewer', { documentId: item.id })}
              style={{ flex: 1, flexDirection: 'row' }}
            >
              <View style={{ width: 6, backgroundColor: rail }} />
              <DocumentThumbnail householdId={household!.id} documentId={item.id} />
              <View style={{ flex: 1, padding: 14, gap: 2, justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.title}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.category}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {new Date(item.date).toLocaleDateString()} · {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('ShareDocument', { documentId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.title}`}
              style={{ padding: 14, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18 }}>↗️</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="📄"
            title="No documents yet"
            message="Photograph a vaccination booklet, lab result, or anything else worth keeping — several pages at once, grouped as one document."
            actionLabel="Add a document"
            onAction={() => navigation.navigate('AddDocument', { petId })}
            variant="dark"
          />
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a document" onPress={() => navigation.navigate('AddDocument', { petId })} />
      </View>
    </ScreenContainer>
  );
}

// A small inline component so each card can independently subscribe to just
// its first page (order 0) for a thumbnail, without DocumentListScreen
// itself fanning out N page-subcollection listeners for N documents up
// front — only the documents actually rendered get a listener, and each is
// torn down when its card unmounts.
function DocumentThumbnail({ householdId, documentId }: { householdId: string; documentId: string }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToDocumentPages(firestore, householdId, documentId, (pages) => {
      setThumbnailUrl(pages[0]?.photoUrl ?? null);
    });
  }, [householdId, documentId]);

  if (!thumbnailUrl) return <View style={{ width: 64, backgroundColor: shell.control }} />;
  return <Image source={{ uri: thumbnailUrl }} style={{ width: 64, height: '100%' }} resizeMode="cover" />;
}
```

- [ ] **Step 2: Register the route in `MainNavigator.tsx`**

Read the existing `VaccineList`/`AddVaccine` registrations first, mirror the
exact pattern:

```typescript
import { DocumentListScreen } from './DocumentListScreen';
// ...
<Stack.Screen name="DocumentList" component={DocumentListScreen} options={{ headerShown: false }} />
```

(`AddDocument` and `DocumentViewer`/`ShareDocument` are registered in Tasks 4
and 5/7 respectively — do not add placeholder screens for them here.)

- [ ] **Step 3: Add the Documents tile to `PetHomeScreen`**

Read `PetHomeScreen.tsx` in full first (already done during plan-writing —
mirror its exact `SECTIONS`/`HubData` pattern). Three changes:

1. Add `import { subscribeToDocuments } from '../documents/documentService';`
   and `import { Document } from '../types/document';`.
2. Extend `HubData` with `documents: Document[]`, add a `documents` state
   variable and its subscription (`subscribeToDocuments(firestore,
   household.id, petId, setDocuments)`) alongside the other five in the
   existing `useEffect`, and include it in the `hubData` object.
3. Add a new entry to the `SECTIONS` array:

```typescript
{ key: 'DocumentList', label: 'Documents', emoji: '📄', color: '#06B6D4', count: (d) => recordsLabel(d.documents.length) },
```

(`#06B6D4`, cyan — distinct from every colour already used across `SECTIONS`
and `AddSheet.tsx`'s `ADD_ACTIONS`.)

- [ ] **Step 4: Commit**

```bash
git add src/navigation/DocumentListScreen.tsx src/navigation/PetHomeScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: add DocumentListScreen and a Documents tile on the pet hub"
```

---

### Task 4: `AddDocumentScreen` — capture multiple pages, save as one document

**Files:**
- Create: `src/navigation/AddDocumentScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`
- Modify: `src/navigation/AddSheet.tsx`

**Interfaces:**
- Consumes: `pickAndProcessImage` (existing, `src/pets/imageUpload.ts`),
  `createDocument` (Task 1), `subscribeToDocuments` (Task 1, to sum the pet's
  existing page count for the cap check), `canAddDocumentPage` /
  `documentPhotoLimitMessage` (Task 1).
- Produces: route `AddDocument` (params: `{ petId }`).

- [ ] **Step 1: Write `AddDocumentScreen.tsx`**

Mirrors `AddVetScreen.tsx`'s structure (own in-body form, `colors`/`spacing`
tokens, NOT `shell`/`text` — "Add" screens across this codebase are outside
the Colourful Reskin's scope, confirmed by `AddVaccineScreen.tsx` having no
theme import at all and using the plain `ScreenContainer`/native header):

```typescript
// src/navigation/AddDocumentScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { pickAndProcessImage } from '../pets/imageUpload';
import { createDocument, subscribeToDocuments } from '../documents/documentService';
import { canAddDocumentPage, documentPhotoLimitMessage } from '../limits/limits';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { Document } from '../types/document';
import { ScreenContainer, TextField, Button, ErrorText, MutedText } from '../components/ui';
import { spacing, radii } from '../theme/theme';

export function AddDocumentScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(Date.now());
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToDocuments(firestore, household.id, petId, setExistingDocuments);
  }, [household, petId]);

  const petPageCountSoFar = existingDocuments.reduce((sum, d) => sum + d.pageCount, 0);

  const handleCapture = async (source: 'camera' | 'library') => {
    if (!canAddDocumentPage(petPageCountSoFar + pageUrls.length)) {
      setError(documentPhotoLimitMessage());
      return;
    }
    setError(null);
    setCapturing(true);
    try {
      const uri = await pickAndProcessImage(source);
      if (uri) setPageUrls((prev) => [...prev, uri]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCapturing(false);
    }
  };

  const removePage = (index: number) => {
    setPageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!household) return;
    if (pageUrls.length === 0) {
      setError('Add at least one page before saving.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createDocument(firestore, household.id, petId, title.trim() || 'Untitled document', category.trim() || 'Other', date, pageUrls);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Take a photo" onPress={() => handleCapture('camera')} loading={capturing} style={{ flex: 1 }} />
        <Button title="Choose from library" onPress={() => handleCapture('library')} loading={capturing} variant="outline" style={{ flex: 1 }} />
      </View>

      {pageUrls.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {pageUrls.map((uri, index) => (
            <View key={index} style={{ width: 72, height: 72 }}>
              <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: radii.md }} resizeMode="cover" />
              <Pressable
                onPress={() => removePage(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove page ${index + 1}`}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center' }}
              >
                <MutedText style={{ color: '#FFFFFF', fontSize: 12 }}>×</MutedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <TextField label="Title" placeholder="e.g. Rabies vaccination booklet" value={title} onChangeText={setTitle} />
      <TextField label="Category" placeholder="e.g. Vaccination booklet, Lab result" value={category} onChangeText={setCategory} />
      <DateField label="Document date" value={date} onChange={setDate} />

      {error && <ErrorText>{error}</ErrorText>}
      <Button title={`Save document (${pageUrls.length} ${pageUrls.length === 1 ? 'page' : 'pages'})`} onPress={handleSave} loading={saving} disabled={pageUrls.length === 0} />
    </ScreenContainer>
  );
}
```

`Button`'s existing `Variant` type is `'primary' | 'accent' | 'outline' |
'danger'` (`src/components/ui/Button.tsx`) — `'outline'` is used here for the
de-emphasized second action, matching how this component is already used
elsewhere in the codebase.

- [ ] **Step 2: Register the route in `MainNavigator.tsx`**

```typescript
import { AddDocumentScreen } from './AddDocumentScreen';
// ...
<Stack.Screen name="AddDocument" component={AddDocumentScreen} options={{ title: 'Add Document' }} />
```

(Native header, `headerShown: true` default — matches `AddVaccine`'s
registration exactly, not `VaccineList`'s `headerShown: false`.)

- [ ] **Step 3: Add "Add a Document" to the global "+" sheet**

Read `src/navigation/AddSheet.tsx`'s current `ADD_ACTIONS` array (already
extended once this session for Plan 7's "Add a Vet" entry — mirror that
exact shape). Add one entry, `needsPet: true` (a document belongs to one
pet, same as vaccines/medications — NOT `topLevel: true` like vets, which
aren't pet-scoped from the selector):

```typescript
{ label: 'Add a Document', emoji: '📄', color: '#06B6D4', route: 'AddDocument', needsPet: true },
```

- [ ] **Step 4: Commit**

```bash
git add src/navigation/AddDocumentScreen.tsx src/navigation/MainNavigator.tsx src/navigation/AddSheet.tsx
git commit -m "feat: add AddDocumentScreen (multi-page capture) and wire it into the + sheet"
```

---

### Task 5: `DocumentViewerScreen` — full-screen swipeable pager

**Files:**
- Create: `src/navigation/DocumentViewerScreen.tsx`
- Modify: `src/navigation/MainNavigator.tsx`

**Interfaces:**
- Consumes: `subscribeToDocumentPages` (Task 1).
- Produces: route `DocumentViewer` (params: `{ documentId }`).

- [ ] **Step 1: Write `DocumentViewerScreen.tsx`**

```typescript
// src/navigation/DocumentViewerScreen.tsx
import React, { useEffect, useState } from 'react';
import { FlatList, View, Image, Dimensions, Pressable, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocumentPages } from '../documents/documentService';
import { firestore } from '../firebase/config';
import { DocumentPage } from '../types/document';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DocumentViewerScreen({ route, navigation }: any) {
  const { documentId } = route.params;
  const { household } = useHousehold();
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!household) return;
    return subscribeToDocumentPages(firestore, household.id, documentId, setPages);
  }, [household, documentId]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 1, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16 }}>×</Text>
      </Pressable>
      <FlatList
        data={pages}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: item.photoUrl }} style={{ width: SCREEN_WIDTH, height: '80%' }} resizeMode="contain" />
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: Register the route and wire `DocumentListScreen`'s card tap**

In `MainNavigator.tsx`:

```typescript
import { DocumentViewerScreen } from './DocumentViewerScreen';
// ...
<Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} options={{ headerShown: false }} />
```

`DocumentListScreen.tsx` (Task 3) already calls
`navigation.navigate('DocumentViewer', { documentId: item.id })` on card tap
— no further change needed there.

- [ ] **Step 3: Commit**

```bash
git add src/navigation/DocumentViewerScreen.tsx src/navigation/MainNavigator.tsx
git commit -m "feat: add DocumentViewerScreen, a full-screen swipeable page pager"
```

---

### Task 6: Install `expo-print`/`expo-sharing`, shared PDF module

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Create: `src/documents/pdfService.ts`
- Test: `__tests__/pdfService.test.ts`
- Modify: `android/` (regenerated, tracked in git)

**Interfaces:**
- Produces: `buildAndSharePdf(html: string, fileName: string): Promise<void>`
  — the one shared "make something shareable" mechanism Task 7 uses for both
  document-sharing and the passport.

- [ ] **Step 1: Install the dependencies**

```bash
npx expo install expo-print expo-sharing
```

Expected: `package.json` gains both at versions compatible with this
project's Expo SDK 57 (`expo-print ~57.x`, `expo-sharing ~57.x` — `expo
install` resolves the exact compatible version automatically, do not pin a
different version by hand).

- [ ] **Step 2: Regenerate and commit `android/`**

```bash
npx expo prebuild --platform android
```

Per this project's own documented gotcha (`CLAUDE.md`, "Local build
environment"): this deletes and regenerates the whole `android/` directory,
including `android/local.properties` — recreate it (`sdk.dir=C\:\\Android\\Sdk`)
before the next build, and re-copy `google-services.json` into
`android/app/` if this worktree is fresh. `android/` is tracked in git and
must be committed as part of this task, same handling as the
`@react-native-community/datetimepicker` addition.

- [ ] **Step 3: Write the failing test for `pdfService.ts`**

```typescript
// __tests__/pdfService.test.ts
const mockPrintToFileAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args) }));
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

import { buildAndSharePdf } from '../src/documents/pdfService';

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/generated.pdf' });
});

describe('buildAndSharePdf', () => {
  it('generates a PDF from HTML and hands it to the share sheet', async () => {
    await buildAndSharePdf('<html><body>Hello</body></html>', 'My Document.pdf');

    expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: '<html><body>Hello</body></html>' });
    expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/generated.pdf', expect.objectContaining({ UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }));
  });

  it('throws a friendly error if sharing is unavailable on this device', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    await expect(buildAndSharePdf('<html></html>', 'x.pdf')).rejects.toThrow('Sharing is not available on this device.');
    expect(mockPrintToFileAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx jest __tests__/pdfService.test.ts`
Expected: FAIL — `Cannot find module '../src/documents/pdfService'`.

- [ ] **Step 5: Write `pdfService.ts`**

```typescript
// src/documents/pdfService.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// The one shared "make something shareable" mechanism for this whole
// feature: both a single Document's Share button (Task 7) and passport
// generation (Task 7) build an HTML string for their own content and pass
// it here. Entirely on-device — no server involved.
export async function buildAndSharePdf(html: string, fileName: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: fileName });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest __tests__/pdfService.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json android/ src/documents/pdfService.ts __tests__/pdfService.test.ts
git commit -m "feat: add expo-print/expo-sharing and a shared HTML-to-PDF-to-share helper"
```

---

### Task 7: Passport generation + document sharing

**Files:**
- Create: `src/documents/passportService.ts`
- Modify: `src/navigation/PetHomeScreen.tsx`
- Modify: `src/navigation/DocumentListScreen.tsx` (verify the share icon added in Task 3 is wired)
- Create: `src/navigation/ShareDocumentScreen.tsx` (thin — see Step 4)
- Modify: `src/navigation/MainNavigator.tsx`
- Test: `__tests__/passportService.test.ts`

**Interfaces:**
- Consumes: `buildAndSharePdf` (Task 6), `Pet` (existing, full 23-field
  type), `Vet` (existing, Plan 7), `Vaccine` (existing), `subscribeToVets`
  (existing, Plan 7), `subscribeToVaccines` (existing).
- Produces: `buildPassportHtml(pet: Pet, vaccines: Vaccine[], vets: Vet[]): string`;
  `generatePassport(pet, vaccines, vets): Promise<void>` (calls
  `buildAndSharePdf` with the built HTML).

- [ ] **Step 1: Write the failing test for the passport HTML builder**

```typescript
// __tests__/passportService.test.ts
import { buildPassportHtml } from '../src/documents/passportService';
import { Pet } from '../src/types/pet';
import { Vaccine } from '../src/types/vaccine';
import { Vet } from '../src/types/vet';

const basePet: Pet = {
  id: 'pet-1', householdId: 'h1', name: 'Macmac', species: 'cat', speciesOther: null,
  breed: 'Tabby', birthDate: null, birthDatePrecision: 'unknown', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#F59E0B',
  sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

describe('buildPassportHtml', () => {
  it('produces a document for a pet with almost no data, without crashing on nulls', () => {
    const html = buildPassportHtml(basePet, [], []);
    expect(html).toContain('Macmac');
    expect(html).toContain('<html');
  });

  it('includes microchip details when present', () => {
    const pet: Pet = { ...basePet, microchipNumber: '985141000123456', microchipProvider: 'PetLink' };
    const html = buildPassportHtml(pet, [], []);
    expect(html).toContain('985141000123456');
    expect(html).toContain('PetLink');
  });

  it('includes vet contacts assigned to this pet', () => {
    const vet: Vet = {
      id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
      address: '12 River Rd', phone: '5550100', openingHours: '', speciality: '', isEmergency24h: false,
      notes: '', petIds: ['pet-1'],
    };
    const html = buildPassportHtml(basePet, [], [vet]);
    expect(html).toContain('Riverside Vet Clinic');
    expect(html).toContain('5550100');
  });

  it('summarizes a long vaccination history to the most recent entries, not every row', () => {
    const manyVaccines: Vaccine[] = Array.from({ length: 40 }, (_, i) => ({
      id: `v${i}`, petId: 'pet-1', name: `Vaccine ${i}`, dateGiven: 1700000000000 + i, nextDueDate: null, vetName: '',
    }));
    const html = buildPassportHtml(basePet, manyVaccines, []);
    const occurrences = (html.match(/Vaccine \d+/g) ?? []).length;
    expect(occurrences).toBeLessThan(40);
    expect(occurrences).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/passportService.test.ts`
Expected: FAIL — `Cannot find module '../src/documents/passportService'`.

- [ ] **Step 3: Write `passportService.ts`**

```typescript
// src/documents/passportService.ts
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Vet } from '../types/vet';
import { speciesDisplay } from '../pets/species';
import { buildAndSharePdf } from './pdfService';

const MOST_RECENT_VACCINES_SHOWN = 8; // keeps a heavy vaccination history to one page — a curated summary, not a full log dump

export function buildPassportHtml(pet: Pet, vaccines: Vaccine[], vets: Vet[]): string {
  const petVets = vets.filter((v) => v.petIds.includes(pet.id));
  const recentVaccines = [...vaccines].sort((a, b) => b.dateGiven - a.dateGiven).slice(0, MOST_RECENT_VACCINES_SHOWN);

  const microchipRows = [
    pet.microchipNumber && `<tr><td>Microchip number</td><td>${pet.microchipNumber}</td></tr>`,
    pet.microchipProvider && `<tr><td>Provider</td><td>${pet.microchipProvider}</td></tr>`,
    pet.microchipRegistry && `<tr><td>Registry</td><td>${pet.microchipRegistry}</td></tr>`,
  ].filter(Boolean).join('');

  const vaccineRows = recentVaccines.length > 0
    ? recentVaccines.map((v) => `<tr><td>${v.name}</td><td>${new Date(v.dateGiven).toLocaleDateString()}</td></tr>`).join('')
    : '<tr><td colspan="2">No vaccinations recorded yet.</td></tr>';

  const vetRows = petVets.length > 0
    ? petVets.map((v) => `<tr><td>${v.clinicName}${v.doctorName ? ` (${v.doctorName})` : ''}</td><td>${v.phone || '—'}</td></tr>`).join('')
    : '<tr><td colspan="2">No vet assigned yet.</td></tr>';

  return `
<html>
  <head><meta charset="utf-8" /></head>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1E1B2E;">
    <h1 style="margin-bottom: 4px;">${pet.name}</h1>
    <p style="color: #555; margin-top: 0;">${speciesDisplay(pet)}${pet.breed ? ` · ${pet.breed}` : ''}</p>
    ${microchipRows ? `<h2>Microchip</h2><table style="width:100%; border-collapse: collapse;">${microchipRows}</table>` : ''}
    <h2>Recent vaccinations</h2>
    <table style="width:100%; border-collapse: collapse;">${vaccineRows}</table>
    <h2>Vet contacts</h2>
    <table style="width:100%; border-collapse: collapse;">${vetRows}</table>
  </body>
</html>`;
}

export async function generatePassport(pet: Pet, vaccines: Vaccine[], vets: Vet[]): Promise<void> {
  const html = buildPassportHtml(pet, vaccines, vets);
  await buildAndSharePdf(html, `${pet.name} — Pet Passport.pdf`);
}
```

`speciesDisplay` already exists (`src/pets/species.ts`, confirmed used
elsewhere in `PetHomeScreen.tsx`) — reused as-is, not reimplemented.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/passportService.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Add "Generate Passport" to `PetHomeScreen`**

`PetHomeScreen` already subscribes to `vaccines` and has `pet`; add a
subscription to `vets` (`subscribeToVets` from `src/vets/vetService.ts`,
Plan 7) the same way the other five record types are subscribed, then add a
full-width button directly below the `SECTIONS` grid (before the "Weight
trend" card):

```typescript
<Button
  title="Generate Passport"
  onPress={() => generatePassport(pet, vaccines, vetsForHousehold).catch((e) => setPassportError(e.message))}
  loading={generatingPassport}
/>
{passportError && <ErrorText>{passportError}</ErrorText>}
```

(`generatingPassport`/`setGeneratingPassport` and `passportError`/
`setPassportError` are new local `useState`s wrapping the call, following
the exact `try/setLoading(true)/.../finally setLoading(false)` shape every
other submit handler in this codebase already uses — see `AddVetScreen`'s
`handleSubmit` for the precedent.) Import `generatePassport` from
`src/documents/passportService.ts` and `Button`/`ErrorText` from
`../components/ui` if not already imported.

- [ ] **Step 6: Wire the Share icon on `DocumentListScreen`'s cards**

Task 3 already routes the share icon's tap to
`navigation.navigate('ShareDocument', { documentId: item.id })`. Write a thin
screen that does the work and immediately goes back — there is no persistent
"share screen" UI, this is a navigation-driven side effect:

```typescript
// src/navigation/ShareDocumentScreen.tsx
import { useEffect } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocumentPages } from '../documents/documentService';
import { firestore } from '../firebase/config';
import { buildAndSharePdf } from '../documents/pdfService';

// No UI of its own — subscribes just long enough to get this one document's
// pages, builds a quick multi-page PDF from them, hands it to the share
// sheet, then goes back. Reuses the exact same buildAndSharePdf helper the
// passport uses (this plan's spec: "one make-something-shareable mechanism
// for the whole feature, not two").
export function ShareDocumentScreen({ route, navigation }: any) {
  const { documentId } = route.params;
  const { household } = useHousehold();

  useEffect(() => {
    if (!household) return;
    const unsubscribe = subscribeToDocumentPages(firestore, household.id, documentId, async (pages) => {
      unsubscribe();
      if (pages.length === 0) { navigation.goBack(); return; }
      const html = `<html><body>${pages.map((p) => `<img src="${p.photoUrl}" style="width:100%;page-break-after:always;" />`).join('')}</body></html>`;
      try {
        await buildAndSharePdf(html, 'Document.pdf');
      } finally {
        navigation.goBack();
      }
    });
  }, [household, documentId]);

  return null;
}
```

Register in `MainNavigator.tsx`:

```typescript
import { ShareDocumentScreen } from './ShareDocumentScreen';
// ...
<Stack.Screen name="ShareDocument" component={ShareDocumentScreen} options={{ headerShown: false, presentation: 'transparentModal' }} />
```

- [ ] **Step 7: Commit**

```bash
git add src/documents/passportService.ts src/navigation/PetHomeScreen.tsx src/navigation/ShareDocumentScreen.tsx src/navigation/MainNavigator.tsx __tests__/passportService.test.ts
git commit -m "feat: generate and share a one-page pet passport PDF; wire document sharing"
```

---

### Task 8: Storage-size accounting and warning

**Files:**
- Modify: `src/documents/documentService.ts`
- Modify: `src/navigation/AddDocumentScreen.tsx`
- Modify: `src/navigation/DocumentListScreen.tsx`
- Test: `__tests__/documentService.test.ts` (extend)

**Interfaces:**
- Consumes: `createDocument` (Task 1, modified in place).
- Produces: `reconcileDocumentsStorageBytes(db, householdId): Promise<void>`;
  `createDocument`'s signature gains one parameter,
  `currentStorageBytes: number` (the caller — `AddDocumentScreen`, Task 4 —
  already has this from `useHousehold()`'s live `household` object).

- [ ] **Step 1: Write the failing test for the byte-tracking addition**

Append to `__tests__/documentService.test.ts`:

```typescript
  it('createDocument writes a literal new documentsStorageBytes total, never increment()', async () => {
    const photoUrl = 'data:image/jpeg;base64,AAAA'; // full data URI, 27 chars
    await createDocument(
      fakeDb, 'h1', 'pet-1', 'Title', 'Category', 1700000000000,
      [photoUrl], null, 1000 // currentStorageBytes
    );
    // 1000 (existing) + Math.ceil(27 * 0.75) = 1000 + 21 = 1021 — the estimate
    // is over the FULL data-URI string length (prefix included), not just the
    // base64 payload portion, matching the real implementation exactly. A
    // literal number, never { __increment: N }.
    expect(mockBatchUpdate).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsStorageBytes: 1021 });
  });
```

(This requires extending the mock `jest.mock` block's `doc`/`writeBatch`
setup to also return a `mockHouseholdDocRef` for the `households/{id}` path
and to expose `mockBatchUpdate` on the batch object, matching the pattern
already used in `__tests__/migration.test.ts`.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/documentService.test.ts`
Expected: FAIL — `createDocument` doesn't accept a 9th parameter yet, and no
`documentsStorageBytes` write happens.

- [ ] **Step 3: Extend `createDocument` and add `reconcileDocumentsStorageBytes`**

Modify `documentService.ts`:

```typescript
export async function createDocument(
  db: Firestore,
  householdId: string,
  petId: string,
  title: string,
  category: string,
  date: number,
  pageUrls: string[],
  sourceVisitId: string | null = null,
  currentStorageBytes: number = 0
): Promise<Document> {
  const batch = writeBatch(db);
  const documentRef = doc(collection(db, 'households', householdId, 'documents'));

  const newDocument: Document = {
    id: documentRef.id, householdId, petId, title, category, date, sourceVisitId,
    pageCount: pageUrls.length, createdAt: Date.now(),
  };
  batch.set(documentRef, newDocument);

  let newBytes = 0;
  pageUrls.forEach((photoUrl, order) => {
    const pageRef = doc(collection(db, 'households', householdId, 'documents', documentRef.id, 'pages'));
    batch.set(pageRef, { id: pageRef.id, order, photoUrl });
    // Rough decoded-byte estimate from the base64 string length (base64 has
    // ~33% overhead) — precise enough for a soft warning threshold, and a
    // literal computed number rather than increment(), per this plan's
    // Global Constraints.
    newBytes += Math.ceil(photoUrl.length * 0.75);
  });

  await batch.commit();

  // A SEPARATE, single-update() batch — never mixed into the all-set()
  // batch above, per this plan's Global Constraints.
  const householdBatch = writeBatch(db);
  householdBatch.update(doc(db, 'households', householdId), { documentsStorageBytes: currentStorageBytes + newBytes });
  await householdBatch.commit();

  return newDocument;
}

// Self-healing correction, same pattern as Plan 7's reconcileMemberCount —
// called whenever DocumentListScreen loads, so a missed/failed increment
// during createDocument can't drift the stored total permanently.
export async function reconcileDocumentsStorageBytes(db: Firestore, householdId: string): Promise<void> {
  const documentsSnap = await getDocs(collection(db, 'households', householdId, 'documents'));
  let totalBytes = 0;
  for (const documentDoc of documentsSnap.docs) {
    const pagesSnap = await getDocs(collection(db, 'households', householdId, 'documents', documentDoc.id, 'pages'));
    pagesSnap.docs.forEach((pageDoc) => {
      const page = pageDoc.data() as DocumentPage;
      totalBytes += Math.ceil(page.photoUrl.length * 0.75);
    });
  }
  await updateDoc(doc(db, 'households', householdId), { documentsStorageBytes: totalBytes });
}
```

Add `getDocs` and `updateDoc` to the file's existing
`@react-native-firebase/firestore` import line.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/documentService.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Update `AddDocumentScreen`'s call site to pass the real current total**

Task 4's `AddDocumentScreen.handleSave` calls `createDocument(...)` with only
7 arguments, relying on `currentStorageBytes`'s new default of `0` — which
would silently make every save **reset** the household's
`documentsStorageBytes` mirror to just that one document's bytes, discarding
everything counted before it. Fix the call site in
`src/navigation/AddDocumentScreen.tsx`:

```typescript
await createDocument(
  firestore, household.id, petId, title.trim() || 'Untitled document',
  category.trim() || 'Other', date, pageUrls, null, household.documentsStorageBytes ?? 0
);
```

`household` (from `useHousehold()`, already destructured in this screen)
carries `documentsStorageBytes` once Step 5 below's reconcile call has run at
least once — `?? 0` covers a brand-new household that has never had a
document yet.

- [ ] **Step 6: Wire the reconcile call and warning banner into `DocumentListScreen`**

Add a `useEffect` that calls `reconcileDocumentsStorageBytes(firestore,
household.id)` once on mount (fire-and-forget, `.catch(console.error)` — same
pattern as Plan 7's `HouseholdScreen`). Add a warning banner (plain `Text` in
a `shell.card`-styled `View`, matching this screen's existing visual
language) shown when `household.documentsStorageBytes` exceeds a conservative
threshold — propose **200 MB** (well under the Spark plan's 1 GiB total, to
leave headroom for the rest of the project's Firestore usage): `"Your
documents are using a lot of storage — consider removing ones you no longer
need."` Read `household.documentsStorageBytes` via `useHousehold()`, already
available in this screen.

- [ ] **Step 7: Commit**

```bash
git add src/documents/documentService.ts src/navigation/AddDocumentScreen.tsx src/navigation/DocumentListScreen.tsx __tests__/documentService.test.ts
git commit -m "feat: track documentsStorageBytes and warn as it approaches the Spark plan's real quota"
```

---

### Task 9: Cleanup — remove the old field and screen

**Files:**
- Modify: `src/types/vetVisit.ts`
- Delete: `src/navigation/VetVisitDocumentsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx` or `MainNavigator.tsx` (wherever `VetVisitDocumentsScreen` is currently registered — find it first)
- Modify: `src/pets/vetVisitService.ts`
- Modify: `firestore.rules`
- Modify: any screen that currently navigates to the old screen (find via grep for `VetVisitDocumentsScreen`/`addVetVisitDocument`)

**Interfaces:**
- Consumes: nothing new — this task only removes now-dead code, after Task 2's
  migration has been confirmed working on a real device (Task 10) with the
  owner's actual existing test data.

- [ ] **Step 1: Confirm migration has run on-device**

Do not start this task until Task 10's on-device checklist has confirmed the
migration correctly moved existing vet-visit photos (the "check that photos
taken before this phase still open" checklist item) — this task deletes the
only path back to the old data shape.

- [ ] **Step 2: Remove `documentUrls` from the `VetVisit` type**

In `src/types/vetVisit.ts`, delete the `documentUrls: string[];` line.

- [ ] **Step 3: Remove `addVetVisitDocument` from `vetVisitService.ts`**

Delete the function (and its now-unused `arrayUnion` import if nothing else
in the file uses it — check first).

- [ ] **Step 4: Delete `VetVisitDocumentsScreen.tsx` and its registration**

Find the route registration via `grep -rn "VetVisitDocumentsScreen"
src/navigation/` (this plan's earlier research found it referenced from
`VetVisitListScreen.tsx`'s per-visit row, navigating with `{ petId, visitId }`
params) — remove that navigation call (a vet visit row no longer links to a
documents screen; if the visit has a `sourceVisitId`-tagged `Document` from
migration, that's reachable via the pet's Documents section, not from the
visit row anymore) and the `Stack.Screen` registration, then delete the file.

- [ ] **Step 5: Update `firestore.rules`' `vetVisits` allowlist**

In the `match /households/{householdId}/pets/{petId}/vetVisits/{visitId}`
block, remove `'documentUrls'` from the `create`-time `hasOnly([...])` list
(new vet visits are never created with document photos anymore — Documents
is now a fully separate flow).

- [ ] **Step 6: Update tests referencing the old field**

Run `npx jest` and `firebase emulators:exec --only firestore,storage "npx
jest __tests__/firestore.rules.test.ts"` — fix any test that still
constructs a `VetVisit`/vet-visit rules fixture including `documentUrls`
(search `__tests__/` for `documentUrls` first).

- [ ] **Step 7: Run the full suite**

Run: `npx tsc --noEmit` — expect zero errors (confirms no other file still
references the removed field/screen/function).
Run: `npx jest`
Run: `firebase emulators:exec --only firestore,storage "npx jest __tests__/firestore.rules.test.ts"`
Expected: all clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: remove VetVisit.documentUrls and VetVisitDocumentsScreen, superseded by Documents"
```

---

### Task 10: Deploy rules, whole-plan verification, and the on-device checklist

**Files:** none new — this task is verification and a manual deploy, not code.

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

Build from `C:\dev\pet-app` (or this plan's own worktree —
`npx expo run:android`). Per `CLAUDE.md`'s "Local build environment," recreate
`android/local.properties` and copy `google-services.json` into
`android/app/` if this is a fresh worktree/checkout.

Restructure and migration:
- On a household with existing vet-visit photos (the owner's real test data —
  "Ana's test photos" per the execution pack), confirm they now appear under
  the correct pet's new Documents section, titled from the original visit's
  reason and date, with all original pages present and in the original order.
- Confirm the migration only runs once — force-close and relaunch the app,
  confirm no duplicate `Document`s appear.

Documents:
- Photograph twelve pages of a real booklet in one go via "Add a Document" —
  this is the exact case that used to break at ten to twenty photos with the
  old array-in-one-doc shape. Then do twelve more on a second document.
- Confirm a page can be removed from the capture strip before saving, and
  that the saved document has the correct remaining page count.
- Reach "Add a Document" from the global "+" sheet while on a tab other than
  the pet whose Documents you're adding to — confirm it still reaches
  `AddDocumentScreen` with the right pet pre-selected when one is selected.
- Tap a document card — confirm the full-screen pager opens and swipes
  correctly through every page in order.
- Tap the share icon on a document — confirm the OS share sheet opens with a
  real, viewable multi-page PDF (open it from Files/WhatsApp/email after
  sharing to confirm the PDF itself isn't corrupt).
- Fill a pet's documents to the 30-photo free-tier cap, then attempt one
  more — confirm a friendly limit message, not a raw Firestore error, and
  confirm no 31st page is actually added.

Passport:
- Generate a passport for a pet with almost no data (no microchip, no
  vaccines, no assigned vet) — confirm it still produces a clean one-page
  document, not a crash or a page full of blank table rows.
- Generate a passport for a pet with a lot of data (many vaccines, a full
  microchip record, an assigned vet) — confirm it's still one page and looks
  like a curated document, not a printout of a database.
- **Actually print one** (or save-to-PDF via the share sheet and open it) —
  confirm the layout is genuinely readable and print-appropriate, not just
  "renders in the emulator."

- [ ] **Step 4: Update `NEXTSTEPS.md`/`CLAUDE.md`**

Once the checklist passes, follow this project's now-established pattern
(see the Plan 7 merge for the exact shape): add a
`docs/history/YYYY-MM-DD-plan-8-medical-records-documents-passport.md` file
recording the build and on-device verification, add its entry to
`docs/history/plan-log.md`, add a compact architecture-reference paragraph to
`CLAUDE.md`'s "Architecture invariants" section (the `documents`/`pages`
collection shape, the `documentsStorageBytes`/`documentsMigratedAt` fields,
the shared `pdfService.ts` mechanism, the "never `increment()`" and "never
mix `set()`/`update()` in one batch" lessons if not already generalized into
CLAUDE.md from Plan 7), and update `NEXTSTEPS.md`'s resume state and open
gaps (move Plan 9 into "next").
