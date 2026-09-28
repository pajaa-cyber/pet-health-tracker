import { wrapPdfDocument } from '../src/documents/pdfTemplate';
import { Pet } from '../src/types/pet';

const basePet: Pet = {
  id: 'pet-1', householdId: 'h1', name: 'Max', species: 'dog', speciesOther: null,
  breed: 'Golden Retriever', birthDate: null, birthDatePrecision: 'unknown', approximateAgeMonths: null,
  arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#F59E0B',
  sex: 'male', neutered: null, colorMarkings: '', allergies: '', livingEnvironment: null,
  microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
  customFields: [], status: 'active',
};

describe('wrapPdfDocument', () => {
  it('includes the SupaPet footer brand', () => {
    const html = wrapPdfDocument(basePet, 'Dog · Golden Retriever', null, '<p>Body</p>');
    expect(html).toContain('SupaPet');
  });

  it("colours the header with the pet's own identity colour", () => {
    const html = wrapPdfDocument(basePet, 'subtitle', null, '<p>Body</p>');
    expect(html).toContain(basePet.colorKey);
  });

  it('includes the pet name and subtitle', () => {
    const html = wrapPdfDocument(basePet, 'Dog · Golden Retriever', null, '<p>Body</p>');
    expect(html).toContain('Max');
    expect(html).toContain('Dog · Golden Retriever');
  });

  it('includes a disclaimer line only when one is given', () => {
    const withDisclaimer = wrapPdfDocument(basePet, 'sub', 'Not an official document.', '<p>Body</p>');
    expect(withDisclaimer).toContain('Not an official document.');
    const without = wrapPdfDocument(basePet, 'sub', null, '<p>Body</p>');
    expect(without).not.toContain('disclaimer">');
  });

  it('embeds the photo when one is set', () => {
    const withPhoto = wrapPdfDocument({ ...basePet, photoUrl: 'data:image/jpeg;base64,abc' }, 'sub', null, '<p>Body</p>');
    expect(withPhoto).toContain('data:image/jpeg;base64,abc');
  });

  it('passes the body content through unchanged', () => {
    const html = wrapPdfDocument(basePet, 'sub', null, '<h2>Section</h2><p>Detail</p>');
    expect(html).toContain('<h2>Section</h2>');
    expect(html).toContain('<p>Detail</p>');
  });
});
