/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { GoogleGenAI } from "@google/genai";
import React, { PropsWithChildren } from "react";

export type Engine = {
  // config
  defaultFile: string;
  generatingSpecContent?: string;
  generatingModuleContent?: string;
  // components
  ContextWrapper?: React.ComponentType<PropsWithChildren>;
  PreviewHost: React.ComponentType<{
    className?: string;
    selectedPath?: string;
    codebase: Codebase;
  }>;
  // functionality
  starterCodebase: Codebase;
  augmentCodebase?: (codebase: Codebase) => Codebase;
  computeSync: (codebase: Codebase) => Promise<SyncDelta[]>;
  generateMagicModule: (
    ai: GoogleGenAI,
    opts: {
      codebase: Codebase;
      specPath: string;
      signal?: AbortSignal;
    },
  ) => Promise<{ moduleCode: string }>;
  generateMagicSpec: (
    ai: GoogleGenAI,
    opts: {
      codebase: Codebase;
      specPath: string;
      usedBySourcePath: string;
      signal?: AbortSignal;
    },
  ) => Promise<{ specContent: string }>;
  updateMagicModule: (
    ai: GoogleGenAI,
    opts: {
      codebase: Codebase;
      specPath: string;
      modulePath: string;
      signal?: AbortSignal;
    },
  ) => Promise<{ moduleCode: string }>;
};

export type SyncDelta =
  | {
      type: "new-magic-module";
      usedBySourcePath: string;
      specPath: string;
      modulePath: string;
    }
  | {
      type: "update-magic-module";
      specPath: string;
      modulePath: string;
    };
