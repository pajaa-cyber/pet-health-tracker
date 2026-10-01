import { parseBloodTestText } from '../src/pets/bloodTestOcr';

describe('parseBloodTestText', () => {
  it('parses a marker, value, unit and dash-joined range on one line', () => {
    expect(parseBloodTestText('ALT 45 U/L 7-56')).toEqual([
      { marker: 'ALT', value: '45', unit: 'U/L', referenceLow: '7', referenceHigh: '56' },
    ]);
  });

  it('parses a multi-word marker name', () => {
    expect(parseBloodTestText('Total Protein 6.8 g/dL 6.0-8.3')).toEqual([
      { marker: 'Total Protein', value: '6.8', unit: 'g/dL', referenceLow: '6.0', referenceHigh: '8.3' },
    ]);
  });

  it('parses a range with spaces around the dash as three tokens', () => {
    expect(parseBloodTestText('WBC 7.5 x10^9/L 4.0 - 11.0')).toEqual([
      { marker: 'WBC', value: '7.5', unit: 'x10^9/L', referenceLow: '4.0', referenceHigh: '11.0' },
    ]);
  });

  it('parses a parenthesized range', () => {
    expect(parseBloodTestText('Creatinine 1.1 mg/dL (0.7-1.3)')).toEqual([
      { marker: 'Creatinine', value: '1.1', unit: 'mg/dL', referenceLow: '0.7', referenceHigh: '1.3' },
    ]);
  });

  it('handles a marker name ending in a colon', () => {
    expect(parseBloodTestText('Glucose: 95 mg/dL')).toEqual([
      { marker: 'Glucose', value: '95', unit: 'mg/dL', referenceLow: '', referenceHigh: '' },
    ]);
  });

  it('leaves reference range blank when the line has no range', () => {
    expect(parseBloodTestText('Glucose 95 mg/dL')).toEqual([
      { marker: 'Glucose', value: '95', unit: 'mg/dL', referenceLow: '', referenceHigh: '' },
    ]);
  });

  it('parses multiple lines, skipping ones that do not look like a marker row', () => {
    const text = ['Lab Report', 'ALT 45 U/L 7-56', 'Patient: Macmac', 'Glucose 95 mg/dL 70-100'].join('\n');
    expect(parseBloodTestText(text)).toEqual([
      { marker: 'ALT', value: '45', unit: 'U/L', referenceLow: '7', referenceHigh: '56' },
      { marker: 'Glucose', value: '95', unit: 'mg/dL', referenceLow: '70', referenceHigh: '100' },
    ]);
  });

  it('returns an empty array for text with no parseable lines', () => {
    expect(parseBloodTestText('Just some notes\nwith no numbers here')).toEqual([]);
  });

  it('returns an empty array for empty text', () => {
    expect(parseBloodTestText('')).toEqual([]);
  });
});
