/**
 * Core Liquidity Engine - Integrity Hash Calculation
 *
 * This module provides deterministic SHA-256 hashing for version integrity.
 * The hash ensures that plan data has not been modified since snapshot creation.
 *
 * CRITICAL: Hash calculation must be deterministic - same inputs always produce same hash.
 *
 * @module core/hash
 * @version 1.0.0
 */

import { type HashableValue } from './types';

// ============================================================================
// WEB CRYPTO HASH IMPLEMENTATION
// ============================================================================

/**
 * Calculates SHA-256 hash using the Web Crypto API.
 *
 * This function works in both Node.js (v15+) and browser environments.
 *
 * @param data - String data to hash
 * @returns Promise resolving to hex-encoded SHA-256 hash
 */
async function sha256Async(data: string): Promise<string> {
  // Use Web Crypto API (available in Node.js 15+ and all modern browsers)
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous SHA-256 hash using Node.js crypto module.
 * Falls back to this when available for better performance in Node.js context.
 */
function sha256Sync(data: string): string {
  // Dynamic import to avoid bundling issues in browser
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Determines if we're in a Node.js environment with crypto module available
 */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.versions != null &&
    process.versions.node != null
  );
}

// ============================================================================
// CANONICAL STRING GENERATION
// ============================================================================

/**
 * Generates a canonical string representation for hashing.
 *
 * The canonical form ensures deterministic ordering:
 * 1. Opening balance is always first
 * 2. Values are sorted by (lineId, weekOffset, valueType)
 * 3. Each value is formatted as "lineId:weekOffset:valueType:amountCents"
 * 4. All parts are joined with "|" delimiter
 *
 * @param openingBalanceCents - Opening balance in cents
 * @param values - Array of hashable values
 * @returns Canonical string representation
 */
function generateCanonicalString(
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): string {
  // Sort values for deterministic ordering
  const sortedValues = [...values].sort((a, b) => {
    // Primary sort by lineId (lexicographic)
    if (a.lineId !== b.lineId) {
      return a.lineId.localeCompare(b.lineId);
    }
    // Secondary sort by weekOffset (numeric)
    if (a.weekOffset !== b.weekOffset) {
      return a.weekOffset - b.weekOffset;
    }
    // Tertiary sort by valueType (lexicographic)
    return a.valueType.localeCompare(b.valueType);
  });

  // Build canonical string
  const parts: string[] = [`opening:${openingBalanceCents.toString()}`];

  for (const v of sortedValues) {
    parts.push(`${v.lineId}:${v.weekOffset}:${v.valueType}:${v.amountCents.toString()}`);
  }

  return parts.join('|');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Calculates the data integrity hash for a liquidity plan version.
 *
 * This hash is stored with each LiquidityPlanVersion and can be recalculated
 * to verify that the underlying data has not been modified.
 *
 * The hash is calculated from:
 * - Opening balance
 * - All weekly values (sorted deterministically)
 *
 * @param openingBalanceCents - Opening balance in cents
 * @param values - All weekly values to include in the hash
 * @returns SHA-256 hash as 64-character hex string
 *
 * @example
 * ```typescript
 * const hash = calculateDataHash(5000000n, [
 *   { lineId: 'line-1', weekOffset: 0, valueType: 'PLAN', amountCents: 100000n },
 *   { lineId: 'line-1', weekOffset: 1, valueType: 'PLAN', amountCents: 150000n },
 * ]);
 * // Returns: "a1b2c3d4..." (64 hex characters)
 * ```
 */
export function calculateDataHash(
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): string {
  const canonicalString = generateCanonicalString(openingBalanceCents, values);

  // Use synchronous Node.js crypto if available, otherwise use a simple
  // synchronous implementation for the calculation engine
  if (isNodeEnvironment()) {
    return sha256Sync(canonicalString);
  }

  // Fallback for browser/edge runtime: use a simple hash implementation
  // Note: In production, the async version should be used in browser contexts
  return simpleHash(canonicalString);
}

/**
 * Async version of calculateDataHash for browser environments.
 *
 * @param openingBalanceCents - Opening balance in cents
 * @param values - All weekly values to include in the hash
 * @returns Promise resolving to SHA-256 hash as 64-character hex string
 */
export async function calculateDataHashAsync(
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): Promise<string> {
  const canonicalString = generateCanonicalString(openingBalanceCents, values);
  return sha256Async(canonicalString);
}

/**
 * Verifies that a data hash matches the expected value.
 *
 * @param expectedHash - The stored hash to verify against
 * @param openingBalanceCents - Opening balance in cents
 * @param values - All weekly values
 * @returns True if hashes match, false otherwise
 */
export function verifyDataHash(
  expectedHash: string,
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): boolean {
  const calculatedHash = calculateDataHash(openingBalanceCents, values);
  return calculatedHash === expectedHash;
}

/**
 * Async version of verifyDataHash for browser environments.
 */
export async function verifyDataHashAsync(
  expectedHash: string,
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): Promise<boolean> {
  const calculatedHash = await calculateDataHashAsync(openingBalanceCents, values);
  return calculatedHash === expectedHash;
}

// ============================================================================
// SIMPLE HASH FALLBACK
// ============================================================================

/**
 * Simple deterministic hash for fallback in non-Node environments.
 *
 * This is NOT cryptographically secure but provides deterministic output
 * for the calculation engine when crypto is not available synchronously.
 *
 * In production, the async Web Crypto version should be used.
 */
function simpleHash(str: string): string {
  let hash = 0;
  const chars: number[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
    chars.push(char);
  }

  // Create a 64-character hex string from multiple hash rounds
  const result: string[] = [];
  let h1 = hash;
  let h2 = hash ^ 0x5a5a5a5a;
  let h3 = hash ^ 0xa5a5a5a5;
  let h4 = hash ^ 0x3c3c3c3c;

  for (let i = 0; i < str.length; i++) {
    h1 = ((h1 << 5) - h1 + chars[i % chars.length]) | 0;
    h2 = ((h2 >> 3) + h2 + chars[(i + 1) % chars.length]) | 0;
    h3 = ((h3 << 3) - h3 + chars[(i + 2) % chars.length]) | 0;
    h4 = ((h4 >> 5) + h4 + chars[(i + 3) % chars.length]) | 0;
  }

  // Convert to hex, ensuring 64 characters
  const hex1 = ((h1 >>> 0) ^ (h2 >>> 0)).toString(16).padStart(8, '0');
  const hex2 = ((h2 >>> 0) ^ (h3 >>> 0)).toString(16).padStart(8, '0');
  const hex3 = ((h3 >>> 0) ^ (h4 >>> 0)).toString(16).padStart(8, '0');
  const hex4 = ((h4 >>> 0) ^ (h1 >>> 0)).toString(16).padStart(8, '0');
  const hex5 = ((h1 >>> 0) + (h2 >>> 0)).toString(16).padStart(8, '0').slice(0, 8);
  const hex6 = ((h2 >>> 0) + (h3 >>> 0)).toString(16).padStart(8, '0').slice(0, 8);
  const hex7 = ((h3 >>> 0) + (h4 >>> 0)).toString(16).padStart(8, '0').slice(0, 8);
  const hex8 = ((h4 >>> 0) + (h1 >>> 0)).toString(16).padStart(8, '0').slice(0, 8);

  return (hex1 + hex2 + hex3 + hex4 + hex5 + hex6 + hex7 + hex8).slice(0, 64);
}

// ============================================================================
// CANONICAL STRING EXPORT (for debugging)
// ============================================================================

/**
 * Exposes the canonical string generation for debugging and testing.
 * This allows verification that the same canonical representation is used.
 */
export function getCanonicalString(
  openingBalanceCents: bigint,
  values: readonly HashableValue[]
): string {
  return generateCanonicalString(openingBalanceCents, values);
}
