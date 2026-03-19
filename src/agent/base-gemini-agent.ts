/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tool } from "@/ai/tools";
import {
  FunctionResponse,
  GenerateContentConfig,
  GenerateContentParameters,
  GoogleGenAI,
  Part,
  type Content,
} from "@google/genai";
import z from "zod";
import { Agent } from "./types";

export const makeGeminiAgent = <TContext = unknown>({
  ai,
  config,
  model,
  tools,
}: {
  ai: GoogleGenAI;
  config: GenerateContentConfig;
  model: string;
  tools: Tool<any, TContext>[];
}): Agent<TContext> & { tools: Tool<any, TContext>[] } => ({
  tools,
  async *generate(prompt, { history, signal, context }): AsyncGenerator<Part> {
    const userMessage: Content = {
      role: "user",
      parts: [{ text: prompt }],
    };
    history = [...(history || []), userMessage];
    let remainingSteps = 100;
    let done = false;
    do {
      done = true;
      const gcr = {
        model,
        contents: prepareHistory(history),
        config: {
          ...config,
          abortSignal: signal!,
          tools: [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: z.toJSONSchema(t.parameters, {
                  target: "openapi-3.0",
                }) as any,
              })),
            },
          ],
        },
      } satisfies GenerateContentParameters;
      let agentResponse: Content | undefined;
      try {
        let stream = await ai.models.generateContentStream(gcr);
        for await (let chunk of stream) {
          if (!agentResponse) {
            agentResponse = { role: "model", parts: [] };
            history.push(agentResponse);
          }
          let part = chunk.candidates?.[0]?.content?.parts?.[0];
          if (!part) continue;
          part.extTimestamp = Date.now();
          yield structuredClone(part);
          let lastPart = agentResponse.parts!.at(-1);
          if (
            part.thought === lastPart?.thought &&
            part.text &&
            lastPart?.text
          ) {
            lastPart.text += chunk.text;
          } else {
            agentResponse.parts!.push(part);
          }
          if (part.functionCall) {
            let fc = part.functionCall;
            // call tools and append to response
            let tool = tools.find((t) => t.name === fc.name);
            if (!tool) continue;
            let args = fc.args || {};
            let response: Record<string, any> = {};
            let responseParts: Part[] | undefined;
            let extMetadata = undefined;
            try {
              let output = await tool.run(args, { context, signal });
              if (typeof output === "string") {
                response = { output };
              } else if (typeof output === "object" && "parts" in output) {
                responseParts = output.parts;
                extMetadata = output.metadata;
              } else {
                response = { output: output.output };
                extMetadata = output.metadata;
              }
            } catch (e) {
              response = { error: String((e as any).message || e) };
            }
            signal?.throwIfAborted();
            let functionResponse: FunctionResponse = responseParts
              ? {
                  id: fc.id,
                  name: fc.name,
                  parts: responseParts,
                }
              : {
                  id: fc.id,
                  name: fc.name,
                  response,
                };
            done = false; // indicate we want to re-prompt LLM
            yield { functionResponse, extMetadata };
            // push the function call as a user message, and reset the agent response
            history.push({ role: "user", parts: [{ functionResponse }] });
            agentResponse = undefined;
          }
        }
      } catch (err: any) {
        // if an error was thrown due to the signal being aborted, throw the abort reason...
        // this is because genai seems to wrap the original error
        if (signal?.aborted) {
          throw signal.reason;
        }
        yield { extError: String(err.message || err) + " ... " + err.name };
        console.error(err);
      }
    } while (!done && --remainingSteps > 0);
  },
});

// prepare history to be sent to gemini
function prepareHistory(contents: Content[]): Content[] {
  return (
    contents
      // Split function responses in model messages into separate user messages
      .flatMap((c) => {
        if (c.role !== "model") return [c];
        let nc: Content[] = [];
        while (true) {
          let idx = c.parts?.findIndex((p) => p.functionResponse);
          if (idx === -1 || idx === undefined) {
            c.parts?.length && nc.push(c);
            break;
          }
          if (idx > 0) {
            nc.push({ role: c.role, parts: c.parts?.slice(0, idx) });
          }
          nc.push({ role: "user", parts: [c.parts?.[idx]!] });
          c = { role: c.role, parts: c.parts?.slice(idx + 1) };
        }
        return nc;
      })
      // remove application-specific extended data on history
      .map((c) => ({
        ...c,
        parts: c.parts?.map((p) => ({
          ...p,
          extError: undefined,
          extTimestamp: undefined,
          extMetadata: undefined,
        })),
      }))
  );
}
