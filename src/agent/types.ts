/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool } from "@/ai/tools";
import { Content, Part } from "@google/genai";

declare module "@google/genai" {
  interface Part {
    extError?: string;
    extTimestamp?: number;
    extMetadata?: Record<string, any>;
  }
}

export type Agent<TContext = unknown> = {
  generate(
    prompt: string,
    options: {
      history?: Content[];
      signal?: AbortSignal;
      context?: TContext;
    }
  ): AsyncGenerator<Part>;
  tools: Tool<unknown>[];
};
