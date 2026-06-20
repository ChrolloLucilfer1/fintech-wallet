/**
 * Generates a client-side idempotency key for a single logical transfer
 * attempt. Uses the browser's native crypto API when available (secure,
 * RFC-4122-compliant UUIDv4), falling back to a Math.random-based
 * generator for older environments. This key is sent as the
 * `Idempotency-Key` header and must stay IDENTICAL across retries of the
 * same logical operation, but be freshly generated for each NEW transfer
 * the user initiates.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback UUIDv4-like generator (not cryptographically secure, but
  // sufficient as a uniqueness key for environments lacking crypto.randomUUID).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
