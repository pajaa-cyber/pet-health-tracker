import { PET_COLORS, assignPetColor } from '../src/theme/petColors';
import { Pet } from '../src/types/pet';

const fakePet = (colorKey: string): Pet => ({
  id: 'x', householdId: 'h1', name: 'x', species: 'dog', breed: '', birthDate: 0,
  photoUrl: null, colorKey,
});

describe('assignPetColor', () => {
  it('assigns the first palette colour to the first pet', () => {
    expect(assignPetColor([])).toBe(PET_COLORS[0]);
  });

  it('assigns the next palette colour for each additional pet', () => {
    expect(assignPetColor([fakePet(PET_COLORS[0])])).toBe(PET_COLORS[1]);
    expect(assignPetColor([fakePet(PET_COLORS[0]), fakePet(PET_COLORS[1])])).toBe(PET_COLORS[2]);
  });

  it('wraps around after the palette is exhausted', () => {
    const eightPets = PET_COLORS.map(fakePet);
    expect(assignPetColor(eightPets)).toBe(PET_COLORS[0]);
  });
});
