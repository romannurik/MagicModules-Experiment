/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { SyncDelta } from "@/engines/types";
import { PythonHost, PythonHostRef } from "@/pyrunner/PythonHost";
import { sha1 } from "@/util/sha1";
import { GoogleGenAI } from "@google/genai";
import { createContext, PropsWithChildren, RefObject, useRef } from "react";
import { Engine } from "../types";
import { STARTER_CODEBASE } from "./py-starter";

const DEBUG = true;

export const pythonEngine: Engine = {
  defaultFile: "app.py",
  starterCodebase: STARTER_CODEBASE,
  PreviewHost: PythonHost,
  ContextWrapper,
  computeSync,
  generateMagicModule,
  updateMagicModule,
  generateMagicSpec,
};

export const PythonEngineContext = createContext<{
  pythonHostRef: RefObject<PythonHostRef>;
}>({ pythonHostRef: { current: null } });

function ContextWrapper({ children }: PropsWithChildren) {
  let pythonHostRef = useRef<PythonHostRef>(null);
  return (
    <PythonEngineContext.Provider value={{ pythonHostRef }}>
      {children}
    </PythonEngineContext.Provider>
  );
}

/**
 * Computes what work needs to be done to resolve magic module usage in a codebase.
 */
export async function computeSync(codebase: Codebase): Promise<SyncDelta[]> {
  const deltas: SyncDelta[] = [];
  for (let filePath of Object.keys(codebase.files)) {
    if (filePath.startsWith("magic/") && filePath.endsWith(".md")) {
      const specPath = filePath;
      const modulePath = specPath.replace(/\.md$/, ".py");
      if (await checkFreshness(codebase, modulePath, specPath)) continue;
      deltas.push({
        type: "update-magic-module",
        specPath,
        modulePath,
      });
    } else if (filePath.endsWith(".py")) {
      const magicImports = await findMagicImports(codebase.files[filePath]);
      for (const magicImport of magicImports) {
        let magicSpecPath = `${magicImport}.md`;
        let magicModulePath = `${magicImport}.py`;
        if (!codebase.files[magicSpecPath]) {
          deltas.push({
            type: "new-magic-module",
            usedBySourcePath: filePath,
            specPath: magicSpecPath,
            modulePath: magicModulePath,
          });
        } else if (!codebase.files[magicModulePath]) {
          deltas.push({
            type: "update-magic-module",
            specPath: magicSpecPath,
            modulePath: magicModulePath,
          });
        }
      }
    }
  }
  return deltas;
}

/**
 * Finds all magic imports in a file.
 */
async function findMagicImports(fileContent: string) {
  // const importRegex = /(?<!\/\/\s*)import\s+.*\s+from\s+['"](\..*\.magic)['"]/g;
  const importRegex =
    /^\s*from\s+magic\.(\w+)\s+import|\s*import\s+magic\.(\w+)/gm;
  const matches = fileContent.matchAll(importRegex);
  const magicImports = [];
  for (const match of matches) {
    magicImports.push("magic/" + (match[1] || match[2]));
  }
  return magicImports;
}

/**
 * Generates a markdown spec for a component file based on the place it's used in.
 */
export async function generateMagicSpec(
  ai: GoogleGenAI,
  {
    codebase,
    specPath,
    usedBySourcePath,
    signal,
  }: {
    codebase: Codebase;
    specPath: string;
    usedBySourcePath: string;
    signal?: AbortSignal;
  },
) {
  console.log(`Generating magic spec at ${specPath}`);

  const sourceFileContent = codebase.files[usedBySourcePath];

  const prompt = `
# Project files:
${Object.keys(codebase.files)
  .filter((path) => path !== usedBySourcePath)
  .map((path) => `${path}:\n\`\`\`\n${codebase.files[path]}\n\`\`\``)
  .join("\n")}

# Relevant context file:
\`\`\`py
${sourceFileContent}
\`\`\`

The relevant context file above imports a module from the location "${specPath}".
This module does not exist yet.
Generate a short Markdown specification for this new module, based on how it's used in the relevant context file above.
The spec should include:
- The module's purpose and scope.
- Method signatures, including types

Your response should only be the markdown specification, with no additional commentary or formatting.
Be very, very succinct, using only simple bullets and headings.
Try to keep the spec to under 400 words.
For bullets, use "- Hello" style, not "*      Hello" style.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { abortSignal: signal },
  });
  return { specContent: result.text || "" };
}

/**
 * Generates a magic module from a spec.
 */
export async function generateMagicModule(
  ai: GoogleGenAI,
  {
    codebase,
    specPath,
    signal,
  }: {
    codebase: Codebase;
    specPath: string;
    signal?: AbortSignal;
  },
) {
  console.log(`Generating magic module from ${specPath}`);
  const specContent = codebase.files[specPath];

  const prompt = `
# Project files:
${Object.keys(codebase.files)
  .filter((path) => path !== specPath)
  .map((path) => `${path}:\n\`\`\`\n${codebase.files[path]}\n\`\`\``)
  .join("\n")}

# Spec
\`\`\`markdown
${specContent}
\`\`\`

Your task is to generate a Python module based on the Markdown specification and other project files above.
Your response should only be the raw code for the module, with no additional commentary or markdown formatting.
Do NOT wrap the resulting code in triple backticks.
Only return the raw code, with no backticks or formatting.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { abortSignal: signal },
  });
  let text = (result.text || "")
    .trim()
    .replace(/^```\w*\n|\n```$/g, "")
    .trim();

  const hash = await sha1(specContent);
  const moduleCode = `# AUTO-GENERATED FROM MARKDOWN HASH: ${hash}\n${text}`;

  return { moduleCode };
}

/**
 * Updates a magic module based on its spec.
 */
export async function updateMagicModule(
  ai: GoogleGenAI,
  {
    codebase,
    specPath,
    modulePath,
    signal,
  }: {
    codebase: Codebase;
    specPath: string;
    modulePath: string;
    signal?: AbortSignal;
  },
) {
  console.log(`Updating magic module ${modulePath} from ${specPath}`);
  const specContent = codebase.files[specPath];
  const moduleContent = codebase.files[modulePath];
  // await fs.writeFile(
  //   componentPath,
  //   componentContent.replace(
  //     /export default (.+);/,
  //     `
  //   export default () => <div>Updating component...</div>;
  //   `.trim()
  //   )
  // );

  const prompt = `
# Project files:
${Object.keys(codebase.files)
  .filter((path) => path !== specPath && path !== modulePath)
  .map((path) => `${path}:\n\`\`\`\n${codebase.files[path]}\n\`\`\``)
  .join("\n")}

# Existing module code:
\`\`\`py
${moduleContent.replace(/# AUTO-GENERATED FROM MARKDOWN HASH: .*\n/g, "")}
\`\`\`

# Spec
\`\`\`markdown
${specContent}
\`\`\`

Update the Python module above to match the provided Markdown specification.
Your response should only be the raw code for the updated module, with no additional commentary or markdown formatting.
Only return the raw code, with no backticks or formatting.
  `;

  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { abortSignal: signal },
  });
  const text = (result.text || "")
    .trim()
    .replace(/^```\w*\n|\n```$/g, "")
    .trim();

  const hash = await sha1(specContent);
  const moduleCode = `# AUTO-GENERATED FROM MARKDOWN HASH: ${hash}\n${text}`;
  return { moduleCode };
}

/**
 * Checks if the SHA-1 in a component's header matches the SHA-1 of its spec.
 */
async function checkFreshness(
  codebase: Codebase,
  modulePath: string,
  specPath: string,
) {
  try {
    const moduleContent = codebase.files[modulePath];
    const specContent = codebase.files[specPath];
    DEBUG &&
      console.log("Checking freshness between", modulePath, "and", specPath);

    const hashRegex = /HASH: (.*)/;
    const match = moduleContent.match(hashRegex);
    if (!match) {
      return false;
    }
    const existingHash = match[1];
    const specHash = await sha1(specContent);

    return existingHash === specHash;
  } catch (error) {
    return false;
  }
}
