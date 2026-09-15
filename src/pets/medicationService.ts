import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Medication, MedicationSchedule } from '../types/medication';

export async function createMedication(
  db: Firestore,
  householdId: string,
  petId: string,
  name: string,
  dosage: string,
  schedule: MedicationSchedule,
  startDate: number,
  endDate: number | null
): Promise<Medication> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'medications'));
  const medication: Medication = { id: docRef.id, petId, name, dosage, schedule, startDate, endDate, log: [] };
  await setDoc(docRef, medication);
  return medication;
}

export function subscribeToMedications(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (medications: Medication[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'medications'),
    (snap) => callback(snap.docs.map((d) => d.data() as Medication)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToMedications listener error', error);
      callback([]);
    }
  );
}

export async function logMedicationDose(
  db: Firestore,
  householdId: string,
  petId: string,
  medicationId: string,
  givenBy: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'medications', medicationId),
    { log: arrayUnion({ givenBy, givenAt: Date.now() }) }
  );
}

export async function skipMedicationDose(
  db: Firestore,
  householdId: string,
  petId: string,
  medicationId: string,
  skippedBy: string
): Promise<void> {
  await updateDoc(
    doc(db, 'households', householdId, 'pets', petId, 'medications', medicationId),
    { log: arrayUnion({ givenBy: skippedBy, givenAt: Date.now(), skipped: true }) }
  );
}
