export type WeightUnit = 'kg' | 'lb';

const KG_PER_LB = 0.45359237;

// WeightLog.weight is always stored in kilograms regardless of the
// household's display preference — these convert only at the UI boundary.
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'lb' ? 'lb' : 'kg';
}
