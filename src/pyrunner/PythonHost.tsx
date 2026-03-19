/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { PythonEngineContext } from "@/engines/py/py-engine";
import { Terminal } from "@/terminal/Terminal";
import { Callout, Spinner, Text } from "@radix-ui/themes";
import { Terminal as Xterm } from "@xterm/xterm";
import cn from "classnames";
import { toPng } from "html-to-image";
import { AlertCircleIcon } from "lucide-react";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import styles from "./PythonHost.module.scss";
import {
  PyodideWorkerInputMessage,
  PyodideWorkerOutputMessage,
} from "./pyodide-worker.mts";
import PyodideWorker from "./pyodide-worker?worker";

type Props = {
  className?: string;
  selectedPath?: string;
  codebase: Codebase;
  onResult?: (result: JobResult) => void;
};

export type PythonHostRef = {
  runCode: (code: string) => {
    result: Promise<JobResult>;
    started: Promise<void>;
  };
  sendKeys: (keys: string) => Promise<void>;
  screenshotTerminal: () => Promise<string>;
  captureTerminalBuffer: () => string;
};

type Job = {
  pyodideWorker: InstanceType<typeof PyodideWorker>;
  stdinBlock: Int32Array;
  bus: EventTarget;
  codebase: Codebase;
  code: string;
};

export type JobResult =
  | { ok: true; result: any; buffer: string }
  | {
      ok: false;
      error: string;
      details?: string;
    };

export const PythonHost = ({ className, selectedPath, codebase, onResult }: Props) => {
  let { pythonHostRef } = useContext(PythonEngineContext);
  let [term, setTerm] = useState<Xterm>();
  let termRef = useRef<Xterm>();
  termRef.current = term;

  let codeToRun = selectedPath?.endsWith(".py")
    ? codebase.files[selectedPath]
    : undefined;

  let [error, setError] = useState<string>();
  let [runtimeLoaded, setRuntimeLoaded] = useState(false);
  let [job, setJob] = useState<Job>();

  const startJob = (
    code?: string,
    codebase?: Codebase,
  ): { result: Promise<JobResult>; started: Promise<void> } => {
    if (!code) {
      setJob(undefined);
      return {
        result: Promise.resolve({ ok: false, error: "BlankJob" }),
        started: Promise.resolve(),
      };
    }
    let bus = new EventTarget();
    setJob({
      pyodideWorker: new PyodideWorker(),
      stdinBlock: new Int32Array(new SharedArrayBuffer(16)),
      bus,
      codebase: codebase || { files: {} },
      code,
    });

    let startPromise = new Promise<void>((resolve) => {
      bus.addEventListener("started", () => resolve());
    });

    let resultPromise = new Promise<JobResult>((resolve) => {
      bus.addEventListener("done", async (ev) => {
        await new Promise((resolve) => setTimeout(resolve));
        let buffer = captureTerminalBuffer(termRef.current!);
        resolve({
          ok: true,
          result: (ev as CustomEvent).detail,
          buffer,
        });
      });
      bus.addEventListener("error", (ev) => {
        let { errorType, details } = (ev as CustomEvent).detail;
        resolve({
          ok: false,
          error: errorType,
          details,
        });
      });
      bus.addEventListener("terminate", () =>
        // only takes effect if no other event comes first
        resolve({ ok: false, error: "Terminated" }),
      );
    });

    return {
      result: resultPromise,
      started: startPromise,
    };
  };

  useEffect(() => {
    let aborted = false;
    startJob(codeToRun || codebase?.files["app.py"], codebase).result.then(
      (result) => !aborted && onResult?.(result),
    );
    return () => void (aborted = true);
  }, [codeToRun, codebase]);

  useImperativeHandle(
    pythonHostRef,
    () => ({
      runCode: (code: string) => startJob(code, codebase),
      sendKeys: async (keys: string) => {
        if (!job) throw new Error("No running job");
        console.log("sending keys", keys);
        for (let c of keys) {
          sendKeyToStdin(job, c);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      },
      screenshotTerminal: () => screenshotTerminal(termRef.current!),
      captureTerminalBuffer: () => captureTerminalBuffer(termRef.current!),
    }),
    [codebase, job],
  );

  const sendKeyToStdin = (job: Job, data: string) => {
    if (!job) return;
    termRef.current?.write(data);
    if (data.charAt(0) === "\r") {
      termRef.current?.write("\n");
    }
    const { stdinBlock, pyodideWorker } = job;
    Atomics.store(stdinBlock, 0, data.charCodeAt(0)); // store the data
    Atomics.store(stdinBlock, 1, data.charCodeAt(1) || 0);
    Atomics.store(stdinBlock, 2, data.charCodeAt(2) || 0);
    Atomics.store(stdinBlock, 3, data.charCodeAt(3) || 0);
    Atomics.notify(stdinBlock, 0); // unblock any stdin
    pyodideWorker.postMessage({
      type: "stdin",
      buffer: new TextEncoder().encode(data),
    });
  };

  useEffect(() => {
    setRuntimeLoaded(false);
    setError(undefined);
    if (!term || !job) return; // must wait for terminal
    console.log("starting job");

    // job is ready
    let abort = new AbortController();
    const { bus, pyodideWorker, stdinBlock, code, codebase } = job;

    pyodideWorker.addEventListener(
      "message",
      (ev) => {
        if (abort.signal.aborted) return;
        let msg = ev.data as PyodideWorkerOutputMessage;
        if (msg.type === "loaded") {
          term.reset();
          bus.dispatchEvent(new CustomEvent("started"));
          pyodideWorker.postMessage({
            type: "run",
            codebase,
            code,
            stdinBlock,
          } satisfies PyodideWorkerInputMessage);
          setRuntimeLoaded(true);
        } else if (msg.type === "stdout" || msg.type === "stderr") {
          termRef.current?.write(new TextDecoder().decode(msg.buffer));
        } else if (msg.type === "done") {
          msg.result !== undefined &&
            termRef.current?.write(JSON.stringify(msg.result, null, 2));
          bus.dispatchEvent(new CustomEvent("done", { detail: msg.result }));
        } else if (msg.type === "error") {
          if (msg.errorType === "KeyboardInterrupt") return;
          setError(msg.errorType + ": " + msg.details);
          bus.dispatchEvent(
            new CustomEvent("error", {
              detail: msg,
            }),
          );
        }
      },
      abort,
    );
    abort.signal.addEventListener("abort", () => {
      pyodideWorker.postMessage({ type: "abort" });
      pyodideWorker.terminate();
      bus.dispatchEvent(new CustomEvent("terminate"));
    });

    let dataListener = term.onData(async (data) => {
      await new Promise((resolve) => setTimeout(resolve));
      sendKeyToStdin(job, data);
      setError(undefined);
    });
    abort.signal.addEventListener("abort", () => dataListener.dispose());

    Atomics.store(stdinBlock, 0, 0); // init stdin block
    abort.signal.addEventListener("abort", () => {
      // no longer necessary since 1 worker is responsible for 1 job
      Atomics.store(stdinBlock, 0, 2 /* SIGINT */);
      Atomics.notify(stdinBlock, 0); // unblock any stdin
    });
    return () => abort.abort();
  }, [job, term]);

  return (
    <div
      className={cn(
        styles.pythonHost,
        { [styles.isLoading]: !runtimeLoaded },
        className,
      )}
    >
      {!runtimeLoaded && (
        <div className={styles.loading}>
          <Spinner size="3" />
          <Text color="gray" size="1">
            {job ? "Preparing Python environment" : "Waiting for job"}
          </Text>
        </div>
      )}
      <Terminal className={styles.terminal} onTerm={(term) => setTerm(term)} />
      {runtimeLoaded && (
        <>
          {error && (
            <Callout.Root color="red">
              <Callout.Icon>
                <AlertCircleIcon size={16} />
              </Callout.Icon>
              <pre>{error}</pre>
            </Callout.Root>
          )}
        </>
      )}
    </div>
  );
};

async function screenshotTerminal(term: Xterm): Promise<string> {
  return await toPng(term.element!, {
    width: term.element!.offsetWidth,
    height: term.element!.offsetHeight,
    canvasWidth: term.element!.offsetWidth,
    canvasHeight: term.element!.offsetHeight,
    pixelRatio: 1,
  });
}

function captureTerminalBuffer(term: Xterm): string {
  let l: string[] = [];
  for (let i = 0; i < term.buffer.active.length; i++) {
    l.push(term.buffer.active.getLine(i)!.translateToString().trimEnd());
  }
  while (l.at(-1)?.trim() === "") {
    l.pop();
  }
  return l.join("\n");
}
