/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.scss";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Theme appearance="dark" accentColor="sky" grayColor="slate" radius="large">
      <App />
    </Theme>
  </React.StrictMode>,
);
