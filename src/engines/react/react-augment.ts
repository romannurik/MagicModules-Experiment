/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";

export function augmentCodebase(codebase: Codebase): Codebase {
  let magicComponents = Object.keys(codebase.files).filter((p) =>
    p.endsWith(".magic.tsx")
  );
  let exports = Object.fromEntries(
    magicComponents.map((p) => [
      p.replace(/.*\//, "").replace(".magic.tsx", ""),
      "./" + p.replace(/\.tsx?$/, ""),
    ])
  );

  let magicBarrel = [
    ...Object.entries(exports).map(
      ([name, p]) => `import ${name} from "${p}";`
    ),
    `export default { ${Object.keys(exports).join(", ")} };`,
    `declare global { const Magic = { ${Object.keys(exports).join(", ")} }; }`,
  ].join("\n");

  let files: Record<string, string> = {
    "Magic.tsx": magicBarrel,
    // for monaco to not show errors
    "extra-types.d.ts": `
declare module "react";
declare module "npm:*";
`,
  };
  for (let [p, content] of Object.entries(codebase.files)) {
    files[p] = content;
    if (p.endsWith(".tsx")) {
      files[p] = 'import Magic from "./Magic";\n' + content;
    }
  }

  return { ...codebase, files };
}
