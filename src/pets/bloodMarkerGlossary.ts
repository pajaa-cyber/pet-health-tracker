// Layer 4 ("what does this generally represent") — plain-language, generic
// descriptions only. Deliberately never says what a high/low value MEANS
// for a specific animal (that's Layer 5, and even then only as a question
// to bring to a vet, never a conclusion) — this layer just explains what
// the marker itself is, the same regardless of whether this pet's value is
// high, low or normal. Keyed lowercase; lookup normalizes the marker name
// typed into AddBloodTestScreen before matching.
export interface BloodMarkerInfo {
  name: string; // canonical display name/casing
  description: string;
}

export const BLOOD_MARKER_GLOSSARY: Record<string, BloodMarkerInfo> = {
  alt: { name: 'ALT', description: 'An enzyme associated with the liver.' },
  ast: { name: 'AST', description: 'An enzyme found in the liver, muscle and other tissues.' },
  alp: { name: 'ALP', description: 'An enzyme associated with the liver and bone.' },
  ggt: { name: 'GGT', description: 'An enzyme associated with the liver and bile ducts.' },
  bun: { name: 'BUN', description: 'A waste product filtered by the kidneys.' },
  creatinine: { name: 'Creatinine', description: 'A waste product filtered by the kidneys, often looked at alongside BUN.' },
  glucose: { name: 'Glucose', description: 'Blood sugar — the body’s main energy source.' },
  'total protein': { name: 'Total Protein', description: 'The combined amount of albumin and globulin in the blood.' },
  albumin: { name: 'Albumin', description: 'A protein made by the liver that helps carry substances through the blood.' },
  globulin: { name: 'Globulin', description: 'A group of blood proteins involved in immune function.' },
  bilirubin: { name: 'Bilirubin', description: 'A byproduct of red blood cell breakdown, processed by the liver.' },
  cholesterol: { name: 'Cholesterol', description: 'A fat-like substance used to build cells and hormones.' },
  triglycerides: { name: 'Triglycerides', description: 'A type of fat carried in the blood.' },
  calcium: { name: 'Calcium', description: 'A mineral involved in bone, muscle and nerve function.' },
  phosphorus: { name: 'Phosphorus', description: 'A mineral often assessed together with calcium and kidney function.' },
  sodium: { name: 'Sodium', description: 'An electrolyte involved in fluid balance.' },
  potassium: { name: 'Potassium', description: 'An electrolyte involved in muscle and nerve function, including the heart.' },
  chloride: { name: 'Chloride', description: 'An electrolyte usually assessed alongside sodium and potassium.' },
  amylase: { name: 'Amylase', description: 'An enzyme associated with the pancreas.' },
  lipase: { name: 'Lipase', description: 'An enzyme associated with the pancreas, often assessed alongside amylase.' },
  wbc: { name: 'WBC', description: 'White blood cell count — cells involved in fighting infection and immune response.' },
  rbc: { name: 'RBC', description: 'Red blood cell count — cells that carry oxygen through the body.' },
  hemoglobin: { name: 'Hemoglobin', description: 'The oxygen-carrying protein inside red blood cells.' },
  hematocrit: { name: 'Hematocrit', description: 'The proportion of blood made up of red blood cells.' },
  platelets: { name: 'Platelets', description: 'Cell fragments involved in blood clotting.' },
  t4: { name: 'T4', description: 'A thyroid hormone, commonly checked for thyroid function.' },
};

export function lookupBloodMarker(marker: string): BloodMarkerInfo | null {
  return BLOOD_MARKER_GLOSSARY[marker.trim().toLowerCase()] ?? null;
}
