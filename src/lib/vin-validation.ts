import { z } from "zod";

/** Standard US VIN length (1981+). */
export const VIN_LENGTH = 17;

/** Letters I, O, Q are not used in VINs. */
const VIN_CHARSET = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(vin: string): string {
  return vin.trim().toUpperCase();
}

/**
 * Returns a user-facing error message if the VIN is invalid, or null if valid.
 */
export function getVinValidationError(vin: string): string | null {
  const v = normalizeVin(vin);
  if (!v) {
    return "VIN number is required.";
  }
  if (v.length !== VIN_LENGTH) {
    return `VIN must be exactly ${VIN_LENGTH} characters.`;
  }
  if (!VIN_CHARSET.test(v)) {
    return "Invalid VIN format. Use 17 characters; letters I, O, and Q are not allowed.";
  }
  return null;
}

/** Zod field for forms that collect a VIN (same rules as server-side checks). */
export const zVinField = z.string().superRefine((val, ctx) => {
  const msg = getVinValidationError(val);
  if (msg) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
  }
});
