import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { VetVisit } from '../types/vetVisit';

export async function createVetVisit(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  reason: string,
  notes: string,
  followUpDate: number | null
): Promise<VetVisit> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vetVisits'));
  const visit: VetVisit = { id: docRef.id, petId, date, reason, notes, followUpDate };
  await setDoc(docRef, visit);
  return visit;
}

export function subscribeToVetVisits(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (visits: VetVisit[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'vetVisits'),
    (snap) => callback(snap.docs.map((d) => d.data() as VetVisit)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToVetVisits listener error', error);
      callback([]);
    }
  );
}

export async function updateVetVisit(
  db: Firestore,
  householdId: string,
  petId: string,
  visitId: string,
  updates: Partial<VetVisit>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId, 'vetVisits', visitId), updates);
}
