// One row from a blood panel — marker name matched case-insensitively
// against bloodMarkerGlossary.ts for its plain-language explanation.
// referenceLow/High are nullable: a marker whose reference range wasn't
// entered can't be judged high/low/normal, only recorded (status
// 'unknown' in bloodTestAnalysis.ts — "not interpreted", never guessed at).
export interface BloodMarkerResult {
  marker: string;
  value: number;
  unit: string;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface BloodTest {
  id: string;
  petId: string;
  testDate: number; // epoch millis
  laboratory: string;
  results: BloodMarkerResult[];
}
