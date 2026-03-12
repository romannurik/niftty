#!/usr/bin/env npx tsx
import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import * as fs from "node:fs";
import * as path from "node:path";
import { niftty, tokenize } from "niftty";
import { createHighlighter } from "shiki";
import type { Highlighter, BundledTheme } from "shiki";

// Sample code snippets for the playground
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

type Mode = "render" | "diff" | "stream" | "settings" | "help";

interface Settings {
  lineNumbers: boolean | "both";
  collapseUnchanged: boolean;
  streaming: boolean;
  streamWindow: number;
}

function App() {
  const { exit } = useApp();
  const [mode, setMode] = useState<Mode>("render");
  const [currentThemeIndex, setCurrentThemeIndex] = useState(0);
  const [currentLanguageIndex, setCurrentLanguageIndex] = useState(0);
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [renderedOutput, setRenderedOutput] = useState<string>("");
  const [settings, setSettings] = useState<Settings>({
    lineNumbers: true,
    collapseUnchanged: false,
    streaming: false,
    streamWindow: 20,
  });
  const [streamProgress, setStreamProgress] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  const currentTheme = THEMES[currentThemeIndex];
  const currentLanguage = LANGUAGES[currentLanguageIndex];
  const currentCode = SAMPLE_CODES[currentLanguage];
  const currentDiff = SAMPLE_DIFFS[currentLanguage];

  // Initialize highlighter
  useEffect(() => {
    createHighlighter({
      langs: ["typescript", "python", "jsx", "rust", "tsx"],
      themes: THEMES,
    }).then(setHighlighter);
  }, []);

  // Render output whenever settings change
  useEffect(() => {
    if (!highlighter) return;

    const renderCode = async () => {
      try {
        let result = "";
        
        if (mode === "render") {
          result = await niftty({
            highlighter,
            code: currentCode,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            lineNumbers: settings.lineNumbers,
          });
        } else if (mode === "diff") {
          result = await niftty({
            highlighter,
            code: currentCode,
            diffWith: currentDiff,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            lineNumbers: settings.lineNumbers,
            collapseUnchanged: settings.collapseUnchanged ? {
              padding: 2,
              separator: (n) => `\n··· ${n} unchanged ···\n`,
            } : false,
          });
        } else if (mode === "stream") {
          // For streaming mode, we'll simulate it
          if (isStreaming) return; // Don't re-render while actively streaming
          
          const length = Math.floor((currentCode.length * streamProgress) / 100);
          const partial = currentCode.substring(0, length);
          
          result = await niftty({
            highlighter,
            code: partial,
            diffWith: currentDiff,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            streaming: settings.streamWindow,
            lineNumbers: settings.lineNumbers,
          });
        }
        
        setRenderedOutput(result);
      } catch (error) {
        setRenderedOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    renderCode();
  }, [highlighter, mode, currentTheme, currentLanguage, settings, streamProgress, isStreaming]);

  // Streaming simulation
  const startStreaming = () => {
    setIsStreaming(true);
    setStreamProgress(0);
    
    const interval = setInterval(async () => {
      setStreamProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsStreaming(false);
          return 100;
        }
        return prev + 5;
      });
      
      if (highlighter && streamProgress < 100) {
        const length = Math.floor((currentCode.length * streamProgress) / 100);
        const partial = currentCode.substring(0, length);
        
        try {
          const result = await niftty({
            highlighter,
            code: partial,
            diffWith: currentDiff,
            lang: currentLanguage === "typescript" ? "tsx" : currentLanguage,
            theme: currentTheme,
            streaming: settings.streamWindow,
            lineNumbers: settings.lineNumbers,
          });
          setRenderedOutput(result);
        } catch (error) {
          // Ignore errors during streaming
        }
      }
    }, 100);
  };

  useInput((input, key) => {
    // Global shortcuts
    if (input === "q" && mode !== "settings") {
      exit();
      return;
    }

    if (key.tab) {
      // Cycle through modes
      const modes: Mode[] = ["render", "diff", "stream", "settings", "help"];
      const currentIndex = modes.indexOf(mode);
      setMode(modes[(currentIndex + 1) % modes.length]);
      return;
    }

    // Mode-specific shortcuts
    if (mode === "render" || mode === "diff" || mode === "stream") {
      if (key.leftArrow) {
        setCurrentThemeIndex((prev) => (prev - 1 + THEMES.length) % THEMES.length);
      } else if (key.rightArrow) {
        setCurrentThemeIndex((prev) => (prev + 1) % THEMES.length);
      } else if (key.upArrow) {
        setCurrentLanguageIndex((prev) => (prev - 1 + LANGUAGES.length) % LANGUAGES.length);
      } else if (key.downArrow) {
        setCurrentLanguageIndex((prev) => (prev + 1) % LANGUAGES.length);
      } else if (input === "l") {
        setSettings((prev) => ({
          ...prev,
          lineNumbers: prev.lineNumbers === true ? "both" : prev.lineNumbers === "both" ? false : true,
        }));
      } else if (input === "c" && mode === "diff") {
        setSettings((prev) => ({ ...prev, collapseUnchanged: !prev.collapseUnchanged }));
      } else if (input === "s" && mode === "stream") {
        if (!isStreaming) {
          startStreaming();
        }
      } else if (input === "r" && mode === "stream") {
        setStreamProgress(0);
        setIsStreaming(false);
      }
    } else if (mode === "settings") {
      if (input === "1") {
        setSettings((prev) => ({
          ...prev,
          lineNumbers: prev.lineNumbers === true ? "both" : prev.lineNumbers === "both" ? false : true,
        }));
      } else if (input === "2") {
        setSettings((prev) => ({ ...prev, collapseUnchanged: !prev.collapseUnchanged }));
      } else if (input === "3") {
        setSettings((prev) => ({ ...prev, streaming: !prev.streaming }));
      } else if (input === "4" && key.shift) {
        setSettings((prev) => ({ ...prev, streamWindow: Math.max(5, prev.streamWindow - 5) }));
      } else if (input === "4") {
        setSettings((prev) => ({ ...prev, streamWindow: Math.min(50, prev.streamWindow + 5) }));
      }
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
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">
          🐚 Niftty Playground - {mode.toUpperCase()}
        </Text>
        <Box marginLeft={2}>
          <Text dimColor> | Tab: Switch Mode | Q: Quit</Text>
        </Box>
      </Box>

      {/* Status Bar */}
      <Box borderStyle="single" padding={1} marginBottom={1}>
        <Box flexDirection="row">
          <Text>
            <Text bold>Theme:</Text> <Text color="yellow">{currentTheme}</Text>
            {" | "}
            <Text bold>Lang:</Text> <Text color="green">{currentLanguage}</Text>
            {" | "}
            <Text bold>Lines:</Text> <Text color="blue">{String(settings.lineNumbers)}</Text>
            {mode === "diff" && (
              <>
                {" | "}
                <Text bold>Collapse:</Text> <Text color="magenta">{settings.collapseUnchanged ? "ON" : "OFF"}</Text>
              </>
            )}
            {mode === "stream" && (
              <>
                {" | "}
                <Text bold>Progress:</Text> <Text color="cyan">{streamProgress}%</Text>
              </>
            )}
          </Text>
        </Box>
      </Box>

      {/* Main Content */}
      {mode === "help" ? (
        <HelpScreen />
      ) : mode === "settings" ? (
        <SettingsScreen settings={settings} />
      ) : (
        <Box flexDirection="column">
          {/* Controls */}
          <Box borderStyle="single" padding={1} marginBottom={1}>
            <Box flexDirection="column">
              <Text>
                <Text bold>Controls:</Text> ← → Change Theme | ↑ ↓ Change Language | L: Toggle Line Numbers
              </Text>
              {mode === "diff" && <Text>C: Toggle Collapse</Text>}
              {mode === "stream" && <Text>S: Start Stream | R: Reset</Text>}
            </Box>
          </Box>

          {/* Rendered Output */}
          <Box borderStyle="double" borderColor="green" padding={1}>
            <Text>{renderedOutput || "No output yet..."}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function HelpScreen() {
  return (
    <Box flexDirection="column" borderStyle="round" padding={2}>
      <Text bold color="cyan" underline>
        Niftty Playground - Help
      </Text>
      <Text> </Text>
      
      <Text bold color="yellow">Modes (Tab to cycle):</Text>
      <Text>  • RENDER - Basic syntax highlighting</Text>
      <Text>  • DIFF - Side-by-side diff view with changes</Text>
      <Text>  • STREAM - Simulated LLM streaming output</Text>
      <Text>  • SETTINGS - Configure options</Text>
      <Text>  • HELP - This screen</Text>
      <Text> </Text>
      
      <Text bold color="yellow">Global Controls:</Text>
      <Text>  • Tab - Switch between modes</Text>
      <Text>  • Q - Quit the playground</Text>
      <Text> </Text>
      
      <Text bold color="yellow">Render/Diff/Stream Mode:</Text>
      <Text>  • ← → - Change theme</Text>
      <Text>  • ↑ ↓ - Change language</Text>
      <Text>  • L - Toggle line numbers (true → both → false)</Text>
      <Text> </Text>
      
      <Text bold color="yellow">Diff Mode:</Text>
      <Text>  • C - Toggle collapse unchanged regions</Text>
      <Text> </Text>
      
      <Text bold color="yellow">Stream Mode:</Text>
      <Text>  • S - Start streaming simulation</Text>
      <Text>  • R - Reset stream progress</Text>
      <Text> </Text>
      
      <Text bold color="green">Available Themes:</Text>
      <Text>  {THEMES.join(", ")}</Text>
      <Text> </Text>
      
      <Text bold color="green">Available Languages:</Text>
      <Text>  {LANGUAGES.join(", ")}</Text>
    </Box>
  );
}

function SettingsScreen({ settings }: { settings: Settings }) {
  return (
    <Box flexDirection="column" borderStyle="round" padding={2}>
      <Text bold color="cyan" underline>
        Settings
      </Text>
      <Text> </Text>
      
      <Box flexDirection="column" gap={1}>
        <Text>
          <Text bold>1.</Text> Line Numbers: <Text color="yellow">{String(settings.lineNumbers)}</Text>
          <Text dimColor> (Press 1 to toggle)</Text>
        </Text>
        
        <Text>
          <Text bold>2.</Text> Collapse Unchanged: <Text color="yellow">{settings.collapseUnchanged ? "ON" : "OFF"}</Text>
          <Text dimColor> (Press 2 to toggle)</Text>
        </Text>
        
        <Text>
          <Text bold>3.</Text> Streaming Mode: <Text color="yellow">{settings.streaming ? "ON" : "OFF"}</Text>
          <Text dimColor> (Press 3 to toggle)</Text>
        </Text>
        
        <Text>
          <Text bold>4.</Text> Stream Window Size: <Text color="yellow">{settings.streamWindow}</Text>
          <Text dimColor> (Press 4/Shift+4 to adjust)</Text>
        </Text>
      </Box>
      
      <Text> </Text>
      <Text dimColor italic>These settings affect all rendering modes</Text>
    </Box>
  );
}

// Render the app
render(<App />);
