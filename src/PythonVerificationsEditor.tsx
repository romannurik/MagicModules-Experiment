/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDocumentContext } from "@/document/DocumentProvider";
import {
  Badge,
  Button,
  Code,
  DropdownMenu,
  IconButton,
  Spinner,
  TextArea,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import cn from "classnames";
import {
  CheckIcon,
  InfinityIcon,
  ListChecksIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { AgentSession } from "./agent/AgentSession";
import { useGeminiApi } from "./ai";
import { MonacoEditor } from "./code-editor/MonacoEditor";
import { CodeDiffPre } from "./components/CodeDiffPre";
import { PythonEngineContext } from "./engines/py/py-engine";
import { MagicEditorSectionBar, Verification } from "./MagicEditor";
import styles from "./MagicEditor.module.scss";
import {
  makePythonTesterAgent,
  PythonAgentContext,
} from "./pyrunner/python-tester-agent";
import { JobResult } from "./pyrunner/PythonHost";
import {
  generateAgenticVerification,
  generateStaticVerification,
} from "./verification-generator";

export function PythonVerificationsEditor({
  verifications,
  onEditVerifications,
}: {
  verifications: Verification[];
  onEditVerifications: (verifications: Verification[]) => void;
}) {
  const { codebase } = useDocumentContext();
  const ai = useGeminiApi();
  const { pythonHostRef } = useContext(PythonEngineContext);

  // verification management (stored in frontmatter)
  const [runningVerification, setRunningVerification] = useState<{
    verification: Verification;
    started: boolean;
    result?:
      | JobResult
      | {
          ok: false;
          error: string;
          unexpectedOutput: true;
          expected: string;
          actual: string;
        };
  }>();
  const [editingVerification, setEditingVerification] =
    useState<Verification>();
  const [draftVerification, setDraftVerification] = useState<Verification>();
  const isEditingNewVerification =
    editingVerification === draftVerification &&
    draftVerification !== undefined;

  const [verificationGenerateKey, setVerificationGenerateKey] = useState(0);
  const [verificationGenerating, setVerificationGenerating] = useState(false);

  const newVerification = (type: Verification["type"]) => {
    let ver: Verification;
    if (type === "static") {
      ver = {
        type,
        title: "",
        pythonCodeHarness: "",
        expectedOutput: "",
      };
    } else {
      ver = {
        type,
        title: "",
        pythonCodeHarness: "",
        prompt: "",
      };
    }
    onEditVerifications([...verifications, ver]);
    setEditingVerification(ver);
    setDraftVerification(ver);
  };

  // actually running verifiers

  const startVerification = async (
    verification: Verification,
    { containerToScrollIntoView }: { containerToScrollIntoView?: Element } = {},
  ) => {
    if (!pythonHostRef.current) {
      console.error("No python host");
      return;
    }

    let scroll = () =>
      setTimeout(() =>
        containerToScrollIntoView?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
    let { started, result } = pythonHostRef.current.runCode(
      verification.pythonCodeHarness,
    );
    setRunningVerification({ verification, started: false });
    scroll();
    await started;
    setRunningVerification({ verification, started: true });
    scroll();
    result.then((result) => {
      if (verification.type === "static") {
        console.log(result, verification.expectedOutput);
        if (
          result.ok &&
          result.buffer.trimEnd() === verification.expectedOutput.trimEnd()
        ) {
          setRunningVerification({ verification, started: true, result });
        } else if (result.ok) {
          setRunningVerification({
            verification,
            started: true,
            result: {
              ok: false,
              error: "Output didn't match",
              unexpectedOutput: true,
              expected: verification.expectedOutput,
              actual: result.buffer,
            },
          });
        } else {
          setRunningVerification({ verification, started: true, result });
        }
        scroll();
      }
    });
  };

  const pythonTesterAgent = useMemo(() => makePythonTesterAgent(ai), [ai]);

  const pythonTesterAgentContext: PythonAgentContext = useMemo(
    () => ({
      codebase,
      pythonHostRef,
      reportResult: (success: boolean, result: string) => {
        setRunningVerification((rv) => ({
          ...rv!,
          result: success
            ? {
                ok: true,
                buffer: "",
                result: result,
              }
            : {
                ok: false,
                error: "Failed",
                details: result,
              },
        }));
      },
    }),
    [codebase, pythonHostRef],
  );

  return (
    <>
      <MagicEditorSectionBar title="Verifications">
        <DropdownMenu.Root>
          <Tooltip content="Add verification">
            <DropdownMenu.Trigger>
              <IconButton variant="soft" radius="full" size="1">
                <PlusIcon size={16} />
              </IconButton>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Content variant="soft">
            <DropdownMenu.Item
              className={styles.dropdownItemWithDetail}
              onClick={() => newVerification("agentic")}
            >
              <InfinityIcon className={styles.dropdownItemIcon} size={16} />
              <div>
                Agentic
                <div className={styles.dropdownItemDetail}>
                  Gemini will run the module in a terminal, trying to achieve a
                  specific objective
                </div>
              </div>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.dropdownItemWithDetail}
              onClick={() => newVerification("static")}
            >
              <ListChecksIcon className={styles.dropdownItemIcon} size={16} />
              <div>
                Static
                <div className={styles.dropdownItemDetail}>
                  Runs the module and sees if it returns the expected output
                  (like a unit test)
                </div>
              </div>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </MagicEditorSectionBar>
      <div className={styles.verifications}>
        {verifications.map((verification, i) => (
          <div
            key={i}
            className={cn(styles.verification, {
              [styles.isEditing]: editingVerification === verification,
              [styles.isRunning]:
                runningVerification?.verification === verification,
            })}
          >
            {verification.type === "agentic" ? (
              <Tooltip side="bottom" content="Tested by Gemini">
                <InfinityIcon size={20} className={styles.icon} />
              </Tooltip>
            ) : (
              <Tooltip side="bottom" content="Statically tested">
                <ListChecksIcon size={20} className={styles.icon} />
              </Tooltip>
            )}
            {editingVerification === verification && (
              <TextField.Root
                className={cn(styles.title, styles.verificationTitleEditor)}
                value={draftVerification!.title}
                placeholder="What are you verifying?"
                onChange={(e) =>
                  setDraftVerification({
                    ...draftVerification!,
                    title: e.target.value,
                  })
                }
              />
            )}
            {editingVerification !== verification && (
              <h3 className={styles.title}>
                {verification.title || (
                  <span style={{ color: "var(--gray-9)" }}>(No title)</span>
                )}
                {runningVerification?.verification === verification && (
                  <>
                    {!runningVerification.started ? (
                      <Badge className={styles.verificationStatus} color="gray">
                        <Spinner size="2" />
                        Starting up
                      </Badge>
                    ) : !runningVerification.result ? (
                      <Badge className={styles.verificationStatus} color="blue">
                        <Spinner size="2" />
                        Running
                      </Badge>
                    ) : runningVerification.result.ok ? (
                      <Badge
                        className={styles.verificationStatus}
                        color="green"
                      >
                        <CheckIcon size={16} />
                        Passed
                      </Badge>
                    ) : (
                      <Badge className={styles.verificationStatus} color="red">
                        <XIcon size={16} />
                        {runningVerification.result?.error}
                      </Badge>
                    )}
                  </>
                )}
              </h3>
            )}
            {editingVerification !== verification && (
              <div className={styles.actions}>
                {runningVerification?.verification !== verification && (
                  <>
                    <IconButton
                      variant="ghost"
                      radius="full"
                      color="gray"
                      size="2"
                      onClick={(ev) => {
                        setEditingVerification(verification);
                        setDraftVerification(structuredClone(verification));
                        if (
                          runningVerification?.verification === verification
                        ) {
                          setRunningVerification(undefined);
                        }
                        let containerNode = ev.currentTarget.closest(
                          "." + styles.verification,
                        );
                        setTimeout(() => {
                          containerNode?.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        });
                      }}
                    >
                      <PencilIcon size={16} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      radius="full"
                      color="gray"
                      size="2"
                      onClick={() => {
                        onEditVerifications(
                          verifications.filter((v) => v !== verification),
                        );
                      }}
                    >
                      <TrashIcon size={16} />
                    </IconButton>
                    <Button
                      variant="soft"
                      onClick={(ev) => {
                        let containerToScrollIntoView =
                          ev.currentTarget.closest("." + styles.verification) ||
                          undefined;
                        startVerification(verification, {
                          containerToScrollIntoView,
                        });
                      }}
                    >
                      <PlayIcon size={16} />
                      Run
                    </Button>
                  </>
                )}
                {runningVerification?.verification === verification && (
                  <Button
                    variant="soft"
                    color={runningVerification.result ? "gray" : "red"}
                    onClick={() => setRunningVerification(undefined)}
                  >
                    <XIcon size={16} />
                    {runningVerification.result ? "Close" : "Stop"}
                  </Button>
                )}
              </div>
            )}
            {editingVerification === verification && (
              <div
                className={cn(
                  styles.verificationDetail,
                  styles.verificationEditor,
                )}
              >
                <label onClick={(ev) => ev.preventDefault()}>
                  <span>Code to run (test harness)</span>
                  <div style={{ position: "relative" }}>
                    <MonacoEditor
                      key={verificationGenerateKey}
                      fitHeight
                      className={styles.verificationCodeEditor}
                      path="_harness.py"
                      defaultValue={draftVerification!.pythonCodeHarness}
                      onChange={(content) => {
                        setDraftVerification({
                          ...draftVerification!,
                          pythonCodeHarness: content || "",
                        });
                      }}
                    />
                    {!draftVerification?.pythonCodeHarness &&
                      !!draftVerification?.title && (
                        <Button
                          disabled={verificationGenerating}
                          loading={verificationGenerating}
                          className={styles.autoGenButton}
                          variant="ghost"
                          onClick={async () => {
                            setVerificationGenerating(true);
                            try {
                              const { pythonCodeHarness } = await (
                                draftVerification.type === "agentic"
                                  ? generateAgenticVerification
                                  : generateStaticVerification
                              )(ai, {
                                verificationTitle: draftVerification.title,
                                codebase,
                              });
                              setVerificationGenerateKey((k) => k + 1);
                              setDraftVerification({
                                ...draftVerification!,
                                pythonCodeHarness,
                              });
                              await new Promise((resolve) =>
                                setTimeout(resolve, 2000),
                              );
                            } finally {
                              setVerificationGenerating(false);
                            }
                          }}
                        >
                          <SparklesIcon size={16} />
                          Generate harness
                        </Button>
                      )}
                  </div>
                </label>
                {draftVerification?.type === "agentic" && (
                  <label>
                    <span>Objective</span>
                    <TextArea
                      placeholder={draftVerification.title}
                      className={styles.verificationPrompt}
                      value={draftVerification!.prompt}
                      onChange={(e) => {
                        setDraftVerification({
                          ...draftVerification!,
                          prompt: e.target.value,
                        });
                      }}
                    />
                  </label>
                )}
                {draftVerification?.type === "static" && (
                  <label onClick={(ev) => ev.preventDefault()}>
                    <span>
                      Expected output (<Code>stdout</Code> and{" "}
                      <Code>stderr</Code>)
                    </span>
                    <MonacoEditor
                      fitHeight
                      className={styles.verificationCodeEditor}
                      path="_output.txt"
                      defaultValue={draftVerification!.expectedOutput}
                      onChange={(content) => {
                        setDraftVerification({
                          ...draftVerification!,
                          expectedOutput: content || "",
                        });
                      }}
                    />
                  </label>
                )}
                <div className={styles.editActions}>
                  <Button
                    variant="soft"
                    color="gray"
                    onClick={() => {
                      setEditingVerification(undefined);
                      setDraftVerification(undefined);
                      if (isEditingNewVerification) {
                        onEditVerifications(
                          verifications.filter((v) => v !== draftVerification),
                        );
                      }
                    }}
                  >
                    Discard changes
                  </Button>
                  <Button
                    variant="solid"
                    onClick={() => {
                      onEditVerifications(
                        verifications.map((v) =>
                          v === editingVerification ? draftVerification! : v,
                        ),
                      );
                      setEditingVerification(undefined);
                      setDraftVerification(undefined);
                    }}
                  >
                    <CheckIcon size={16} />
                    Save
                  </Button>
                </div>
              </div>
            )}
            {runningVerification?.verification === verification &&
              verification.type === "agentic" && (
                <AgentSession
                  className={cn(styles.verificationDetail, styles.agentSession)}
                  agent={pythonTesterAgent}
                  agentContext={pythonTesterAgentContext}
                  forcePrompt={verification.prompt || verification.title}
                />
              )}
            {runningVerification?.verification === verification &&
              verification.type === "static" &&
              runningVerification.result &&
              !runningVerification.result.ok && (
                <div className={styles.verificationDetail}>
                  {"unexpectedOutput" in runningVerification.result ? (
                    <CodeDiffPre
                      filename={verification.title}
                      before={runningVerification.result.expected}
                      after={runningVerification.result.actual}
                    />
                  ) : (
                    <pre>{runningVerification.result.details}</pre>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>
    </>
  );
}
