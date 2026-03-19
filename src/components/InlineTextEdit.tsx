/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import cn from "classnames";
import { useState } from "react";
import styles from "./InlineTextEdit.module.scss";

export function InlineTextEdit({
  className,
  value,
  placeholder,
  onChange,
}: {
  className?: string;
  placeholder?: string;
  value: string;
  onChange: (newValue: string) => void;
}) {
  let [editingValue, setEditingValue] = useState<string>();

  return (
    <>
      {editingValue === undefined && (
        <button
          className={cn(className, "is-target", styles.inlineTextEditTarget, {
            "is-placeholder": !value,
          })}
          aria-label={`${value} (Click to edit)`}
          onClick={() => setEditingValue(value)}
        >
          {value || placeholder}
        </button>
      )}
      {editingValue !== undefined && (
        <input
          ref={(node) => {
            if (!node || document.activeElement === node) return;
            node.focus();
            node.select();
          }}
          placeholder={placeholder}
          className={cn(className, "is-editing", styles.inlineTextEditInput)}
          value={editingValue}
          onChange={(ev) => setEditingValue(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.currentTarget.blur();
            } else if (ev.key === "Escape") {
              setEditingValue(undefined);
            }
          }}
          onBlur={() => {
            editingValue && onChange(editingValue);
            setEditingValue(undefined);
          }}
        />
      )}
    </>
  );
}
