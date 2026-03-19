/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { areRequiredPrefsSet, RequiredPrefs } from "@/onboarding/RequiredPrefs";
import { usePrefsContext } from "@/util/PrefsProvider";
import { IconButton, Popover, Tooltip } from "@radix-ui/themes";
import { Settings2Icon } from "lucide-react";

export function SettingsButton() {
  const { prefs } = usePrefsContext();
  return (
    <Popover.Root>
      <Tooltip content="Settings">
        <Popover.Trigger>
          <IconButton
            variant="ghost"
            color="gray"
            radius="full"
            style={{ position: "relative" }}
          >
            <Settings2Icon size={20} />
            {!areRequiredPrefsSet(prefs) && (
              <div
                style={{
                  position: "absolute",
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: "var(--red-10)",
                  top: 4,
                  right: 4,
                }}
              />
            )}
          </IconButton>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Content width="360px">
        <RequiredPrefs />
      </Popover.Content>
    </Popover.Root>
  );
}
