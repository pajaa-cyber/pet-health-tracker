export interface MedicationSchedule {
  timesPerDay: number;
  intervalDays: number; // 1 = daily, 2 = every other day, etc.
}

export interface MedicationDoseLog {
  givenBy: string; // userId
  givenAt: number; // epoch millis
  skipped?: boolean; // true if this entry records a skipped dose, not a given one
}

export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  schedule: MedicationSchedule;
  startDate: number; // epoch millis
  endDate: number | null;
  log: MedicationDoseLog[];
}
