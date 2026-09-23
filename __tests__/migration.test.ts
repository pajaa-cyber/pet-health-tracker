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

// query()/where() are only used for the per-visit "does a Document already
// exist for this sourceVisitId" idempotency check. The mock wraps the
// collection ref + constraints in a plain marker object so getDocs' mock
// implementation (below) can tell this query apart from the plain
// pets/{petId}/vetVisits collection read, which is a bare (non-query) ref.
const mockQuery = jest.fn((...args: unknown[]) => {
  const [collectionRef, ...constraints] = args;
  return { __isQuery: true, collectionRef, constraints };
});
const mockWhere = jest.fn((...args: unknown[]) => {
  const [field, op, value] = args;
  return { field, op, value };
});

// Each writeBatch() call gets its OWN fresh set of set()/update()/commit()
// spies, recorded onto `createdBatches` in call order. This is deliberate:
// this migration's core safety property is that pass 1 (creates, via
// set()) and pass 2 (the cleanup, via update()) are NEVER the same batch
// instance — a shared spy object across every batch would let a regression
// that accidentally merged the two passes into one batch pass unnoticed,
// since the assertions below would still just see "set() was called" and
// "update() was called" somewhere, not know which batch. Per-batch spies +
// index into createdBatches close that gap.
type FakeBatch = { set: jest.Mock; update: jest.Mock; commit: jest.Mock };
let createdBatches: FakeBatch[] = [];
const mockWriteBatch = jest.fn((..._args: unknown[]) => {
  const batch: FakeBatch = { set: jest.fn(), update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  createdBatches.push(batch);
  return batch;
});

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
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import { migrateVetVisitDocuments } from '../src/documents/migration';

const fakeDb = {} as Firestore;
const pets = [{ id: 'pet-1' } as any];

// Configures mockGetDocs to answer both calls migration.ts makes per pet:
// the plain vetVisits collection read (a bare ref — not a query() result),
// and the per-visit sourceVisitId idempotency check (a query() result).
// `existingDocsForVisit` lets a test simulate "a Document from this visit
// already exists" (e.g. a prior interrupted run's pass 1 already landed).
function mockGetDocsImplementation(opts: { visits: unknown[]; existingDocsForVisit?: (visitId: string) => boolean }) {
  mockGetDocs.mockImplementation((refOrQuery: any) => {
    if (refOrQuery && refOrQuery.__isQuery) {
      const visitId = refOrQuery.constraints[0]?.value;
      const exists = opts.existingDocsForVisit ? opts.existingDocsForVisit(visitId) : false;
      return Promise.resolve({ empty: !exists, docs: exists ? [{ id: 'existing-doc' }] : [] });
    }
    return Promise.resolve({ docs: opts.visits.map((v) => ({ data: () => v })) });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  createdBatches = [];
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
    mockGetDocsImplementation({
      visits: [
        {
          id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: 'Annual checkup',
          documentUrls: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
        },
      ],
      existingDocsForVisit: () => false,
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    expect(createdBatches).toHaveLength(2);
    const [pass1Batch, cleanupBatch] = createdBatches;

    // Pass-1 batch: one set() for the new Document, one set() per page — all creates, never mixed with update().
    expect(pass1Batch.set).toHaveBeenCalledWith(
      mockCreatedDocumentRef,
      expect.objectContaining({ petId: 'pet-1', sourceVisitId: 'visit-1', pageCount: 2, category: 'Vet visit document' })
    );
    expect(pass1Batch.set).toHaveBeenCalledWith(mockCreatedPageRef, expect.objectContaining({ order: 0, photoUrl: 'data:image/jpeg;base64,AAA' }));
    expect(pass1Batch.update).not.toHaveBeenCalled();
    expect(pass1Batch.commit).toHaveBeenCalled();

    // Cleanup batch: all update() calls, never mixed with a set().
    expect(cleanupBatch.update).toHaveBeenCalledWith(mockVisitDocRef, { documentUrls: [] });
    expect(cleanupBatch.update).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
    expect(cleanupBatch.set).not.toHaveBeenCalled();
    expect(cleanupBatch.commit).toHaveBeenCalled();
  });

  it('skips a vet visit with no documentUrls', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });
    mockGetDocsImplementation({
      visits: [{ id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: '', documentUrls: [] }],
    });

    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    // Only the cleanup batch runs — pass 1 never even starts for this visit.
    expect(createdBatches).toHaveLength(1);
    expect(createdBatches[0].set).not.toHaveBeenCalled();
    // Still marks the household migrated even with nothing to migrate.
    expect(createdBatches[0].update).toHaveBeenCalledWith(mockHouseholdDocRef, { documentsMigratedAt: expect.any(Number) });
  });

  it('does not recreate a Document when re-run before the cleanup batch committed (crash-safety)', async () => {
    const visit = {
      id: 'visit-1', petId: 'pet-1', date: 1700000000000, reason: 'Annual checkup',
      documentUrls: ['data:image/jpeg;base64,AAA'],
    };
    // The household is never marked migrated across either run — simulating
    // a crash between pass 1 committing and the cleanup batch (which sets
    // documentsMigratedAt) committing.
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({}) });

    // First run: no Document exists yet for this visit — pass 1 creates one.
    mockGetDocsImplementation({ visits: [visit], existingDocsForVisit: () => false });
    await migrateVetVisitDocuments(fakeDb, 'h1', pets);
    expect(createdBatches[0].set).toHaveBeenCalledWith(mockCreatedDocumentRef, expect.objectContaining({ sourceVisitId: 'visit-1' }));

    // Second run: same household (still unmigrated), same visit with its
    // documentUrls still populated (the cleanup batch from the first run
    // never committed) — but now a Document for this visit already exists.
    createdBatches = [];
    mockGetDocsImplementation({ visits: [visit], existingDocsForVisit: () => true });
    await migrateVetVisitDocuments(fakeDb, 'h1', pets);

    // No new Document/pages are created on the retry...
    const setCallsOnRetry = createdBatches.flatMap((b) => b.set.mock.calls);
    expect(setCallsOnRetry).toHaveLength(0);
    // ...but the visit is still queued into the cleanup batch, which runs.
    const updateCallsOnRetry = createdBatches.flatMap((b) => b.update.mock.calls);
    expect(updateCallsOnRetry).toContainEqual([mockVisitDocRef, { documentUrls: [] }]);
    expect(
      updateCallsOnRetry.some(([ref, data]) => ref === mockHouseholdDocRef && typeof data.documentsMigratedAt === 'number')
    ).toBe(true);
  });
});
