#!/usr/bin/env npx tsx
import React, { useState, useEffect } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { niftty } from "niftty";
import { createHighlighter } from "shiki";
import type { Highlighter, BundledTheme } from "shiki";

// Sample code snippets
const SAMPLE_CODES = {
  typescript: `function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(message);`,
  
  python: `def calculate_fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)

result = calculate_fibonacci(10)
print(f"Fibonacci(10) = {result}")`,
  
  jsx: `import React from 'react';

export function Button({ children, onClick }) {
  return (
    <button 
      className="btn-primary"
      onClick={onClick}
    >
      {children}
    </button>
  );
}`,
  
  rust: `fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}`,
};

const SAMPLE_DIFFS = {
  typescript: `function greet(name: string): string {
  return \`Hi, \${name}.\`;
}

const msg = greet("Universe");
console.log(msg);`,
  
  python: `def calculate_fibonacci(n: int) -> int:
    if n <= 0:
        return 0
    if n == 1:
        return 1
    return calculate_fibonacci(n - 1) + calculate_fibonacci(n - 2)

result = calculate_fibonacci(10)
print(f"Result: {result}")`,
  
  jsx: `import React from 'react';

export function Button({ children, onClick, disabled }) {
  return (
    <button 
      className="btn-secondary"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}`,
  
  rust: `fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    let avg = sum as f64 / numbers.len() as f64;
    println!("Sum: {}, Average: {:.2}", sum, avg);
}`,
};

const THEMES: BundledTheme[] = [
  "catppuccin-frappe",
  "everforest-dark",
  "rose-pine-moon",
  "github-dark",
  "github-light",
  "nord",
  "one-dark-pro",
  "tokyo-night",
  "dracula",
  "monokai",
];

const LANGUAGES = ["typescript", "python", "jsx", "rust"] as const;
type Language = typeof LANGUAGES[number];

type ControlId = 
  | "mode"
  | "theme"
  | "language"
  | "lineNumbers"
  | "collapseUnchanged"
  | "streaming"
  | "streamWindow"
  | "streamAction";

interface Control {
  id: ControlId;
  label: string;
  getValue: (state: AppState) => string;
  onLeft?: (state: AppState) => Partial<AppState>;
  onRight?: (state: AppState) => Partial<AppState>;
  onSelect?: (state: AppState) => Partial<AppState>;
  disabled?: (state: AppState) => boolean;
}

interface AppState {
  mode: "render" | "diff" | "stream";
  themeIndex: number;
  languageIndex: number;
  lineNumbers: boolean | "both";
  collapseUnchanged: boolean;
  streaming: boolean;
  streamWindow: number;
  streamProgress: number;
  isStreaming: boolean;
}

const CONTROLS: Control[] = [
  {
    id: "mode",
    label: "Mode",
    getValue: (s) => s.mode.toUpperCase(),
    onLeft: (s) => {
      const modes = ["render", "diff", "stream"] as const;
      const idx = modes.indexOf(s.mode);
      return { mode: modes[(idx - 1 + modes.length) % modes.length] };
    },
    onRight: (s) => {
      const modes = ["render", "diff", "stream"] as const;
      const idx = modes.indexOf(s.mode);
      return { mode: modes[(idx + 1) % modes.length] };
    },
  },
  {
    id: "theme",
    label: "Theme",
    getValue: (s) => THEMES[s.themeIndex],
    onLeft: (s) => ({ themeIndex: (s.themeIndex - 1 + THEMES.length) % THEMES.length }),
    onRight: (s) => ({ themeIndex: (s.themeIndex + 1) % THEMES.length }),
  },
  {
    id: "language",
    label: "Language",
    getValue: (s) => LANGUAGES[s.languageIndex],
    onLeft: (s) => ({ languageIndex: (s.languageIndex - 1 + LANGUAGES.length) % LANGUAGES.length }),
    onRight: (s) => ({ languageIndex: (s.languageIndex + 1) % LANGUAGES.length }),
  },
  {
    id: "lineNumbers",
    label: "Line Numbers",
    getValue: (s) => String(s.lineNumbers),
    onLeft: (s) => ({
      lineNumbers: s.lineNumbers === true ? "both" : s.lineNumbers === "both" ? false : true,
    }),
    onRight: (s) => ({
      lineNumbers: s.lineNumbers === true ? "both" : s.lineNumbers === "both" ? false : true,
    }),
  },
  {
    id: "collapseUnchanged",
    label: "Collapse Unchanged",
    getValue: (s) => s.collapseUnchanged ? "ON" : "OFF",
    onLeft: (s) => ({ collapseUnchanged: !s.collapseUnchanged }),
    onRight: (s) => ({ collapseUnchanged: !s.collapseUnchanged }),
    disabled: (s) => s.mode !== "diff",
  },
  {
    id: "streaming",
    label: "Streaming Enabled",
    getValue: (s) => s.streaming ? "ON" : "OFF",
    onLeft: (s) => ({ streaming: !s.streaming }),
    onRight: (s) => ({ streaming: !s.streaming }),
    disabled: (s) => s.mode !== "stream",
  },
  {
    id: "streamWindow",
    label: "Stream Window Size",
    getValue: (s) => String(s.streamWindow),
    onLeft: (s) => ({ streamWindow: Math.max(5, s.streamWindow - 5) }),
    onRight: (s) => ({ streamWindow: Math.min(50, s.streamWindow + 5) }),
    disabled: (s) => s.mode !== "stream",
  },
  {
    id: "streamAction",
    label: "Stream Control",
    getValue: (s) => s.isStreaming ? "STREAMING..." : `${s.streamProgress}%`,
    onSelect: (s) => {
      if (s.isStreaming) {
        return { isStreaming: false, streamProgress: 0 };
      } else {
        return { isStreaming: true, streamProgress: 0 };
      }
    },
    disabled: (s) => s.mode !== "stream",
  },
];

function App() {
  const { exit } = useApp();
  const [selectedControl, setSelectedControl] = useState(0);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [renderedOutput, setRenderedOutput] = useState<string>("");
  const [state, setState] = useState<AppState>({
    mode: "render",
    themeIndex: 0,
    languageIndex: 0,
    lineNumbers: true,
    collapseUnchanged: false,
    streaming: false,
    streamWindow: 20,
    streamProgress: 0,
    isStreaming: false,
  });

  const currentTheme = THEMES[state.themeIndex];
  const currentLanguage = LANGUAGES[state.languageIndex];
  const currentCode = SAMPLE_CODES[currentLanguage];
  const currentDiff = SAMPLE_DIFFS[currentLanguage];

  // Initialize highlighter
  useEffect(() => {
    createHighlighter({
      langs: ["typescript", "python", "jsx", "rust", "tsx"],
      themes: THEMES,
    }).then(setHighlighter);
  }, []);

  // Render output whenever state changes
  useEffect(() => {
    if (!highlighter) return;

    const renderCode = async () => {
      try {
        let result = "";
        
        if (state.mode === "render") {
          result = await niftty({
            highlighter,
            code: currentCode,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            lineNumbers: state.lineNumbers,
          });
        } else if (state.mode === "diff") {
          result = await niftty({
            highlighter,
            code: currentCode,
            diffWith: currentDiff,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            lineNumbers: state.lineNumbers,
            collapseUnchanged: state.collapseUnchanged ? {
              padding: 2,
              separator: (n) => `\n··· ${n} unchanged ···\n`,
            } : false,
          });
        } else if (state.mode === "stream") {
          const length = Math.floor((currentCode.length * state.streamProgress) / 100);
          const partial = currentCode.substring(0, length);
          
          result = await niftty({
            highlighter,
            code: partial,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            streaming: state.streamWindow,
            lineNumbers: state.lineNumbers,
          });
        }
        
        setRenderedOutput(result);
      } catch (error) {
        setRenderedOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    renderCode();
  }, [highlighter, state, currentCode, currentDiff, currentTheme, currentLanguage]);

  // Streaming simulation
  useEffect(() => {
    if (!state.isStreaming) return;

    const interval = setInterval(async () => {
      setState(prev => {
        if (prev.streamProgress >= 100) {
          return { ...prev, isStreaming: false, streamProgress: 100 };
        }
        return { ...prev, streamProgress: prev.streamProgress + 5 };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [state.isStreaming]);

  useInput((input, key) => {
    if (input === "q") {
      exit();
      return;
    }

    // Navigate between controls
    if (key.upArrow) {
      setSelectedControl((prev) => {
        let next = (prev - 1 + CONTROLS.length) % CONTROLS.length;
        // Skip disabled controls
        while (CONTROLS[next].disabled?.(state)) {
          next = (next - 1 + CONTROLS.length) % CONTROLS.length;
          if (next === prev) break; // Prevent infinite loop
        }
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setSelectedControl((prev) => {
        let next = (prev + 1) % CONTROLS.length;
        // Skip disabled controls
        while (CONTROLS[next].disabled?.(state)) {
          next = (next + 1) % CONTROLS.length;
          if (next === prev) break; // Prevent infinite loop
        }
        return next;
      });
      return;
    }

    const currentControl = CONTROLS[selectedControl];

    // Left/Right to change values
    if (key.leftArrow && currentControl.onLeft) {
      setState(prev => ({ ...prev, ...currentControl.onLeft!(prev) }));
      return;
    }

    if (key.rightArrow && currentControl.onRight) {
      setState(prev => ({ ...prev, ...currentControl.onRight!(prev) }));
      return;
    }

    // Enter/Space to select
    if ((key.return || input === " ") && currentControl.onSelect) {
      setState(prev => ({ ...prev, ...currentControl.onSelect!(prev) }));
      return;
    }
  });

  if (!highlighter) {
    return (
      <Box padding={1}>
        <Text>Loading highlighter...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
        <Text bold color="cyan">🐚 Niftty Playground</Text>
        <Box marginLeft={2}>
          <Text dimColor>↑↓: Navigate | ←→: Adjust | Enter: Select | Q: Quit</Text>
        </Box>
      </Box>

      {/* Main Layout */}
      <Box flexGrow={1} marginTop={1}>
        {/* Sidebar */}
        <Box 
          flexDirection="column" 
          width={40}
          borderStyle="single" 
          borderColor="yellow"
          paddingX={2}
          paddingY={1}
        >
          <Text bold underline color="yellow" marginBottom={1}>
            Controls
          </Text>
          
          {CONTROLS.map((control, idx) => {
            const isSelected = idx === selectedControl;
            const isDisabled = control.disabled?.(state);
            
            return (
              <Box key={control.id} marginTop={idx === 0 ? 0 : 1}>
                <Box width={3}>
                  <Text color={isSelected ? "cyan" : "gray"}>
                    {isSelected ? "▶" : " "}
                  </Text>
                </Box>
                <Box flexDirection="column" flexGrow={1}>
                  <Text 
                    bold={isSelected}
                    color={isDisabled ? "gray" : isSelected ? "cyan" : "white"}
                    dimColor={isDisabled}
                  >
                    {control.label}
                  </Text>
                  <Text 
                    color={isDisabled ? "gray" : "green"}
                    dimColor={isDisabled}
                  >
                    {control.getValue(state)}
                  </Text>
                </Box>
              </Box>
            );
          })}
          
          <Box marginTop={2} flexDirection="column">
            <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
            <Box marginTop={1}>
              <Text dimColor>
                {CONTROLS[selectedControl].onLeft || CONTROLS[selectedControl].onRight
                  ? "← → to change value"
                  : ""}
                {CONTROLS[selectedControl].onSelect
                  ? "Enter to toggle"
                  : ""}
              </Text>
            </Box>
          </Box>
        </Box>

        {/* Preview Area */}
        <Box 
          flexDirection="column" 
          flexGrow={1}
          borderStyle="double" 
          borderColor="green"
          marginLeft={1}
          paddingX={2}
          paddingY={1}
        >
          <Text bold underline color="green" marginBottom={1}>
            Preview
          </Text>
          <Text>{renderedOutput || "Loading..."}</Text>
        </Box>
      </Box>
    </Box>
  );
}

render(<App />);
