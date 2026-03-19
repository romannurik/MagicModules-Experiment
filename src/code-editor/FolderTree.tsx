/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { DropdownMenu, IconButton, Spinner } from "@radix-ui/themes";
import cn from "classnames";
import {
  EllipsisVerticalIcon,
  FileCode2Icon,
  FileCog2Icon,
  FileHeartIcon,
  FileIcon,
  FileType2Icon,
  FolderIcon,
  SparkleIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import TreeView, { flattenTree, INode } from "react-accessible-treeview";
import styles from "./FolderTree.module.scss";

type ITreeNode = Parameters<typeof flattenTree>[0];

const IGNORE = ["node_modules"];

type Entry =
  | {
      type: "file";
      name: string;
    }
  | {
      type: "dir";
      name: string;
      children: Entry[];
    };

export function codebaseToTree(codebase: Codebase): Entry[] {
  let rootEntries: Entry[] = [];
  let allFiles = Object.keys(codebase.files);
  for (const path of allFiles) {
    const pathParts = path.split("/").filter(Boolean);
    const name = pathParts.pop();
    if (!name || IGNORE.includes(name)) continue;
    let cursorDir: Entry[] = rootEntries;
    for (let part of pathParts) {
      let next = cursorDir.find((e) => e.name === part);
      if (next?.type === "file") {
        cursorDir = cursorDir.filter((e) => e.name !== part);
        next = undefined;
      }
      if (!next) {
        next = {
          type: "dir",
          name: part,
          children: [],
        };
        cursorDir.push(next);
      }
      cursorDir = next.children;
    }
    cursorDir.push({
      type: "file",
      name,
    });
  }

  return rootEntries;
}

export function FolderTree({
  className,
  codebase,
  syncingPaths,
  hiddenPaths,
  showHidden,
  onSelect,
  onRename,
  onDelete,
}: {
  className?: string;
  codebase: Codebase;
  hiddenPaths?: string[];
  syncingPaths?: Record<string, string>;
  showHidden?: boolean;
  onSelect?: (path: string, isDirectory: boolean) => void;
  onRename?: (path: string, newPath: string) => void;
  onDelete?: (path: string) => void;
}) {
  const [data, setData] = useState<INode[]>([]);

  useEffect(() => {
    if (!codebase?.files) return;
    let codeTree = codebaseToTree(codebase);
    let rebuild = () => {
      const buildTree = (entries: Entry[], parentPath = ""): ITreeNode[] => {
        let children: ITreeNode[] = [];
        for (const entry of entries) {
          const fullPath = parentPath
            ? `${parentPath}/${entry.name}`
            : entry.name;
          if (entry.type === "dir") {
            const dirNode: ITreeNode = {
              id: fullPath,
              name: entry.name,
              children: buildTree(entry.children, fullPath),
              metadata: {
                isDirectory: true,
              },
            };
            children.push(dirNode);
          } else {
            if (hiddenPaths?.includes(fullPath) && !showHidden) continue;
            children.push({
              id: fullPath,
              name: entry.name,
              metadata: {
                isDirectory: false,
                loadingText: syncingPaths?.[fullPath] || "",
                hidden: hiddenPaths?.includes(fullPath),
              },
            });
          }
        }
        children = children.sort((a, b) => {
          if (a.metadata!.isDirectory && !b.metadata!.isDirectory) return -1;
          if (!a.metadata!.isDirectory && b.metadata!.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        return children;
      };
      const tree: ITreeNode = {
        name: "project",
        children: buildTree(codeTree),
      };
      setData(flattenTree(tree));
    };
    rebuild();
  }, [codebase, syncingPaths, hiddenPaths, showHidden]);

  return (
    <div className={cn(styles.folderTree, className)}>
      {data.length > 1 && (
        <TreeView
          data={data}
          aria-label="directory tree"
          defaultExpandedIds={[...data.map((node) => node.id), "magic"]}
          onNodeSelect={(node) => {
            onSelect?.(
              String(node.element.id),
              node.element.metadata!.isDirectory as boolean,
            );
          }}
          nodeRenderer={({ element, isBranch, getNodeProps, level }) => (
            <div
              {...getNodeProps()}
              className={cn(getNodeProps().className, {
                [styles.isLoading]: element.metadata?.loadingText,
                [styles.isHidden]: element.metadata?.hidden,
              })}
              style={{ paddingLeft: 20 * (level - 1) }}
            >
              {element.metadata?.loadingText ? (
                <div className={styles.icon}>
                  <Spinner size="2" />
                </div>
              ) : isBranch ? (
                <FolderIcon className={styles.icon} />
              ) : (
                <TypedFileIcon path={String(element.id)} />
              )}
              <span className={styles.label}>
                {String(element.id).match(/^magic\/.*\.md$/)
                  ? element.name.replace(/\.md$/, ".magic")
                  : element.name}
              </span>
              <span className={styles.loadingText}>
                {element.metadata?.loadingText}
              </span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <IconButton
                    variant="ghost"
                    radius="full"
                    color="gray"
                    className={styles.actionsButton}
                  >
                    <EllipsisVerticalIcon size={16} />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content size="1">
                  <DropdownMenu.Item
                    onSelect={() => {
                      let curPath = String(element.id);
                      let newPath = window.prompt("New name", curPath);
                      if (!newPath || newPath === curPath) return;
                      onRename?.(curPath, newPath);
                    }}
                  >
                    Rename
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => onDelete?.(String(element.id))}
                  >
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          )}
        />
      )}
    </div>
  );
}

const TypedFileIcon = ({ path }: { path: string }) => {
  if (
    (path.startsWith("magic/") && path.endsWith(".md")) ||
    path.endsWith(".magic.md")
  ) {
    return <SparkleIcon color="var(--purple-11)" className={styles.icon} />;
  } else if (path.endsWith(".magic.tsx")) {
    return <FileCode2Icon color="var(--gray-9)" className={styles.icon} />;
  } else if (path.startsWith("magic/") && path.endsWith(".py")) {
    return <FileCode2Icon color="var(--gray-9)" className={styles.icon} />;
  }
  const extension = path.slice(path.lastIndexOf(".") + 1);
  switch (extension) {
    case "js":
    case "ts":
    case "tsx":
    case "jsx":
      return <FileCode2Icon color="var(--green-11)" className={styles.icon} />;
    case "html":
      return <FileType2Icon color="var(--amber-11)" className={styles.icon} />;
    case "scss":
    case "css":
      return <FileHeartIcon color="var(--blue-11)" className={styles.icon} />;
    case "json":
      return <FileCog2Icon color="var(--purple-11)" className={styles.icon} />;
    case "npmignore":
    case "gitignore":
      return <FileCog2Icon color="var(--gray-9)" className={styles.icon} />;
    case "py":
      return <FileCode2Icon color="var(--cyan-11)" className={styles.icon} />;
    default:
      return <FileIcon color="var(--gray-11)" className={styles.icon} />;
  }
};
