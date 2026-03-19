/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ArrowRightToLineIcon,
  CornerDownLeftIcon,
  SpaceIcon,
} from "lucide-react";
import { ReactNode } from "react";
import styles from "./KeyboardSequence.module.scss";

const SPECIALS: Record<string, ReactNode> = {
  "\\n": <CornerDownLeftIcon className={styles.icon} size="1em" />,
  "\\r": <CornerDownLeftIcon className={styles.icon} size="1em" />,
  "\\t": <ArrowRightToLineIcon className={styles.icon} size="1em" />,
  " ": <SpaceIcon className={styles.icon} size="1em" />,
};

export function KeyboardSequence({ keys }: { keys: string }) {
  return keys
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .match(/\\[a-z]|\\\d+|./g)!
    .map((k, i) => (
      <span key={i} className={styles.kbd}>
        {k in SPECIALS ? (
          <span className={styles.special}>{SPECIALS[k]}</span>
        ) : (
          k
        )}
      </span>
    ));
}
