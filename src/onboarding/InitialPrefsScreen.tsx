/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Link } from "@radix-ui/themes";
import { ArrowRightIcon, Settings2Icon } from "lucide-react";
import { Onboarding } from "./Onboarding";
import styles from "./Onboarding.module.scss";
import { areRequiredPrefsSet, RequiredPrefs } from "./RequiredPrefs";
import { usePrefsContext } from "@/util/PrefsProvider";

export function InitialPrefsScreen({ onContinue }: { onContinue: () => void }) {
  const { prefs } = usePrefsContext();
  return (
    <Onboarding.Container>
      <Onboarding.Image>
        <Settings2Icon />
      </Onboarding.Image>
      <Onboarding.Title>Let's get set up</Onboarding.Title>
      <Onboarding.Description>
        For this experiment, you'll need to use your own{" "}
        <Link href="https://aistudio.google.com/api-keys">Gemini API key</Link>.
      </Onboarding.Description>
      <RequiredPrefs />
      <Button
        mt="5"
        disabled={!areRequiredPrefsSet(prefs)}
        className={styles.cta}
        onClick={onContinue}
      >
        Continue
        <ArrowRightIcon size={16} />
      </Button>
    </Onboarding.Container>
  );
}
