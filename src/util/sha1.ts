/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Computes the SHA-1 hash of a string.
 */
export async function sha1(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await window.crypto.subtle.digest("SHA-1", msgUint8); // hash the message
  const hashHex = (new Uint8Array(hashBuffer) as any).toHex(); // Convert ArrayBuffer to hex string.
  return hashHex;
}
