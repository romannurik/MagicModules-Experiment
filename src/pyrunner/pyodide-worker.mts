/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import path from "path";
import { loadPyodide, PyodideAPI } from "pyodide";

export type PyodideWorkerInputMessage =
  | {
      type: "run";
      codebase: Codebase;
      code: string;
      stdinBlock: Int32Array; // because Pyodide doesn't support async stdin
    }
  | {
      type: "abort";
    }
  | {
      type: "stdin";
      buffer: Uint8Array;
    };

export type PyodideWorkerOutputMessage =
  | { type: "loaded" }
  | {
      type: "stdout";
      buffer: Uint8Array;
    }
  | {
      type: "stderr";
      buffer: Uint8Array;
    }
  | {
      type: "done";
      result: any;
    }
  | {
      type: "error";
      errorType: string;
      details: string;
    };

const pyodide = await loadPyodide({
  indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/",
});

post({ type: "loaded" });

let currentAbort = new AbortController();
let stdinBuffer: Uint8Array[] = [];
let resetScript = "";

self.onmessage = async (ev) => {
  let msg = ev.data as PyodideWorkerInputMessage;
  if (msg.type === "abort") {
    currentAbort.abort();
    currentAbort = new AbortController();
    return;
  }

  if (msg.type === "stdin") {
    stdinBuffer.push(msg.buffer);
    return;
  }

  if (msg.type === "run") {
    console.log("running");
    stdinBuffer = [];
    currentAbort.abort();
    let abort = (currentAbort = new AbortController());
    let { codebase, code, stdinBlock } = msg;
    if (!code) {
      post({
        type: "stderr",
        buffer: new TextEncoder().encode("No source to run"),
      });
      return;
    }
    try {
      let mountDir = "/home/pyodide/project";
      pyodide.FS.mkdirTree(mountDir);
      pyodide.FS.mount(pyodide.FS.filesystems.MEMFS, {}, mountDir);
      pyodide.FS.chdir(mountDir);
      let localModules: string[] = [];
      let localModuleSources: Record<string, string> = {};
      for (let [file, content] of Object.entries(codebase?.files || {})) {
        pyodide.FS.mkdirTree(path.dirname(file));
        pyodide.FS.writeFile(file, content);
        if (file.endsWith(".py")) {
          localModules.push(file.replace(/\.py$/, ""));
          localModuleSources[file.replace(/\.py$/, "")] = content;
        }
      }
      abort.signal.addEventListener("abort", () => {
        // pyodide.setStdin();
        pyodide.FS.unmount(mountDir);
        resetScript = [
          `
import sys
def deleteModule(name: str):
  try:
    del sys.modules[name]
  except KeyboardInterrupt:
    print("keyboard interrupt")
    deleteModule(name)
  except: pass
          `.trim(),
          ...localModules.map(
            (n) => `deleteModule('${n.replace(/\//g, ".")}')`,
          ),
        ].join("\n");
      });
      let stdoutBuffer: Uint8Array = new Uint8Array();
      let stdoutPostTimeout: NodeJS.Timeout | undefined;
      let flushStdout = () => {
        post({
          type: "stdout",
          buffer: stdoutBuffer,
        });
        stdoutBuffer = new Uint8Array();
      };
      pyodide.setStdin({
        stdin() {
          // this is so gross, pyodide stdin handling can't be this broken, can it?!
          if (currentAbort.signal.aborted) {
            Atomics.store(stdinBlock, 0, 0);
            return undefined;
          }
          let data = stdinBuffer.shift();
          if (data) return data;
          flushStdout(); // flush stdout before blocking thread
          let waitResult = Atomics.wait(stdinBlock, 0, stdinBlock[0]);
          if (waitResult !== "ok")
            throw new Error(
              "Atomic/synchronous wait failed with " + waitResult,
            );
          if (stdinBlock[0] === 2) {
            // sigint
            abort.abort();
            return undefined;
          }
          if (stdinBlock[0] === 13) {
            return new Uint8Array([10, 10]);
          }
          if (stdinBlock[3]) {
            return new Uint8Array([
              stdinBlock[0],
              stdinBlock[1],
              stdinBlock[2],
              stdinBlock[3],
            ]);
          } else if (stdinBlock[2]) {
            return new Uint8Array([
              stdinBlock[0],
              stdinBlock[1],
              stdinBlock[2],
            ]);
          } else if (stdinBlock[1]) {
            return new Uint8Array([stdinBlock[0], stdinBlock[1]]);
          } else {
            return new Uint8Array([stdinBlock[0]]);
          }
        },
        autoEOF: true,
        isatty: true,
      });
      let writer: Parameters<PyodideAPI["setStdout"]>[0] = {
        write(buffer) {
          if (abort.signal.aborted) return 0;
          stdoutBuffer = new Uint8Array([...stdoutBuffer, ...buffer]);
          clearTimeout(stdoutPostTimeout);
          stdoutPostTimeout = setTimeout(() => flushStdout());
          return buffer.length;
        },
        isatty: true,
      };
      pyodide.setStdout(writer);
      pyodide.setStderr(writer);
      pyodide.setInterruptBuffer(stdinBlock);
      let imports = Array.from<string>(
        pyodide.runPython(
          `import pyodide\npyodide.code.find_imports(${JSON.stringify(
            [code, ...Object.values(localModuleSources)].join("\n\n"),
          )})`,
        ),
      ).filter((i) => !i.startsWith("magic"));
      await pyodide.loadPackage("micropip", {
        messageCallback: () => {}, // quiet
      });
      const micropip = pyodide.pyimport("micropip");
      for (let imp of imports) {
        try {
          await micropip.install(imp);
        } catch (e) {
          console.warn(
            `Tried to load ${imp}, but failed with: ${String(e)
              .split(/\n/g)
              .filter((l) => l.trim())
              .at(-1)}`,
          );
        }
      }
      resetScript && pyodide.runPython(resetScript);
      let result = await pyodide.runPythonAsync(code);
      if (abort.signal.aborted) return;
      post({
        type: "done",
        result,
      });
    } catch (e) {
      if (abort.signal.aborted) return;
      post({
        type: "error",
        errorType: (e as any).type,
        details: String(e),
      });
    }
  }
};

function post(message: PyodideWorkerOutputMessage) {
  postMessage(message);
}
