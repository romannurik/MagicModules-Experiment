/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { FolderTree } from "@/code-editor/FolderTree";
import { MonacoEditor } from "@/code-editor/MonacoEditor";
import { Command } from "@/commands/CommandProvider";
import { Shortcut } from "@/commands/Shortcut";
import { Header } from "@/components/Header";
import { Loading } from "@/components/Loading";
import {
  Codebase,
  DocumentProvider,
  useDocumentContext,
} from "@/document/DocumentProvider";
import { UNTITLED_DOC_TITLE } from "@/document/model-and-db";
import { usePrefsContext } from "@/util/PrefsProvider";
import {
  Button,
  Callout,
  Card,
  Flex,
  IconButton,
  Switch,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import {
  LucideProps,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  SparkleIcon,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useGeminiApi } from "./ai";
import styles from "./Editor.module.scss";
import { pythonEngine } from "./engines/py/py-engine";
import { reactEngine } from "./engines/react/react-engine";
import { SyncDelta } from "./engines/types";
import AntDesignPythonIcon from "./icons/AntDesignPythonIcon";
import ReactIcon from "./icons/ReactIcon";
import { MagicEditor } from "./MagicEditor";

type Props = { docId: string };

export function Editor(props: Props) {
  let { docId } = props;
  return (
    <DocumentProvider docId={docId}>
      <EditorInner key={docId} />
    </DocumentProvider>
  );
}

function EditorInner() {
  const { engine, codebase, setCodebase, docLoading, metadata } =
    useDocumentContext();
  const { prefs, updatePrefs } = usePrefsContext();
  const [draftCodebase, setDraftCodebase] = useState(codebase);
  const [dirty, setDirty] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [syncingPaths, setSyncingPaths] = useState<Record<string, string>>({});
  const ai = useGeminiApi();

  useEffect(() => {
    setDirty(false);
    setDraftCodebase(structuredClone(codebase));
  }, [codebase]);

  useEffect(() => {
    if (!draftCodebase || (selectedPath && selectedPath in draftCodebase.files))
      return;
    if (!draftCodebase.files[engine.defaultFile]) return;
    setSelectedPath(engine.defaultFile);
  }, [draftCodebase, engine]);

  useEffect(() => {
    if (!dirty) return;
    let abort = new AbortController();
    window.addEventListener("beforeunload", (ev) => ev.preventDefault(), abort);
    return () => abort.abort();
  }, [dirty]);

  useEffect(() => {
    document.title = `${metadata?.title || UNTITLED_DOC_TITLE} – Magic Modules`;
  }, [metadata?.title]);

  const augmentedCodebase = useMemo(
    () => engine.augmentCodebase?.(codebase) || codebase,
    [codebase, engine],
  );

  const augmentedDraftCodebase = useMemo(
    () => engine.augmentCodebase?.(draftCodebase) || draftCodebase,
    [draftCodebase, engine],
  );

  const syncBus = useMemo(() => new EventTarget(), []);

  useEffect(() => {
    let jobQueue: Array<{ delta: SyncDelta; abort: AbortController }> = [];
    let statuses: Record<string, string> = {};
    let processingJobs = false;
    let latestCodebase: Codebase = { files: {} };

    let updateSyncingPaths = () => setSyncingPaths(statuses);

    let processJobs = async () => {
      if (processingJobs) return;
      updateSyncingPaths();
      processingJobs = true;
      while (jobQueue.length) {
        let job = jobQueue.shift()!;
        try {
          let { delta, abort } = job;
          if (abort.signal.aborted) continue;
          if (delta.type === "new-magic-module") {
            statuses[delta.specPath] = "Specing";
            updateSyncingPaths();

            let { specContent } = await engine.generateMagicSpec(ai, {
              codebase: latestCodebase,
              ...delta,
              signal: abort.signal,
            });
            setCodebase((codebase) => ({
              ...codebase,
              files: {
                ...codebase.files,
                [delta.specPath]: specContent || "",
              },
            }));
            statuses[delta.specPath] = "Implementing";
            statuses[delta.modulePath] = "Implementing";
            updateSyncingPaths();

            let { moduleCode } = await engine.generateMagicModule(ai, {
              codebase: {
                ...latestCodebase,
                files: {
                  ...latestCodebase.files,
                  [delta.specPath]: specContent || "",
                },
              },
              specPath: delta.specPath,
              signal: abort.signal,
            });
            setCodebase((codebase) => ({
              ...codebase,
              files: {
                ...codebase.files,
                [delta.modulePath]: moduleCode || "",
              },
            }));
            delete statuses[delta.specPath];
            delete statuses[delta.modulePath];
            updateSyncingPaths();
          } else if (delta.type === "update-magic-module") {
            statuses[delta.specPath] = "Updating";
            statuses[delta.modulePath] = "Updating";
            updateSyncingPaths();

            let { moduleCode } = await engine.updateMagicModule(ai, {
              codebase: latestCodebase,
              ...delta,
              signal: abort.signal,
            });
            setCodebase((codebase) => ({
              ...codebase,
              files: {
                ...codebase.files,
                [delta.modulePath]: moduleCode || "",
              },
            }));
            delete statuses[delta.specPath];
            delete statuses[delta.modulePath];
            updateSyncingPaths();
          }
        } catch (e) {}
        updateSyncingPaths();
      }
      processingJobs = false;
    };

    // main sync handler
    let abort: AbortController | undefined;
    let abortEffect = new AbortController();
    syncBus.addEventListener(
      "sync",
      async (ev) => {
        abort?.abort();
        abort = new AbortController();
        latestCodebase = (ev as CustomEvent).detail as Codebase;
        let deltas = await engine.computeSync(latestCodebase);
        if (abort.signal.aborted) return;
        for (let delta of deltas) {
          if (jobQueue.find((j) => j.delta.specPath === delta.specPath))
            continue;
          let newFiles: Record<string, string> = {};
          newFiles[delta.modulePath] =
            engine.generatingModuleContent || "Generating module...";
          if (delta.type === "new-magic-module") {
            newFiles[delta.specPath] =
              engine.generatingSpecContent || "Generating spec...";
          }
          jobQueue.push({ delta, abort: new AbortController() });
          setCodebase((codebase) => ({
            ...codebase,
            files: {
              ...codebase.files,
              ...newFiles,
            },
          }));
        }
        processJobs();
      },
      abortEffect,
    );
    return () => abortEffect.abort();
  }, [ai, engine]);

  const performSave = () => {
    syncBus.dispatchEvent(new CustomEvent("sync", { detail: draftCodebase }));
    setCodebase(draftCodebase);
    setDraftCodebase(structuredClone(draftCodebase));
    setDirty(false);
  };

  if (docLoading) {
    return <Loading />;
  }

  let ContextWrapper = engine.ContextWrapper || Fragment;

  let emptyState = Object.keys(codebase.files).length === 0;

  return (
    <ContextWrapper>
      <div className={styles.editor}>
        <Header />
        <div className={styles.content}>
          {!emptyState && (
            <>
              <div className={styles.toolbar}>
                <Command label="New file" keyName="n" ctrl shift>
                  <IconButton
                    color="gray"
                    radius="full"
                    size="2"
                    variant="ghost"
                    onClick={() => {
                      let path = prompt("Enter file path");
                      if (!path) return;
                      setDraftCodebase((draftCodebase) => ({
                        ...draftCodebase,
                        files: {
                          ...draftCodebase.files,
                          [path]: "",
                        },
                      }));
                      setDirty(true);
                    }}
                  >
                    <PlusIcon size={20} />
                  </IconButton>
                </Command>
                <Command label="Save changes" noTooltip keyName="s" meta>
                  <Button
                    size="1"
                    color="gray"
                    variant="surface"
                    disabled={!dirty}
                    style={dirty ? {} : { visibility: "hidden" }}
                    onClick={() => dirty && performSave()}
                  >
                    <SaveIcon size={16} />
                    Save changes
                    <Shortcut config={{ keyName: "s", meta: true }} />
                  </Button>
                </Command>
                <div style={{ flex: 1 }} />
                {engine === pythonEngine && (
                  <Command label="Save and re-run" keyName="r" ctrl>
                    <IconButton
                      color="gray"
                      radius="full"
                      size="2"
                      variant="ghost"
                      onClick={() => performSave()}
                    >
                      <PlayIcon size={20} />
                    </IconButton>
                  </Command>
                )}
                <Tooltip content="Show hidden (fully AI-owned) files">
                  <Flex align="center">
                    <Switch
                      size="1"
                      checked={prefs.showHiddenFiles}
                      onCheckedChange={(checked) =>
                        updatePrefs({ showHiddenFiles: checked })
                      }
                    />
                  </Flex>
                </Tooltip>
              </div>
              <div className={styles.treeContainer}>
                <FolderTree
                  className={styles.tree}
                  codebase={draftCodebase}
                  syncingPaths={syncingPaths}
                  hiddenPaths={Object.keys(draftCodebase.files).filter(
                    (path) =>
                      path.endsWith(".magic.tsx") ||
                      (path.startsWith("magic/") && path.endsWith(".py")),
                  )}
                  showHidden={prefs.showHiddenFiles}
                  onSelect={(filePath, isDirectory) =>
                    !isDirectory && setSelectedPath(filePath)
                  }
                  onDelete={(filePath) => {
                    setDraftCodebase((codebase) => ({
                      ...codebase,
                      files: Object.fromEntries(
                        Object.entries(codebase.files).filter(
                          ([path]) => !path.startsWith(filePath),
                        ),
                      ),
                    }));
                    setDirty(true);
                  }}
                  onRename={(filePath, newPath) => {
                    if (selectedPath === filePath) setSelectedPath(newPath);
                    setDraftCodebase((codebase) => ({
                      ...codebase,
                      files: Object.fromEntries(
                        Object.entries(codebase.files).map(([path, content]) =>
                          path.startsWith(filePath)
                            ? [
                                newPath + path.substring(filePath.length),
                                content,
                              ]
                            : [path, content],
                        ),
                      ),
                    }));
                    setDirty(true);
                  }}
                />
                {engine === pythonEngine && (
                  <Callout.Root
                    size="1"
                    color="purple"
                    className={styles.notices}
                  >
                    <Text size="1">
                      To create magic modules,
                      <ol>
                        <li>
                          Import (use a descriptive name!)
                          <br />
                          <pre>from magic.ascii import ascii_art</pre>
                        </li>
                        <li>
                          Use it in your code
                          <br />
                          <pre>print(ascii_art("hello world"))</pre>
                        </li>
                        <li>
                          Hit save!{" "}
                          <Shortcut
                            className={styles.shortcut}
                            config={{ keyName: "s", ctrlOrCmd: true }}
                          />
                        </li>
                        <li>
                          Change the <code>.magic</code> spec to update
                        </li>
                      </ol>
                    </Text>
                  </Callout.Root>
                )}
                {engine === reactEngine && (
                  <Callout.Root
                    size="1"
                    color="purple"
                    className={styles.notices}
                  >
                    <Callout.Icon>
                      <SparkleIcon size={16} />
                    </Callout.Icon>
                    <Callout.Text>
                      To create magic components, just start using them by
                      adding{" "}
                      <code style={{ fontWeight: 500, color: `var(--sky-11)` }}>
                        &lt;Magic.YourComponentName... /&gt;
                      </code>{" "}
                      somewhere in your code. Update them by changing their
                      spec.
                    </Callout.Text>
                  </Callout.Root>
                )}
              </div>
              {selectedPath?.endsWith(".md") && (
                <MagicEditor
                  key={selectedPath}
                  className={styles.specEditor}
                  defaultSpec={draftCodebase?.files[selectedPath] || ""}
                  onUpdateSpec={(content) => {
                    setDraftCodebase((codebase) => ({
                      ...codebase,
                      files: {
                        ...codebase.files,
                        [selectedPath]: content,
                      },
                    }));
                    setDirty(true);
                  }}
                />
              )}
              {!selectedPath?.endsWith(".md") && (
                <MonacoEditor
                  key={selectedPath}
                  path={selectedPath}
                  className={styles.codeEditor}
                  defaultValue={draftCodebase?.files[selectedPath] || ""}
                  allFiles={augmentedDraftCodebase?.files}
                  readOnly={
                    !selectedPath ||
                    selectedPath.endsWith(".magic.tsx") ||
                    (selectedPath.startsWith("magic/") &&
                      selectedPath.endsWith(".py"))
                  }
                  onChange={(content) => {
                    setDraftCodebase((codebase) => ({
                      ...codebase,
                      files: {
                        ...codebase.files,
                        [selectedPath]: content,
                      },
                    }));
                    setDirty(true);
                  }}
                />
              )}
              <engine.PreviewHost
                selectedPath={selectedPath}
                className={styles.preview}
                codebase={augmentedCodebase}
              />
            </>
          )}
          {emptyState && (
            <Flex
              style={{
                flex: 1,
                gridArea: "1 / 1 / -1 / -1",
                margin: "auto 0",
              }}
              direction="row"
              gap="4"
              align="stretch"
              justify="center"
            >
              <EmptyStateCard
                onClick={() =>
                  setCodebase(structuredClone(pythonEngine.starterCodebase))
                }
                icon={AntDesignPythonIcon}
                title="Try with Python"
                description="Create a new Python CLI program using magic modules. Also supports verifications."
              />
              <EmptyStateCard
                onClick={() =>
                  setCodebase(structuredClone(reactEngine.starterCodebase))
                }
                icon={ReactIcon}
                title="Try with React"
                description="Create a new mini React app using magic modules."
              />
            </Flex>
          )}
        </div>
      </div>
    </ContextWrapper>
  );
}

function EmptyStateCard({
  onClick,
  icon,
  title,
  description,
}: {
  onClick: () => void;
  icon: React.ComponentType<LucideProps>;
  title: string;
  description: string;
}) {
  const Icon = icon;
  return (
    <Card size="3" style={{ maxWidth: 240 }} asChild>
      <button onClick={onClick}>
        <Flex direction="column" style={{ height: "100%" }}>
          <Icon size={36} />
          <Text mt="4" size="3" weight="medium">
            {title}
          </Text>
          <Text mt="2" size="1" color="gray">
            {description}
          </Text>
        </Flex>
      </button>
    </Card>
  );
}
