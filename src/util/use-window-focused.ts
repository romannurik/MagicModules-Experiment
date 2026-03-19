/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from "react";

export function useWindowFocused() {
  const [windowFocused, setWindowFocused] = useState(
    document.visibilityState === "visible"
  );

  useEffect(() => {
    let abort = new AbortController();
    window.addEventListener("focus", () => setWindowFocused(true), abort);
    window.addEventListener("blur", () => setWindowFocused(false), abort);
    return () => abort.abort();
  }, []);

  return windowFocused;
}
