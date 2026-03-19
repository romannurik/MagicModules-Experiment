/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import GeminiIcon from "@/icons/GeminiIcon";
import { Prefs, usePrefsContext } from "@/util/PrefsProvider";
import { Flex, TextField } from "@radix-ui/themes";

export function areRequiredPrefsSet(prefs: Prefs) {
  return !!prefs.geminiApiKey;
}

export function RequiredPrefs() {
  const { prefs, updatePrefs } = usePrefsContext();
  return (
    <Flex direction="column" gap="2">
      <TextField.Root
        value={prefs.geminiApiKey || ""}
        placeholder="Gemini API key"
        onChange={(ev) =>
          updatePrefs({
            geminiApiKey: ev.currentTarget.value,
          })
        }
        onFocus={(ev) => ev.currentTarget.select()}
      >
        <TextField.Slot>
          <Flex align="center" gap="1">
            <GeminiIcon size={16} />
            {prefs.geminiApiKey && "Key"}
          </Flex>
        </TextField.Slot>
      </TextField.Root>
    </Flex>
  );
}
