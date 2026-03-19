/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function debounce<F extends (...args: any[]) => any>(
  func: F,
  timeout = 100
): (...args: Parameters<F>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<F>) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // @ts-ignore
      func.apply(this as any, args);
    }, timeout);
  };
}
