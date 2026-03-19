/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeGeminiAgent } from "@/agent/base-gemini-agent";
import { makeTool } from "@/ai/tools";
import { KeyboardSequence } from "@/components/KeyboardSequence";
import { Codebase } from "@/document/DocumentProvider";
import {
  CameraIcon,
  CheckIcon,
  EyeIcon,
  KeyboardIcon,
  XIcon,
} from "lucide-react";
import z from "zod";
import { PythonHostRef } from "./PythonHost";
import { GoogleGenAI } from "@google/genai";

export type PythonAgentContext = {
  codebase: Codebase;
  pythonHostRef: { current: PythonHostRef | null };
  reportResult: (success: boolean, result: string) => void;
};

export const getTerminalContentTool = makeTool({
  name: "get_terminal_content",
  description: "Get the visible content of the terminal",
  displayName: "Look",
  icon: EyeIcon,
  parameters: z.object({}),
  async run({}, { context }: { context: PythonAgentContext }) {
    if (!context.pythonHostRef.current) {
      throw new Error("Test must fail because harness isn't ready");
    }
    let text = context.pythonHostRef.current.captureTerminalBuffer();
    return { output: text };
  },
  renderBody: (_, output) => <pre style={{ overflow: "auto" }}>{output}</pre>,
});

export const screenshotTool = makeTool({
  name: "screenshot",
  description: "Take a screenshot of the terminal",
  displayName: "Screenshot",
  icon: CameraIcon,
  parameters: z.object({}),
  async run({}, { context }: { context: PythonAgentContext }) {
    if (!context.pythonHostRef.current) {
      throw new Error("Test must fail because harness isn't ready");
    }
    let dataUrl = await context.pythonHostRef.current.screenshotTerminal();
    return {
      metadata: {
        dataUrl,
      },
      parts: [
        {
          inlineData: {
            mimeType: "image/png",
            data: dataUrl.replace("data:image/png;base64,", ""),
          },
        },
      ],
    };
  },
  renderBody: (_, __, metadata) =>
    metadata ? (
      <img
        src={metadata.dataUrl}
        style={{
          height: 200,
          width: "auto",
          maxWidth: "100%",
          objectFit: "contain",
        }}
        alt="screenshot"
      />
    ) : (
      "N/A"
    ),
});

export const sendKeysTool = makeTool({
  name: "send_keys",
  description: "Send one or more keys to the terminal",
  displayName: "Keyboard",
  icon: KeyboardIcon,
  parameters: z.object({
    keys: z
      .string()
      .describe(
        "The key(s) to send to the terminal, e.g. 'a' or '\\n' for enter. Multiple keys can be sent by sending a string such as 'hello\\nworld\\n'.",
      ),
  }),
  renderSummaryLine: ({ keys }: { keys: string }) => (
    <KeyboardSequence keys={keys} />
  ),
  renderBody: () => null,
  async run({ keys }, { context }: { context: PythonAgentContext }) {
    if (!context.pythonHostRef.current) {
      throw new Error("Test must fail because harness isn't ready");
    }
    keys = keys.replace(/\\n|\\10|\\13/g, "\n");
    await context.pythonHostRef.current.sendKeys(keys);
    return "Sent";
  },
});

export const reportResultTool = makeTool({
  name: "report_result",
  description: "Report the result of the test",
  displayName: ({ success }) => (success ? "Passed" : "Failed"),
  dynamicIcon: ({ success }) => (success ? CheckIcon : XIcon),
  parameters: z.object({
    success: z.boolean().describe("Whether the test was successful"),
    result: z.string().describe("The result of the test"),
  }),
  async run({ success, result }, { context }: { context: PythonAgentContext }) {
    context.reportResult(success, result);
    return "Done";
  },
});

export const makePythonTesterAgent = (ai: GoogleGenAI) =>
  makeGeminiAgent<PythonAgentContext>({
    ai,
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: `
You are an agent that tests Python apps running in a terminal, and assessing
whether or not they work as intended, per the user's prompt.
You have a set of tools available to help you use the app, such as sending
keys to the terminal, taking screenshots, etc.
The app is already running, so keys you send are being sent to the Python app directly.
    `
        .replace(/\s+/g, " ")
        .trim(),
      thinkingConfig: {
        includeThoughts: true,
        thinkingBudget: 1000,
      },
    },
    tools: [
      /*screenshotTool*/
      getTerminalContentTool,
      sendKeysTool,
      reportResultTool,
    ],
  });
