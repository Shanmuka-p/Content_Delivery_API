// src/utils/hash.ts
import crypto from "crypto";

/**
 * Generates a strong ETag using SHA-256.
 * Formatted with double quotes as per RFC 7232.
 */
export function generateStrongETag(buffer: Buffer): string {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `"${hash}"`;
}
