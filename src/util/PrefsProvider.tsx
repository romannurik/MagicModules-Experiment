/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState } from "react";

const PREFS_KEY = "threep-app-prefs";

export type Prefs = {
  termsAccepted?: boolean;
  // app-specific!
  showHiddenFiles?: boolean;
  geminiApiKey?: string;
};

const initialPrefs: Prefs = (() => {
  let prefsString = localStorage.getItem(PREFS_KEY);
  if (prefsString) {
    try {
      return JSON.parse(prefsString) as Prefs;
    } catch {}
  }
  return {};
})();

type PrefsContext = {
  prefs: Partial<Prefs>;
  updatePrefs: (updates: Partial<Prefs>) => void;
};

const PrefsContext = createContext<PrefsContext>({} as PrefsContext);

export function usePrefsContext() {
  return useContext(PrefsContext);
}

export function PrefsProvider({ children }: React.PropsWithChildren) {
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);

  function updatePrefs(updates: Partial<Prefs>) {
    setPrefs((prefs) => {
      let newPrefs = {
        ...prefs,
        ...updates,
      };
      localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
      return newPrefs;
    });
  }

  return (
    <PrefsContext.Provider value={{ prefs, updatePrefs }}>
      {children}
    </PrefsContext.Provider>
  );
}
