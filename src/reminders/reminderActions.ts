import type { Firestore } from '@react-native-firebase/firestore';
import { UpcomingReminder } from './computeUpcoming';
import { updateVaccine } from '../pets/vaccineService';
import { logMedicationDose, skipMedicationDose } from '../pets/medicationService';
import { updateVetVisit } from '../pets/vetVisitService';
import { snoozeReminder } from './snoozeStore';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function markDone(db: Firestore, householdId: string, reminder: UpcomingReminder, userId: string): Promise<void> {
  switch (reminder.type) {
    case 'vaccine':
      await updateVaccine(db, householdId, reminder.petId, reminder.sourceId, { nextDueDate: null });
      return;
    case 'medication':
      await logMedicationDose(db, householdId, reminder.petId, reminder.sourceId, userId);
      return;
    case 'vetVisitFollowUp':
      await updateVetVisit(db, householdId, reminder.petId, reminder.sourceId, { followUpDate: null });
      return;
  }
}

export async function skip(db: Firestore, householdId: string, reminder: UpcomingReminder, userId: string): Promise<void> {
  switch (reminder.type) {
    case 'vaccine':
      await updateVaccine(db, householdId, reminder.petId, reminder.sourceId, { nextDueDate: null });
      return;
    case 'medication':
      await skipMedicationDose(db, householdId, reminder.petId, reminder.sourceId, userId);
      return;
    case 'vetVisitFollowUp':
      await updateVetVisit(db, householdId, reminder.petId, reminder.sourceId, { followUpDate: null });
      return;
  }
}

export async function snooze(reminder: UpcomingReminder, days: number): Promise<void> {
  await snoozeReminder(reminder.id, Date.now() + days * DAY_MS);
}
