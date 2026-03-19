/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cn from "classnames";
import { forwardRef, HTMLAttributes } from "react";
import styles from "./Avatar.module.scss";

type Props = HTMLAttributes<HTMLImageElement> & {
  src?: string | null;
  displayName?: string | null;
};

export const Avatar = forwardRef<HTMLImageElement, Props>(
  ({ src, displayName, className, style, ...props }, ref) => {
    return (
      <img
        ref={ref}
        {...props}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        className={cn(styles.avatar, className)}
        src={sanitizePhotoURL(src || "")}
        alt={displayName || ""}
        style={style}
      />
    );
  }
);

export function sanitizePhotoURL(s: string) {
  return (s || "") + "?sz=256";
}
