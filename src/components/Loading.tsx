/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Spinner, Text } from "@radix-ui/themes";

export function Loading({ text }: { text?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Spinner size="3" />
      {text && (
        <Text size="2" color="gray">
          {text}
        </Text>
      )}
    </div>
  );
}
