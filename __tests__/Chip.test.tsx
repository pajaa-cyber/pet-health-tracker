import { resolveChipBg, resolveChipColor } from '../src/components/ui/Chip';
import { colors } from '../src/theme/theme';

describe('Chip colour resolution', () => {
  it('uses the default primary/surfaceTint colours when no overrides are given', () => {
    expect(resolveChipBg(true)).toBe(colors.primary);
    expect(resolveChipBg(false)).toBe(colors.surfaceTint);
    expect(resolveChipColor(true)).toBe('#FFFFFF');
    expect(resolveChipColor(false)).toBe(colors.primaryDark);
  });

  it('uses the override colours when given, per selection state', () => {
    expect(resolveChipBg(true, '#111111', '#222222')).toBe('#111111');
    expect(resolveChipBg(false, '#111111', '#222222')).toBe('#222222');
    expect(resolveChipColor(true, '#333333', '#444444')).toBe('#333333');
    expect(resolveChipColor(false, '#333333', '#444444')).toBe('#444444');
  });
});
