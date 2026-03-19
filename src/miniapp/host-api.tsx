/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Note: This file gets compiled into the mini app bundle, so runs inside
// the mini-app IFRAME

import { createContext, PropsWithChildren, useEffect, useMemo } from "react";
import { AppToHostMessage, HostToAppMessage } from "./host-protocol";
import * as HostApi from "./host-types";

type MiniAppContext = {};

export const MiniAppContext = createContext<MiniAppContext>({} as any);

let postMessage = (msg: AppToHostMessage) =>
  window.parent.postMessage(msg, "*");

export function MiniAppWrapper({ children }: PropsWithChildren) {
  useEffect(() => {
    window.addEventListener("mousemove", (e) => {
      postMessage({
        type: "mouseMove",
        x: e.clientX,
        y: e.clientY,
      });
    });
    window.addEventListener("message", (e) => {
      try {
        let data = e.data as HostToAppMessage;
        switch (data.type) {
        }
      } catch (e) {
        console.warn("Could not handle host message", e);
      }
    });
  }, []);

  let contextValue: MiniAppContext = useMemo(() => ({}), []);

  return (
    <MiniAppContext.Provider value={contextValue}>
      {children}
    </MiniAppContext.Provider>
  );
}

export const generateContentStream: HostApi.generateContentStream = (
  messages
) => {
  let requestId = crypto.randomUUID();

  let nextMsgResolve: (_: void) => void;
  let nextMsgPromise = new Promise((res) => void (nextMsgResolve = res));
  let msgs: Array<
    Extract<HostToAppMessage, { type: "aiGenerateContentResponse" }>
  > = [];
  let abort = new AbortController();
  window.addEventListener(
    "message",
    (e) => {
      let msg = e.data as HostToAppMessage;
      if (
        msg?.type !== "aiGenerateContentResponse" ||
        msg.requestId !== requestId
      ) {
        return;
      }
      msgs.push(msg);
      nextMsgResolve();
      nextMsgPromise = new Promise((res) => void (nextMsgResolve = res));
      if ("error" in msg || "done" in msg) {
        // stop listening
        abort.abort();
      }
    },
    abort
  );

  postMessage({
    type: "aiGenerateContent",
    requestId,
    gcr: {
      model: "gemini-3-flash-preview",
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      })),
    },
  });

  return {
    [Symbol.asyncIterator]: () => {
      let nextIndex = 0;
      return {
        next: async () => {
          if (msgs.length <= nextIndex) {
            await nextMsgPromise;
          }
          let msg = msgs[nextIndex++];
          if ("error" in msg) {
            throw new Error(msg.error);
          } else if ("done" in msg) {
            return {
              done: true,
              value: undefined,
            };
          }
          return {
            done: false,
            value: msg.chunk,
          };
        },
      };
    },
  } satisfies AsyncIterable<string>;
};
