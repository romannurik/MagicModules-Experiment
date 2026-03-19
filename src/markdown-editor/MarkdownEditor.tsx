/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { debounce } from "@/util/debounce";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import cn from "classnames";
import js from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import { lowlight } from "lowlight";
import { useEffect } from "react";
import { Markdown, MarkdownStorage } from "tiptap-markdown";
import styles from "./MarkdownEditor.module.scss";

lowlight.registerLanguage("js", js);
lowlight.registerLanguage("html", xml);

const extensions = [
  Markdown,
  StarterKit.configure({
    bulletList: {
      HTMLAttributes: {
        class: "-mt-2",
      },
    },
    orderedList: {
      HTMLAttributes: {
        class: "-mt-2",
      },
    },
    listItem: {
      HTMLAttributes: {
        class: "-mb-2",
      },
    },
    code: {
      HTMLAttributes: {
        spellcheck: "false",
      },
    },
    codeBlock: false,
    dropcursor: {
      color: "#DBEAFE",
      width: 4,
    },
    gapcursor: false,
  }),
  CodeBlockLowlight.extend({
    addAttributes() {
      return {
        ...this.parent?.(), // includes language
        result: {
          default: null,
        },
        runId: {
          default: null,
        },
      };
    },
  }).configure({ lowlight, defaultLanguage: "js" }),
  Highlight,
  Typography,
];

declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

export function MarkdownEditor({
  markdown,
  onUpdate,
  className,
  contentClassName,
}: {
  markdown: string;
  className?: string;
  contentClassName?: string;
  onUpdate?: (markdown: string) => void;
}) {
  const editor = useEditor({
    extensions,
    content: markdown,
    element: (dom) => contentClassName && dom.classList.add(contentClassName),
    onUpdate: debounce(() => {
      const markdownOutput = editor.storage?.markdown.getMarkdown();
      onUpdate?.(markdownOutput);
    }),
    autofocus: !markdown ? "start" : false,
  });

  useEffect(() => {
    if (editor && markdown === "<p></p><p></p><p></p>") {
      editor.commands.focus();
    }
  }, [editor, markdown]);

  return (
    <div className={cn(styles.markdownEditor, className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
