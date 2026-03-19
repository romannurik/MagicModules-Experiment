/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

let config: object = {};
try {
  config = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
} catch (e) {
  throw new Error(
    'Must provide FIREBASE_CONFIG as a JSON object (with keys "projectId", "apiKey", etc) in .env',
  );
}
export const FIREBASE_CONFIG = config;
