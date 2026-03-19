/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GenerateContentParameters } from "@google/genai";

export type AppToHostMessage = ProtocolToUnion<AppToHostProtocol>;
export type AppToHostProtocol = {
  mouseMove: { x: number; y: number };
  aiGenerateContent: { requestId: string; gcr: GenerateContentParameters };
};

export type HostToAppMessage = ProtocolToUnion<HostToAppProtocol>;
export type HostToAppProtocol = {
  aiGenerateContentResponse: { requestId: string } & (
    | { chunk: string }
    | { error: string }
    | { done: true }
  );
};

// type helpers
type Prettify<T> = { [K in keyof T]: T[K] } & {};
type ProtocolToUnion<T extends Record<string, Record<string, any>>> = Prettify<
  {
    [K in keyof T]: T[K] & {
      type: K;
    };
  }[keyof T]
>;
