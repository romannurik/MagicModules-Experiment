/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { shikiToMonaco } from "@shikijs/monaco";
import cn from "classnames";
import * as monaco from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { createHighlighter } from "shiki";
import styles from "./MonacoEditor.module.scss";

const highlighter = await createHighlighter({
  themes: ["github-dark-default"],
  langs: ["tsx", "markdown"],
  langAlias: {
    typescript: "tsx",
  },
});

monaco.languages.register({ id: "typescript" });

// file extension --> Monaco language
const LANGUAGES: Record<string, string> = {
  html: "html",
  htm: "html",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  js: "typescript",
  jsx: "typescript",
  css: "css",
  py: "python",
  md: "markdown",
};

// TSX support: https://gist.github.com/RoboPhred/f767bea5cbc972e04155a625dc11da11
// (though we're still missing syntax highlighting)
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  jsx: "react" as any,
});
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});

shikiToMonaco(highlighter, monaco);

export function MonacoEditor({
  className,
  path,
  defaultValue,
  allFiles,
  readOnly,
  fitHeight,
  onChange,
}: {
  className?: string;
  path?: string;
  defaultValue?: string;
  allFiles?: Record<string, string>;
  readOnly?: boolean;
  fitHeight?: boolean;
  onChange?: (value: string) => void;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>();

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const otherFiles = useMemo(() => {
    return Object.entries(allFiles || {}).filter(([uri]) => uri !== path);
  }, [allFiles, path]);

  const [_, setRehighlightKey] = useState(0);
  // TODO: avoid triggering onChange when this happens
  // useEffect(() => {
  //   let to = setTimeout(() => {
  //     let m = editorRef.current?.getModel();
  //     m?.pushEditOperations(
  //       [],
  //       [{ range: new monaco.Range(1, 1, 1, 1), text: " " }],
  //       () => null
  //     );
  //     m?.pushEditOperations(
  //       [],
  //       [{ range: new monaco.Range(1, 1, 1, 2), text: "" }],
  //       () => null
  //     );
  //   }, 500);
  //   return () => clearTimeout(to);
  // }, [rehighlightKey]);

  useEffect(() => {
    let otherFileEntries = Object.entries(allFiles || {});
    if (!otherFileEntries.length) return;
    let disposables: monaco.IDisposable[] = [];
    for (const [uri, content] of otherFileEntries) {
      if (uri === path) continue;
      let model = monaco.editor.getModel(monaco.Uri.parse(uri));
      if (!model) {
        model = monaco.editor.createModel(
          content,
          LANGUAGES[uri.slice(uri.lastIndexOf(".") + 1)] || "plaintext",
          monaco.Uri.parse(uri),
        );
      } else {
        // unfortunately model disposal doesn't work well in monaco editor, so we re-use
        // existing models instead of always creating new ones
        model.setValue(content);
      }
      if (uri.endsWith(".d.ts")) {
        disposables.push(
          monaco.languages.typescript.javascriptDefaults.addExtraLib(
            content,
            uri,
          ),
        );
      }
    }
    let editor = editorRef.current;
    let model = editor?.getModel();
    if (editor && model) {
      let viewState = editor.saveViewState();
      model.setValue(model.getValue());
      editor.restoreViewState(viewState);
    }
    setRehighlightKey((k) => k + 1);
    return () => disposables.forEach((d) => d.dispose());
  }, [JSON.stringify(otherFiles), path]);

  useEffect(() => {
    if (!node) return;
    let abort = new AbortController();

    const editor = monaco.editor.create(node, {
      padding: { top: 12, bottom: 12 },
      automaticLayout: true,
      theme: "github-dark-default",
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: "off",
      renderLineHighlight: fitHeight ? "none" : undefined,
      fontFamily: '"Google Sans Code", monospace',
      scrollBeyondLastLine: !fitHeight,
      scrollbar: {
        alwaysConsumeMouseWheel: fitHeight ? false : undefined,
      },
      readOnly,
      tabSize: 2,
    });
    const [, fileExt] = (path || "").match(/\.([^.]+)$/) || [];
    let model = monaco.editor.getModel(monaco.Uri.file(path || ""));
    if (!model) {
      model = monaco.editor.createModel(
        defaultValue || "",
        LANGUAGES[fileExt] || "plaintext",
        monaco.Uri.file(path || ""),
      );
    } else {
      model.setValue(defaultValue || "");
    }
    editor.setModel(model);
    // debounce multiple edits in a single tick
    let lastValue = "";
    let debounceTimeout: NodeJS.Timeout | undefined;
    editor.onDidChangeModelContent(() => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        let newValue = editor.getValue();
        if (lastValue === newValue) return;
        if (abort.signal.aborted) return;
        onChangeRef.current?.(newValue);
        lastValue = newValue;
        debounceTimeout = undefined;
      });
    });
    editor.onDidContentSizeChange(() => {
      if (!fitHeight) return;
      editor.layout({
        width: node.offsetWidth,
        height: editor.getContentHeight(),
      });
    });
    if (fitHeight) {
      setTimeout(() =>
        editor.layout({
          width: node.offsetWidth,
          height: editor.getContentHeight(),
        }),
      );
    }
    editorRef.current = editor;
    abort.signal.addEventListener("abort", () => {
      editorRef.current = undefined;
      editor.dispose();
      model.dispose();
    });
    return () => abort.abort();
  }, [node, path, readOnly, fitHeight]);

  return (
    <div
      className={cn(styles.editor, className)}
      ref={(node) => setNode(node)}
    />
  );
}
