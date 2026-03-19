/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { FIREBASE_CONFIG } from "./firebase-config";

export const app = initializeApp(FIREBASE_CONFIG);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);