/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Codebase } from "@/document/DocumentProvider";
import { sha1 } from "@/util/sha1";

export const STARTER_CODEBASE: Codebase = {
  files: {
    "App.tsx": `
import { useState } from "react";
import { MinusIcon, PlusIcon } from "npm:lucide-react";
import Button from './components/Button';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4 p-8">
      <h1 className="text-xl text-bold">This is a demo!</h1>
      <p className="text-gray-500 text-center">
        Add magic components by typing{' '}
        <code className="text-green-600">&lt;Magic.YourComponentName /&gt;</code>.
        Update them by changing their spec.
      </p>
      <div className="text-8xl text-bold text-gray-600">{count}</div>
      <div className="flex gap-1">
        <Button onClick={() => setCount(count - 1)}>
          <MinusIcon />
        </Button>
        {/* This is a magic component that AI owns! */}
        <Magic.BigShinyGradientButton onClick={() => setCount(count + 1)}>
          <PlusIcon />
        </Magic.BigShinyGradientButton>
      </div>
    </div>
  );
}
      `.trim(),
    "components/Button.tsx": `
export default ({ onClick, children }: { onClick: () => void; children?: any }) => (
  <button
    className="bg-blue-500 text-white px-4 py-2 rounded-xl"
    onClick={onClick}
  >
    {children}
  </button>
);
      `.trim(),
    "magic-components/BigShinyGradientButton.magic.md": `
# BigShinyGradientButton

### Purpose and Scope
A visually striking button component designed to be a primary call-to-action. It features a large size, a CSS gradient background, and a subtle shine effect to draw the user's attention. This component should be used for the most important action in a given view.

### Props

- \`children\`: **React.ReactNode** (required)
  - The content to display inside the button, such as text or an icon.

- \`onClick\`: **() => void**
  - The callback function to execute when the button is clicked.

- Accepts all standard HTML \`<button>\` attributes like \`disabled\`, \`type\`, and \`className\`, which are passed down to the underlying button element.

### Behavior

- **Default State**:
  - The button renders with a large padding and a default, vibrant color gradient.
  - A subtle gloss or shine effect is overlaid on the gradient.
- **Hover State**:
  - On mouse hover, the gradient subtly animates or brightens.
  - The shine effect becomes more pronounced.
- **Active State**:
  - On click, the button scales down slightly to provide clear visual feedback.
- **Functionality**:
  - Triggers the \`onClick\` function when pressed.
  - If the \`disabled\` prop is true, the button appears desaturated and does not respond to user interactions.
`.trim(),
    "magic-components/BigShinyGradientButton.magic.tsx": `
// AUTO-GENERATED FROM MARKDOWN HASH: e7a9aaf897af020cadbcaf4da19292afb6b1569f
import React, { useState } from 'react';

type BigShinyGradientButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

const BigShinyGradientButton = ({
  children,
  onClick,
  disabled,
  className,
  style,
  ...props
}: BigShinyGradientButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 32px',
    fontSize: '1.25rem',
    fontWeight: 'bold',
    fontFamily: \`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'\`,
    color: 'white',
    background: 'linear-gradient(45deg, #ff6b6b, #f06595, #cc5de8, #845ef7)',
    backgroundSize: '250% 250%',
    backgroundPosition: '15% 50%',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    outline: 'none',
    userSelect: 'none',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
    transition: 'transform 0.1s ease-out, background-position 0.6s ease, box-shadow 0.3s ease',
  };

  const shineBaseStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: '-150%',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(100deg, rgba(255, 255, 255, 0) 10%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 90%)',
    transform: 'skewX(-25deg)',
    transition: 'left 0.75s ease-in-out',
    zIndex: 1,
  };

  const contentStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 2,
  };

  const hoverStyle: React.CSSProperties = {
    backgroundPosition: '85% 50%',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
  };

  const shineHoverStyle: React.CSSProperties = {
    left: '150%',
  };

  const activeStyle: React.CSSProperties = {
    transform: 'scale(0.97)',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  };

  const disabledStyle: React.CSSProperties = {
    filter: 'grayscale(80%)',
    opacity: 0.6,
    cursor: 'not-allowed',
    boxShadow: 'none',
  };
  
  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    ...(isHovered && !disabled ? hoverStyle : {}),
    ...(isActive && !disabled ? activeStyle : {}),
    ...(disabled ? disabledStyle : {}),
    ...style,
  };
  
  const combinedShineStyle: React.CSSProperties = {
    ...shineBaseStyle,
    ...(isHovered && !disabled ? shineHoverStyle : {}),
  };

  return (
    <button
      style={combinedStyle}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsActive(false);
      }}
      onMouseDown={() => setIsActive(true)}
      onMouseUp={() => setIsActive(false)}
      className={className}
      {...props}
    >
      <span style={combinedShineStyle} aria-hidden="true" />
      <span style={contentStyle}>
        {children}
      </span>
    </button>
  );
};

export default BigShinyGradientButton;
`.trim(),
  },
};

(async () => {
  let spec =
    STARTER_CODEBASE.files["magic-components/BigShinyGradientButton.magic.md"];
  let cmp =
    STARTER_CODEBASE.files["magic-components/BigShinyGradientButton.magic.tsx"];
  let specHash = await sha1(spec);
  let cmpHash = cmp.match(/HASH: ([^\n]+)/)?.[1];
  if (cmpHash !== specHash) {
    console.error("Starter component hash needs update to " + specHash);
  }
})();