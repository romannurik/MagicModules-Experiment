/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { pythonEngine } from "./py/py-engine";
import { reactEngine } from "./react/react-engine";
import { Engine } from "./types";

export function engineForCodebase(codebase: Codebase): Engine {
  if (codebase.files["app.py"]) {
    return pythonEngine;
  }
  return reactEngine;
}
