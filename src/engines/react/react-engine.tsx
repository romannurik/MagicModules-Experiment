/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { SyncDelta } from "@/engines/types";
import { MiniAppHost } from "@/miniapp/MiniAppHost";
import { sha1 } from "@/util/sha1";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { Engine } from "../types";
import { augmentCodebase } from "./react-augment";
import { STARTER_CODEBASE } from "./react-starter";

const DEBUG = true;

export const reactEngine: Engine = {
  defaultFile: "App.tsx",
  generatingModuleContent:
    "export default () => <div>Generating component...</div>;",
  starterCodebase: STARTER_CODEBASE,
  augmentCodebase,
  PreviewHost: MiniAppHost,
  computeSync,
  generateMagicModule,
  updateMagicModule,
  generateMagicSpec,
};

/**
 * Computes what work needs to be done to resolve magic component usage in a codebase.
 */
export async function computeSync(codebase: Codebase): Promise<SyncDelta[]> {
  const deltas: SyncDelta[] = [];
  for (let filePath of Object.keys(codebase.files)) {
    if (filePath.endsWith(".magic.md")) {
      const specPath = filePath;
      const modulePath = specPath.replace(/\.md$/, ".tsx");
      if (await checkFreshness(codebase, modulePath, specPath)) continue;
      deltas.push({
        type: "update-magic-module",
        specPath,
        modulePath,
      });
    } else if (filePath.endsWith(".tsx")) {
      const magicImports = await findMagicImports(codebase.files[filePath]);
      for (const magicImport of magicImports) {
        let magicSpecPath = path.relative(
          path.dirname(filePath),
          `${magicImport}.md`,
        );
        let magicModulePath = path.relative(
          path.dirname(filePath),
          `${magicImport}.tsx`,
        );
        if (!codebase.files[magicModulePath]) {
          deltas.push({
            type: "new-magic-module",
            usedBySourcePath: filePath,
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
  const importRegex = /\<Magic\.(\w+)/g;
  const matches = fileContent.matchAll(importRegex);
  const magicImports = [];
  for (const match of matches) {
    magicImports.push("magic-components/" + match[1] + ".magic");
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
    Read the following TypeScript file content:
    \`\`\`tsx
    ${sourceFileContent}
    \`\`\`

    The file imports a component with the path "${specPath}".
    This component does not exist yet.
    Generate a short Markdown specification for this new React component.
    The spec should include:
    - The component's purpose and scope.
    - The props it should accept.
    - The component's behavior.
    
    Your response should only be the markdown specification, with no additional commentary or formatting.

    Be very, very succinct, using only simple bullets and headings. Try to keep the spec to under 400 words.

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
 * Generates a magic component from a spec.
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
  console.log(`Generating magic component from ${specPath}`);
  const specContent = codebase.files[specPath];

  const prompt = `
    Generate a React component in TypeScript based on the following Markdown specification.
    Your response should only be the raw code for the component, with no additional commentary or markdown formatting. Do NOT wrap the resulting code in triple backticks.

    Make sure this file is fully self-contained, with all CSS included via inline styles or CSS-in-JS.

    \`\`\`markdown
    ${specContent}
    \`\`\`

    Only return the raw code, with no backticks or formatting. Also make sure to export the component as
    a default export, not a named export.
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
  const moduleCode = `// AUTO-GENERATED FROM MARKDOWN HASH: ${hash}\n${text}`;

  return {
    moduleCode,
  };
}

/**
 * Updates a magic component based on its spec.
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
  console.log(`Updating magic component ${modulePath} from ${specPath}`);
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
    Update the following React component to match the provided Markdown specification.
    Your response should only be the raw code for the updated component, with no additional commentary or markdown formatting.

    ## Markdown Specification:
    \`\`\`markdown
    ${specContent}
    \`\`\`

    ## Existing Component Code:
    \`\`\`tsx
    ${moduleContent}
    \`\`\`

    Only return the raw code, with no backticks or formatting. Also make sure to export the component as
    a default export, not a named export.
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
  const moduleCode = `// AUTO-GENERATED FROM MARKDOWN HASH: ${hash}\n${text}`;
  return { moduleCode };
}

/**
 * Checks if the SHA-1 in a component's header matches the SHA-1 of its spec.
 */
async function checkFreshness(
  codebase: Codebase,
  componentPath: string,
  specPath: string,
) {
  try {
    const componentContent = codebase.files[componentPath];
    const specContent = codebase.files[specPath];
    DEBUG &&
      console.log("Checking freshness between", componentPath, "and", specPath);

    const hashRegex = /HASH: (.*)/;
    const match = componentContent.match(hashRegex);
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
