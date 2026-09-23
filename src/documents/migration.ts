import { collection, doc, getDoc, getDocs, query, where, writeBatch, type Firestore } from '@react-native-firebase/firestore';
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
//
// A crash *between* pass 1 committing for some visits and the single
// cleanup batch committing at the end would otherwise leave those visits'
// documentUrls still populated, so re-running would recreate a second
// Document for them. The per-visit `sourceVisitId` existence check below is
// what makes that retry idempotent instead of duplicating data: a visit
// whose Document already exists is queued straight for cleanup, no new
// Document/pages are written for it.
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

      const existingSnap = await getDocs(
        query(collection(db, 'households', householdId, 'documents'), where('sourceVisitId', '==', visit.id))
      );
      if (!existingSnap.empty) {
        // Already migrated in a prior interrupted run — don't recreate, but still
        // queue it for documentUrls cleanup in case that part didn't finish either.
        migratedVisits.push({ petId: pet.id, visitId: visit.id });
        continue;
      }

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
