const mockPrintToFileAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock('expo-print', () => ({ printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args) }));
jest.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

import { buildAndSharePdf } from '../src/documents/pdfService';

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAvailableAsync.mockResolvedValue(true);
  mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/generated.pdf' });
});

describe('buildAndSharePdf', () => {
  it('generates a PDF from HTML and hands it to the share sheet', async () => {
    await buildAndSharePdf('<html><body>Hello</body></html>', 'My Document.pdf');

    expect(mockPrintToFileAsync).toHaveBeenCalledWith({ html: '<html><body>Hello</body></html>' });
    expect(mockShareAsync).toHaveBeenCalledWith('file:///tmp/generated.pdf', expect.objectContaining({ UTI: 'com.adobe.pdf', mimeType: 'application/pdf' }));
  });

  it('throws a friendly error if sharing is unavailable on this device', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    await expect(buildAndSharePdf('<html></html>', 'x.pdf')).rejects.toThrow('Sharing is not available on this device.');
    expect(mockPrintToFileAsync).not.toHaveBeenCalled();
  });
});
