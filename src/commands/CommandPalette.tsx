/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Dialog, Inset, VisuallyHidden } from "@radix-ui/themes";
import cn from "classnames";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./CommandPalette.module.scss";
import { CommandContext, useCommand } from "./CommandProvider";
import { Shortcut } from "./Shortcut";

export function CommandPalette() {
  const { registrations, bus } = useContext(CommandContext);
  const [open, setOpen] = useState(false);
  let [filter, setFilter] = useState("");
  let [selectedId, setSelectedId] = useState<string>();
  let inputRef = useRef<HTMLInputElement>(null);

  let matchingRegistrations = useMemo(() => {
    let matches = registrations.filter((r) => !r.config.disabled);
    if (filter)
      matches = matches.filter((r) =>
        r.config.label?.toLowerCase().includes(filter.toLowerCase())
      );
    return matches;
  }, [registrations, filter]);

  useCommand(
    { keyName: "?", label: "Show keyboard shortcuts" },
    () => setOpen((open) => !open),
    []
  );
  useCommand(
    { keyName: "/", label: "Show command palette" },
    () => setOpen((open) => !open),
    []
  );

  useEffect(() => {
    if (!open) {
      setFilter("");
      return;
    }
    let style = document.createElement("style");
    document.head.appendChild(style);
    style.textContent = `
      .rt-DialogScrollPadding {
        margin-top: 20vh;
      }

      .rt-DialogOverlay {
        --color-overlay: transparent !important;
      }
    `;
    return () => void document.head.removeChild(style);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    setSelectedId(matchingRegistrations[0]?.id);
  }, [matchingRegistrations, open]);

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content size="1" style={{ maxWidth: 400 }}>
        <VisuallyHidden>
          <Dialog.Title>Commands</Dialog.Title>
        </VisuallyHidden>
        <Inset className={styles.container}>
          <input
            ref={inputRef}
            placeholder="Search for commands"
            className={styles.filter}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
                ev.preventDefault();
                let dir = ev.key === "ArrowUp" ? -1 : 1;
                let idx = matchingRegistrations.findIndex(
                  (r) => r.id === selectedId
                );
                if (idx === -1) idx = 0;
                idx += dir;
                if (idx < 0) idx = matchingRegistrations.length - 1;
                if (idx >= matchingRegistrations.length) idx = 0;
                setSelectedId(matchingRegistrations[idx]?.id);
              } else if (ev.key === "Enter") {
                ev.preventDefault();
                setOpen(false);
                bus.dispatchEvent(
                  new CustomEvent("shortcut", {
                    detail: selectedId,
                  })
                );
              }
            }}
          />
          <div className={styles.list}>
            {matchingRegistrations.map((r) => (
              <button
                key={r.id}
                tabIndex={-1}
                className={cn(styles.item, {
                  [styles.isSelected]: selectedId === r.id,
                })}
                onMouseEnter={() => setSelectedId(r.id)}
                onFocus={() => inputRef?.current?.focus()}
              >
                {r.config.label}
                <div style={{ flex: 1 }} />
                <Shortcut config={r.config} />
              </button>
            ))}
            {!matchingRegistrations.length && (
              <div className={styles.noResults}>No commands</div>
            )}
          </div>
        </Inset>
      </Dialog.Content>
    </Dialog.Root>
  );
}
