export const colors = {
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: '#A78BFA',
  accent: '#F97316',
  accentDark: '#EA580C',
  accentText: '#1E1B2E',
  success: '#059669',
  danger: '#DC2626',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceTint: '#F5F3FF',
  text: '#1E1B2E',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  borderTint: '#C4B5FD',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: '400' as const, color: colors.textMuted },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
};

export const shadow = {
  shadowColor: '#1E1B2E',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};

// Dark-shell tokens for the colourful reskin (design_handoff_colorful_reskin/README.md).
// Additive only — every screen outside that reskin's scope (Vets, Household,
// auth, EditPetScreen) keeps reading `colors`/`spacing`/`radii`/`typography`
// exactly as before. Never read `colors.background`/`colors.text` etc. on a
// reskinned screen — use these instead.
export const shell = {
  bg: '#141122', // screen background (every reskinned screen except the wizard, which uses its own per-step tint)
  tabBar: '#1B1730',
  sheet: '#221D38', // the raised "+" add sheet
  scrim: 'rgba(13,11,22,0.60)',
  card: 'rgba(255,255,255,0.07)', // neutral card / tile / list row
  // README gives cardBorderDashed and onColour as ranges (0.18-0.22 and
  // 0.20-0.28); these are the fixed midpoint values this plan uses.
  cardBorderDashed: 'rgba(255,255,255,0.20)', // empty-state and "add" dashed borders
  control: 'rgba(255,255,255,0.12)', // icon buttons, unselected view chips, nav buttons
  onColour: 'rgba(255,255,255,0.24)', // chips/stat boxes on top of a pet-colour surface
};

export const text = {
  primary: '#FFFFFF', // titles, values
  secondary: 'rgba(255,255,255,0.55)', // meta, subtitles, counts
  faint: 'rgba(255,255,255,0.45)', // inactive tab labels, month labels
  onColourMuted: 'rgba(255,255,255,0.85)', // meta text on a colour surface
};

export const accentLavender = '#A78BFA'; // eyebrow labels, links
