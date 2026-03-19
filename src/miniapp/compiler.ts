/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { esBundle, loadEsbuild } from "./bundler";
import hostApi from "./host-api?raw";

const REACT_VERSION = "19.1.0";

export async function compileMiniApp(codebase: Codebase): Promise<string> {
  await loadEsbuild();
  const {
    output: jsBundle,
    npmExternals,
    error,
  } = await esBundle({
    "index.ts": `
import React, {useState} from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import {MiniAppWrapper} from '$';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MiniAppWrapper>
      <App />
    </MiniAppWrapper>
  </React.StrictMode>
);

`,
    ...codebase.files,
    $: hostApi,
  });
  if (error) throw error;

  // const code = `window.codeRunner = async function () { \n${output}\n }`;
  // iframe.current?.contentWindow?.postMessage({ id, code }, "*");
  return assembleHtml({ jsBundle, npmExternals });
}

function assembleHtml({
  jsBundle,
  npmExternals,
}: {
  jsBundle: string;
  npmExternals?: string[];
}) {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
</head>
<body>
  <div id="root"></div>
  <script type="importmap">
    {
      "imports": ${JSON.stringify(
        {
          ...Object.fromEntries(
            npmExternals?.map((pkg) => [
              `npm:${pkg}`,
              `https://esm.sh/${pkg}`,
            ]) || []
          ),
          react: `https://esm.sh/react@${REACT_VERSION}`,
          "react/jsx-runtime": `https://esm.sh/react@${REACT_VERSION}/jsx-runtime`,
          "react-dom/": `https://esm.sh/react-dom@${REACT_VERSION}/`,
        },
        null,
        2
      )}
    }
  </script>
  <style type="text/tailwindcss">
    @layer base {
      button:not([disabled]),
      [role="button"]:not([disabled]) {
        @apply cursor-pointer;
      }
    }
  </style>
  <script type="module">
${jsBundle}
  </script>
</body>
</html>
`;
}
