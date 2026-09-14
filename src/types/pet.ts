export type PetSpecies = 'dog' | 'cat' | 'rabbit' | 'bird' | 'small_rodent' | 'ferret' | 'reptile' | 'other';
export type DatePrecision = 'exact' | 'roughly' | 'approxAge' | 'unknown';
export type ArrivalPrecision = 'exact' | 'roughly' | 'unknown';
export type PetSex = 'male' | 'female' | 'unknown';
export type LivingEnvironment = 'indoor' | 'outdoor' | 'both';
export type PetStatus = 'active' | 'remembered';

export interface CustomField {
  label: string;
  value: string;
}

export interface Pet {
  id: string;
  householdId: string;
  name: string;
  species: PetSpecies;
  speciesOther: string | null; // only meaningful when species === 'other'
  breed: string;
  birthDate: number | null; // epoch millis; null only when birthDatePrecision is 'unknown'
  birthDatePrecision: DatePrecision;
  approximateAgeMonths: number | null; // only meaningful when birthDatePrecision is 'approxAge'
  arrivalDate: number | null; // "when did they join your care" — null if skipped or unknown
  arrivalDatePrecision: ArrivalPrecision | null; // null if the question was skipped entirely
  photoUrl: string | null;
  colorKey: string; // one of PET_COLORS (src/theme/petColors.ts)
  sex: PetSex;
  neutered: boolean | null; // null = unknown
  colorMarkings: string;
  livingEnvironment: LivingEnvironment | null; // null = not answered
  microchipProvider: string;
  microchipNumber: string;
  microchipDate: number | null;
  microchipRegistry: string;
  customFields: CustomField[];
  status: PetStatus;
}
