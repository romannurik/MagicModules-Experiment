/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGeminiApi } from "@/ai";
import { Codebase } from "@/document/DocumentProvider";
import { Callout, Spinner } from "@radix-ui/themes";
import cn from "classnames";
import { AlertCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./MiniAppHost.module.scss";
import { compileMiniApp } from "./compiler";
import { AppToHostMessage, HostToAppMessage } from "./host-protocol";

export function MiniAppHost({
  codebase,
  className,
}: {
  codebase: Codebase;
  selectedPath?: string;
  className?: string;
}) {
  let [iframe, setIframe] = useState<HTMLIFrameElement>();
  let [compiledAppHtml, setCompiledAppHtml] = useState("");
  let [compiling, setCompiling] = useState(true);
  let [error, setError] = useState("");
  let ref = useRef<HTMLDivElement>(null);
  let ai = useGeminiApi();

  // compile app
  useEffect(() => {
    setError("");
    setCompiledAppHtml("");
    if (!codebase) return;
    let cancel = false;
    setCompiling(true);
    (async () => {
      try {
        let appHtml = await compileMiniApp(codebase);
        !cancel && setCompiledAppHtml(appHtml);
      } catch (e) {
        !cancel && setError(String((e as any)?.message || e));
      }
      setCompiling(false);
    })();
    return () => {
      cancel = true;
    };
  }, [codebase]);

  // host protocol implementation (over IFRAME messages)
  useEffect(() => {
    if (!iframe) return;
    let abort = new AbortController();

    let postMessage = (msg: HostToAppMessage) => {
      iframe.contentWindow?.postMessage(msg, "*");
    };

    window.addEventListener(
      "message",
      async (e) => {
        if ((e as MessageEvent).source !== iframe.contentWindow) return;
        try {
          let data = (e as MessageEvent).data as AppToHostMessage;
          switch (data.type) {
            case "aiGenerateContent": {
              let { requestId } = data || {};
              try {
                let stream = await ai.models.generateContentStream({
                  ...data.gcr,
                  model: "gemini-3-flash-preview",
                });
                for await (let chunk of stream) {
                  if (!chunk.text) continue;
                  postMessage({
                    type: "aiGenerateContentResponse",
                    requestId: data.requestId,
                    chunk: chunk.text,
                  });
                }
              } catch (e) {
                console.warn(e);
                postMessage({
                  type: "aiGenerateContentResponse",
                  requestId: data.requestId,
                  error: String((e as any)?.message || e),
                });
              } finally {
                postMessage({
                  type: "aiGenerateContentResponse",
                  requestId,
                  done: true,
                });
              }
              break;
            }
          }
        } catch (e) {
          console.warn("Could not handle miniapp message", e);
        }
      },
      abort,
    );
    return () => abort.abort();
  }, [ai, iframe]);

  return (
    <div ref={ref} className={cn(styles.viewer, className)}>
      {compiling && <Spinner className={styles.spinner} />}
      {!compiling && (
        <>
          {error && (
            <Callout.Root color="red" size="1" variant="soft" m="2">
              <Callout.Icon>
                <AlertCircleIcon size={16} />
              </Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}
          {compiledAppHtml && (
            <iframe
              ref={(node) => setIframe(node || undefined)}
              srcDoc={compiledAppHtml}
            />
          )}
        </>
      )}
    </div>
  );
}
