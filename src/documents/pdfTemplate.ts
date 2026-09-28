import { Pet } from '../types/pet';
import { petColor, onPetColorInk } from '../theme/petColors';

// Shared visual shell for every generated PDF (Generate Passport, Prepare
// for Vet) — one template, so a style change lands everywhere at once
// instead of drifting between two copy-pasted <style> blocks. The header
// uses the pet's own identity colour (same one used all over the app),
// which also means each pet's documents are visually distinct from each
// other, not just from a generic default.
export function wrapPdfDocument(pet: Pet, headerSubtitle: string, disclaimer: string | null, bodyHtml: string): string {
  const color = petColor(pet);
  const ink = onPetColorInk(color);
  return `
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; color: #1E1B2E; background: #FFFFFF; }
      .header { background: ${color}; color: ${ink}; padding: 32px; display: flex; align-items: center; gap: 18px; }
      .header img { width: 72px; height: 72px; border-radius: 36px; object-fit: cover; border: 3px solid ${ink}33; }
      .header h1 { margin: 0 0 4px; font-size: 30px; }
      .header p { margin: 0; opacity: 0.85; font-size: 14px; }
      .disclaimer { font-size: 11px; color: #6B7280; padding: 12px 32px 0; margin: 0; }
      .content { padding: 8px 32px 8px; }
      h2 {
        color: #7C3AED; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px;
        border-bottom: 2px solid #F97316; padding-bottom: 6px; margin-top: 26px; margin-bottom: 10px;
      }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 6px 0; border-bottom: 1px solid #E5E7EB; font-size: 14px; vertical-align: top; }
      td:first-child { color: #6B7280; width: 42%; }
      ul, ol { margin: 4px 0; padding-left: 22px; }
      li { margin-bottom: 5px; font-size: 14px; }
      p { font-size: 14px; margin: 4px 0; }
      hr { border: none; border-top: 1px solid #E5E7EB; margin: 8px 0; }
      .footer {
        text-align: center; padding: 18px 32px; font-size: 11px; color: #9CA3AF;
        border-top: 1px solid #E5E7EB; margin-top: 20px;
      }
      .footer .brand { color: #7C3AED; font-weight: 800; }
    </style>
  </head>
  <body>
    <div class="header">
      ${pet.photoUrl ? `<img src="${pet.photoUrl}" />` : ''}
      <div>
        <h1>${pet.name}</h1>
        <p>${headerSubtitle}</p>
      </div>
    </div>
    ${disclaimer ? `<p class="disclaimer">${disclaimer}</p>` : ''}
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">Generated with <span class="brand">SupaPet</span></div>
  </body>
</html>`;
}
