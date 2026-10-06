/**
 * Normalises what people actually type or paste into a 10-digit Indian mobile number:
 * "98765 43210", "98765-43210", "+91 98765 43210", "09876543210" → "9876543210".
 * (A hard maxlength=10 on the input would cut "98765 43210" to 9 digits.)
 */
export function normalizeIndianMobile(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

export const isIndianMobile = (digits: string) => /^[6-9]\d{9}$/.test(digits);
