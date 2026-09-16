export interface Vet {
  id: string;
  householdId: string;
  clinicName: string;
  doctorName: string; // '' if unknown — "a vet with only a name and nothing else" (execution pack's own device check) must still work
  address: string; // free text, not geocoded — VetsScreen opens it in the phone's Maps app on tap
  phone: string; // free text — VetsScreen dials it on tap
  openingHours: string;
  speciality: string;
  isEmergency24h: boolean;
  notes: string;
  petIds: string[]; // which pets go there — [] is valid (a vet not yet assigned to any pet)
}
