/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import z from "zod";
import { Part } from "@google/genai";

type MaybePromise<T> = T | Promise<T>;

export type Tool<TInput, TContext = unknown> = {
  name: string;
  description: string;
  parameters: z.ZodType<TInput>;
  run(
    args: TInput,
    options: {
      signal?: AbortSignal;
      context?: TContext;
    }
  ): MaybePromise<
    | string
    | { output: string; metadata?: any }
    | { parts: Part[]; metadata?: any }
  >;
  // presentation
  icon?: LucideIcon;
  dynamicIcon?: (
    args: TInput,
    response?: any,
    responseMetadata?: any
  ) => LucideIcon;
  displayName?:
    | string
    | ((args: TInput, response?: any, responseMetadata?: any) => string);
  renderSummaryLine?(
    args: TInput,
    response?: any,
    responseMetadata?: any
  ): string | ReactNode;
  renderBody?(
    args: TInput,
    response?: any,
    responseMetadata?: any
  ): string | ReactNode;
};

export function makeTool<TInput, TContext>(
  tool: Tool<TInput, TContext>
): Tool<TInput, TContext> {
  return tool;
}
