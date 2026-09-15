import { Pet } from '../types/pet';

// Chosen to read clearly against colors.background (#F8FAFC) and stay
// visually distinct from the brand purple/orange (colors.primary/accent) so a
// pet's identity colour is never mistaken for a UI accent.
export const PET_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#84CC16', // lime
  '#10B981', // emerald
  '#3B82F6', // blue
  '#14B8A6', // teal
  '#EC4899', // pink
  '#78716C', // warm gray
];

export function assignPetColor(existingPets: Pet[]): string {
  return PET_COLORS[existingPets.length % PET_COLORS.length];
}

// Pets created before colorKey existed deserialize with colorKey === undefined;
// fall back to the first palette color rather than letting RN silently drop
// the color prop (which renders as black).
export function petColor(pet: { colorKey?: string }): string {
  return pet.colorKey ?? PET_COLORS[0];
}
