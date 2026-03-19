/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";

export const STARTER_CODEBASE: Codebase = {
  files: {
    "app.py": `
# from magic.ascii import ascii_art

def main():
  # print(ascii_art("Hello"))
  # return
  print("Uncomment the three commented lines and hit Save to try magic modules!")

if __name__ == "__main__":
  main()
      `.trim(),
  },
};
