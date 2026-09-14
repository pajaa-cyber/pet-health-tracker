import { PetSpecies } from '../types/pet';

export const SPECIES_LIST: PetSpecies[] = [
  'dog', 'cat', 'rabbit', 'bird', 'small_rodent', 'ferret', 'reptile', 'other',
];

export const SPECIES_LABEL: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
  rabbit: 'Rabbit',
  bird: 'Bird',
  small_rodent: 'Small rodent',
  ferret: 'Ferret',
  reptile: 'Reptile',
  other: 'Other',
};

export const SPECIES_EMOJI: Record<PetSpecies, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  bird: '🐦',
  small_rodent: '🐹',
  ferret: '🦡',
  reptile: '🦎',
  other: '🐾',
};

export function speciesDisplay(pet: { species: PetSpecies; speciesOther?: string | null }): string {
  if (pet.species === 'other' && pet.speciesOther) return pet.speciesOther;
  return SPECIES_LABEL[pet.species] ?? 'Other';
}
