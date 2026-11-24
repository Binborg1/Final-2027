/**
 * Join codes: six characters with no look-alikes (no 0/O or 1/I), so a code read
 * off a projector is typed correctly. Matches the database check
 * `^[A-HJ-NP-Z2-9]{6}$`. Restored from the earlier classes feature.
 */

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** randomInt(max) returns 0 ≤ n < max; the server passes node:crypto's randomInt. */
export function makeCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** " k7q-2px " → "K7Q2PX". */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);
}
