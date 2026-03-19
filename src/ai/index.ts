/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { usePrefsContext } from "@/util/PrefsProvider";
import { GoogleGenAI } from "@google/genai";
import { useMemo } from "react";

export function useGeminiApi() {
  const { prefs } = usePrefsContext();
  return useMemo(() => {
    return new GoogleGenAI({
      apiKey: prefs.geminiApiKey || "FAKE_INVALID_KEY",
      httpOptions: { apiVersion: "v1alpha" },
    });
  }, [prefs.geminiApiKey]);
}
