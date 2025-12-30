/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as shiki from "shiki";

/**
 * Configuration for collapsing unchanged lines.
 */
export type CollapseConfig = {
  padding: number;
  separator: (numCollapsedLines: number) => string;
};

/**
 * Options for rendering code snippet.
 */
export type Options = {
  /**
   * The code to render.
   */
  code: string;
  /**
   * If specified, the code to diff against, for showing additions and removals.
   */
  diffWith?: string;
  /**
   * The language to use for syntax highlighting. If not provided, will be automatically detected
   * based on the file path.
   */
  lang?: shiki.BundledLanguage | shiki.SpecialLanguage;
  /**
   * The file path of the code, used to help with language detection if `lang` is not specified.
   */
  filePath?: string;
  /**
   * The named syntax highlighting theme or VSCode-compatible theme object.
   */
  theme: shiki.ThemeRegistration | shiki.BundledTheme;
  /**
   * When showing diffs, whether to collapse unchanged lines. If an object, configures the collapse
   * behavior.
   */
  collapseUnchanged?: boolean | Partial<CollapseConfig>;
  /**
   * Whether to render in "streaming" mode, typically used for showing code being generated or
   * edited (by regenerating with changes) by an LLM. In this mode, the last line is treated as the
   * "current" line being edited, and any remaining lines in the "after" code that haven't been
   * reached yet are dimmed.
   *
   * If this is a number, customizes the streaming window size, in number of lines.
   */
  streaming?: boolean | number;
  /**
   * If specified, the `shiki` highlighter instance to use. If not provided, a new instance will be
   * created. Use this if calling `niftty` in rapid succession.
   */
  highlighter?: shiki.Highlighter;
  /**
   * Whether to show line numbers. If `"both"`, shows both old and new line numbers.
   */
  lineNumbers?: boolean | "both";
};

/**
 * The type of a line in the rendered output.
 */
export type LineType = "default" | "added" | "removed" | "current" | "upcoming";

/**
 * A token with syntax highlighting information.
 */
export type RenderToken = {
  content: string;
  color?: string;
  fontStyle?: "italic" | "bold" | "underline";
  /**
   * Whether this token represents changed text (in a modified line).
   */
  marked?: boolean;
};

/**
 * A single line in the render output.
 */
export type RenderLine = {
  type: LineType;
  oldLineNumber?: number;
  newLineNumber?: number;
  tokens: RenderToken[];
  /**
   * Special text to show instead of tokens, e.g., "(added newline at end of file)".
   */
  specialText?: string;
};

/**
 * A collapsed section placeholder representing hidden unchanged lines.
 */
export type RenderCollapsedSection = {
  type: "collapsed";
  collapsedCount: number;
  lines: RenderLine[];
  /**
   * The separator text to display for this collapsed section.
   */
  separatorText: string;
};

/**
 * A line or collapsed section in the render output.
 */
export type RenderItem = RenderLine | RenderCollapsedSection;

/**
 * Theme colors extracted for custom renderers.
 */
export type ThemeColors = {
  foreground: string;
  background: string;
  insertedLineBackground: string;
  insertedTextBackground: string;
  removedLineBackground: string;
  removedTextBackground: string;
  lineNumberForeground: string;
  /**
   * Background color for the "current" line in streaming mode.
   */
  currentLineBackground: string;
};

/**
 * The complete tokenized code data structure for custom rendering.
 */
export type TokenizedCode = {
  items: RenderItem[];
  colors: ThemeColors;
  lineDigits: number;
  maxCols: number;
  isDiff: boolean;
  isStreaming: boolean;
  currentLineIndex?: number;
};
