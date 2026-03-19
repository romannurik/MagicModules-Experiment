/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import cn from "classnames";
import FontFaceObserver from "fontfaceobserver";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import styles from "./Terminal.module.scss";

export type TerminalRef = {
  term: Xterm | undefined;
};

const THEME = {
  foreground: "var(--gray-11)",
  background: "var(--gray-2)",
  selection: "var(--accent-12)",

  black: "var(--gray-4)",
  brightBlack: "var(--gray-8)",
  white: "var(--gray-11)",
  brightWhite: "var(--gray-12)",

  red: "var(--red-10)",
  brightRed: "var(--red-11)",
  yellow: "var(--amber-10)",
  brightYellow: "var(--amber-11)",
  green: "var(--green-10)",
  brightGreen: "var(--green-11)",
  cyan: "var(--cyan-10)",
  brightCyan: "var(--cyan-11)",
  blue: "var(--blue-10)",
  brightBlue: "var(--blue-11)",
  magenta: "var(--purple-10)",
  brightMagenta: "var(--purple-11)",
};

export type TerminalProps = {
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  onTerm?: (term: Xterm) => void;
};

export const Terminal = forwardRef<TerminalRef, TerminalProps>(
  ({ className, style, autoFocus, onTerm }, ref) => {
    let [node, setNode] = useState<HTMLDivElement | null>(null);
    let [backgroundColor, setBackgroundColor] = useState<string>();
    let [term, setTerm] = useState<Xterm>();

    useImperativeHandle(ref, () => ({ term }), [term]);

    useEffect(() => {
      if (!node) return;
      let theme = computedCssColors(THEME, node);
      let term = new Xterm({
        allowProposedApi: true,
        theme,
        fontFamily: "'Google Sans Code', monospace",
        fontSize: 13,
        // fontWeightBold: 800,
        drawBoldTextInBrightColors: false,
        lineHeight: 1,
        tabStopWidth: 2,
        convertEol: true,
      });
      setBackgroundColor(theme.background);
      let abort = new AbortController();
      const fitAddon = new FitAddon();
      let resizeObserver = new ResizeObserver(() => fitAddon.fit());
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());
      let onResize = () => fitAddon.fit();
      resizeObserver.observe(node);
      abort.signal.addEventListener("abort", () => resizeObserver.disconnect());
      setTerm(term);
      onTerm?.(term);
      (async () => {
        let font = new FontFaceObserver("Google Sans Code");
        try {
          await font.load();
        } catch (e) {}
        if (abort.signal.aborted) return;
        term.open(node);
        if (autoFocus) term.focus();
        onResize();
      })();
      return () => {
        abort.abort();
        setTerm(undefined);
        term.dispose();
      };
    }, [node, autoFocus]);

    return (
      <div
        style={{ ...style, backgroundColor }}
        className={cn(className, styles.terminalContainer)}
      >
        <div className={styles.terminal} ref={(node) => setNode(node)} />
      </div>
    );
  }
);

function computedCssColors(colors: Record<string, string>, node: HTMLElement) {
  if (!node) return colors;
  let cs = window.getComputedStyle(node);
  return Object.fromEntries(
    Object.entries(colors).map(([k, val]) => {
      let m = val.match(/var\((\-\-.+)\)/);
      if (m) val = cs.getPropertyValue(m[1]);
      return [k, val];
    })
  ) as Record<string, string>;
}
