/**
 * Converts a major-unit amount (e.g. 25.5 dollars) into integer minor units
 * (2550 cents). Rounds to the nearest minor unit to absorb any residual
 * floating point noise from the input before it ever touches the database.
 */
export function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

/**
 * Converts integer minor units (2550 cents) back into a major-unit number
 * (25.5 dollars) for API responses / display purposes.
 */
export function toMajorUnits(amountMinor: number): number {
  return Math.round(amountMinor) / 100;
}

/**
 * Formats integer minor units as a fixed 2-decimal-place string, e.g.
 * 2550 -> "25.50". Useful for consistent API output.
 */
export function formatMinorUnits(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}
