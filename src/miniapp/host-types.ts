/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calls AI, returning an async generator that yields content chunks as they arrive. Example:
 * ```ts
 * import { generateContentStream } from '$';
 * async function callAI() {
 *   let request = {
 *     contents: [
 *       {
 *         role: 'user',
 *         parts: [
 *           { text: "Hello there" }
 *         ]
 *       }
 *     ]
 *   };
 *   let result = "";
 *   for await (let chunk of generateContentStream(request)) {
 *     result += chunk;
 *     console.log("Received chunk:", chunk);
 *   }
 *   console.log("Final result:", result);
 * }
 * ```
 */
export type generateContentStream = (
  messages: Array<{ role: "user" | "model"; text: string }>
) => AsyncIterable<string>;
