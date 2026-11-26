/**
 * Masks personal data before text leaves the system (sent to the AI model) or is stored in the chat audit log.
 * Deliberately conservative: it is better to hide a harmless number than to leak a real one.
 */
const RULES: Array<[RegExp, string]> = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[card number]"],                               // payment card
  [/\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, "[PAN]"],                                   // Indian PAN
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[ID number]"],                        // Aadhaar-style 12 digits
  [/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)\d{3,5}[\s-]?\d{3,5}\b/g, (m: string) => (m.replace(/\D/g, "").length >= 8 ? "[phone]" : m)] as any,
];

export function maskPii(text: string): string {
  let out = text ?? "";
  for (const [re, rep] of RULES) out = out.replace(re, rep as any);
  return out;
}
