import { Pet } from '../types/pet';

// Chosen to read clearly against colors.background (#F8FAFC) and stay
// visually distinct from the brand teal/orange (colors.primary/accent) so a
// pet's identity colour is never mistaken for a UI accent.
export const PET_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#84CC16', // lime
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#78716C', // warm gray
];

export function assignPetColor(existingPets: Pet[]): string {
  return PET_COLORS[existingPets.length % PET_COLORS.length];
}
