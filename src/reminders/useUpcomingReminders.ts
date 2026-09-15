import { useEffect, useMemo, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToVaccines } from '../pets/vaccineService';
import { subscribeToMedications } from '../pets/medicationService';
import { subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { Vaccine } from '../types/vaccine';
import { Medication } from '../types/medication';
import { VetVisit } from '../types/vetVisit';
import { computeUpcoming, UpcomingReminder } from './computeUpcoming';

// How far ahead the in-app reminders list looks. Separate from a
// notification's lead time (settingsStore.ts) — this just bounds how much
// the list itself shows; overdue items are always included regardless.
const REMINDERS_HORIZON_DAYS = 30;

export function useUpcomingReminders(pets: Pet[]): UpcomingReminder[] {
  const { household } = useHousehold();
  const [vaccinesByPet, setVaccinesByPet] = useState<Record<string, Vaccine[]>>({});
  const [medicationsByPet, setMedicationsByPet] = useState<Record<string, Medication[]>>({});
  const [vetVisitsByPet, setVetVisitsByPet] = useState<Record<string, VetVisit[]>>({});

  const petIdsKey = pets.map((p) => p.id).join(',');

  useEffect(() => {
    if (!household) return;
    const unsubscribes = pets.flatMap((pet) => [
      subscribeToVaccines(firestore, household.id, pet.id, (vs) =>
        setVaccinesByPet((prev) => ({ ...prev, [pet.id]: vs }))
      ),
      subscribeToMedications(firestore, household.id, pet.id, (ms) =>
        setMedicationsByPet((prev) => ({ ...prev, [pet.id]: ms }))
      ),
      subscribeToVetVisits(firestore, household.id, pet.id, (vv) =>
        setVetVisitsByPet((prev) => ({ ...prev, [pet.id]: vv }))
      ),
    ]);
    return () => unsubscribes.forEach((unsub) => unsub());
    // petIdsKey (not `pets` itself) is the dependency on purpose — `pets`
    // is a new array reference on every parent render even when its
    // contents haven't changed, which would tear down and recreate every
    // listener needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, petIdsKey]);

  return useMemo(() => {
    const allVaccines = pets.flatMap((p) => vaccinesByPet[p.id] ?? []);
    const allMedications = pets.flatMap((p) => medicationsByPet[p.id] ?? []);
    const allVetVisits = pets.flatMap((p) => vetVisitsByPet[p.id] ?? []);
    return computeUpcoming(
      { pets, vaccines: allVaccines, medications: allMedications, vetVisits: allVetVisits },
      Date.now(),
      REMINDERS_HORIZON_DAYS
    );
  }, [pets, vaccinesByPet, medicationsByPet, vetVisitsByPet]);
}
