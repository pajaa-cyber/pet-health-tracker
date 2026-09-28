import { parseAllergyTerms, findAllergenMatches } from '../src/pets/foodScan';

describe('parseAllergyTerms', () => {
  it('splits on commas, semicolons and newlines', () => {
    expect(parseAllergyTerms('Chicken, Beef; Corn\nWheat')).toEqual(['Chicken', 'Beef', 'Corn', 'Wheat']);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(parseAllergyTerms('Chicken,  , Beef ,')).toEqual(['Chicken', 'Beef']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseAllergyTerms('')).toEqual([]);
  });
});

describe('findAllergenMatches', () => {
  it('finds a case-insensitive match', () => {
    expect(findAllergenMatches('Ingredients: CHICKEN meal, rice', 'Chicken')).toEqual(['Chicken']);
  });

  it('matches as a substring, e.g. inside "may contain X"', () => {
    expect(findAllergenMatches('May contain traces of chicken and soy', 'Chicken')).toEqual(['Chicken']);
  });

  it('returns every matching allergy term, not just the first', () => {
    expect(findAllergenMatches('Beef and chicken by-product meal', 'Chicken, Beef, Lamb')).toEqual(['Chicken', 'Beef']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(findAllergenMatches('Duck, sweet potato, peas', 'Chicken, Beef')).toEqual([]);
  });

  it('returns an empty array when the pet has no known allergies', () => {
    expect(findAllergenMatches('Chicken meal, rice', '')).toEqual([]);
  });
});
