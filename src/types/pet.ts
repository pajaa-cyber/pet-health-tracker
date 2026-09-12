export type PetSpecies = 'dog' | 'cat' | 'other';

export interface Pet {
  id: string;
  householdId: string;
  name: string;
  species: PetSpecies;
  breed: string;
  birthDate: number; // epoch millis
  photoUrl: string | null;
}
