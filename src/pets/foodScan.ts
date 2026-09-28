// Splits the pet's freeform Allergies field (e.g. "Chicken, Beef") into
// individual terms to check against scanned label text.
export function parseAllergyTerms(allergies: string): string[] {
  return allergies
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Plain case-insensitive substring match, not NLP — "chicken meal" and
// "may contain chicken" both match on "chicken". Deliberate false-positive
// bias: a missed allergen reaching the report is worse than a false alarm
// the owner double-checks themselves against the actual label.
export function findAllergenMatches(labelText: string, allergies: string): string[] {
  const terms = parseAllergyTerms(allergies);
  const lowerText = labelText.toLowerCase();
  return terms.filter((term) => lowerText.includes(term.toLowerCase()));
}
