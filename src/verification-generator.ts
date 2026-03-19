/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { Codebase } from "./document/DocumentProvider";

export async function generateAgenticVerification(
  ai: GoogleGenAI,
  {
    verificationTitle,
    codebase,
    signal,
  }: {
    verificationTitle: string;
    codebase: Codebase;
    signal?: AbortSignal;
  },
) {
  console.log(`Generating agentic verification: ${verificationTitle}`);

  const prompt = `
# Project files:
${Object.keys(codebase.files)
  .map((path) => `${path}:\n\`\`\`\n${codebase.files[path]}\n\`\`\``)
  .join("\n")}

# Your objective

Your objective is to generate a small test harness Python program that uses the files above.
An AI agent will run and interact with this program (via keyboard and by reading the program's output)
to determine if the program passes the test below:

# The test:
\`\`\`
${verificationTitle}
\`\`\`

Your response should only be the Python program, with no additional commentary or formatting.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { abortSignal: signal },
  });
  return { pythonCodeHarness: result.text || "" };
}

export async function generateStaticVerification(
  ai: GoogleGenAI,
  {
    verificationTitle,
    codebase,
    signal,
  }: {
    verificationTitle: string;
    codebase: Codebase;
    signal?: AbortSignal;
  },
) {
  console.log(`Generating static verification: ${verificationTitle}`);

  const prompt = `
# Project files:
${Object.keys(codebase.files)
  .map((path) => `${path}:\n\`\`\`\n${codebase.files[path]}\n\`\`\``)
  .join("\n")}

# Your objective

Your objective is to generate a small test, non-interactive harness Python program that uses the files above.
The program will run non-interactively and its output will be checked to detemrine if it passes the test below:

# The test:
\`\`\`
${verificationTitle}
\`\`\`

Your response should only be the Python program, with no additional commentary or formatting.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { abortSignal: signal },
  });
  return { pythonCodeHarness: result.text || "" };
}
