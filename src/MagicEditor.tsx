/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDocumentContext } from "@/document/DocumentProvider";
import cn from "classnames";
import graymatter from "gray-matter";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { pythonEngine } from "./engines/py/py-engine";
import styles from "./MagicEditor.module.scss";
import { MarkdownEditor } from "./markdown-editor/MarkdownEditor";
import { PythonVerificationsEditor } from "./PythonVerificationsEditor";

export type Verification =
  | {
      type: "agentic";
      title: string;
      pythonCodeHarness: string;
      prompt: string;
    }
  | {
      type: "static";
      title: string;
      pythonCodeHarness: string;
      expectedOutput: string;
    };

export function MagicEditor({
  defaultSpec,
  onUpdateSpec,
  className,
}: {
  defaultSpec?: string;
  onUpdateSpec?: (spec: string) => void;
  className?: string;
}) {
  const { engine } = useDocumentContext();

  const [editedMarkdown, setEditedMarkdown] = useState<string>();
  const [editedVerifications, setEditedVerifications] =
    useState<Verification[]>();

  // parse out passed-in spec with graymatter
  const { defaultMarkdown, defaultVerifications } = useMemo(() => {
    let { data, content } = graymatter(defaultSpec || "");
    let verifications = data.verifications || [];
    return {
      defaultMarkdown: content,
      defaultVerifications: verifications as Verification[],
    };
  }, [defaultSpec]);

  // passing edits up
  useEffect(() => {
    // console.log(editedMarkdown, editedVerifications);
    if (!editedMarkdown && !editedVerifications) return;
    let spec = graymatter.stringify(editedMarkdown ?? defaultMarkdown, {
      verifications: editedVerifications ?? defaultVerifications,
    });
    onUpdateSpec?.(spec);
  }, [editedMarkdown, editedVerifications]);

  return (
    <div className={cn(styles.magicEditor, className)}>
      <MarkdownEditor
        className={styles.markdownEditor}
        contentClassName={styles.markdownEditorContent}
        markdown={defaultMarkdown || ""}
        onUpdate={(content) => setEditedMarkdown(content || "")}
      />
      {engine === pythonEngine && (
        <PythonVerificationsEditor
          verifications={editedVerifications || defaultVerifications}
          onEditVerifications={setEditedVerifications}
        />
      )}
    </div>
  );
}

export function MagicEditorSectionBar({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const sectionBarRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className={styles.sectionBar} ref={sectionBarRef}>
        <h2
          onClick={() => {
            anchorRef.current!.style.scrollMarginTop =
              sectionBarRef.current!.offsetHeight + "px";
            anchorRef.current!.scrollIntoView({
              block: "start",
              behavior: "smooth",
            });
          }}
        >
          {title}
        </h2>
        {children}
      </div>
      <div ref={anchorRef} />
    </>
  );
}
