/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { diffLines, diffWordsWithSpace } from "diff";
import type * as shiki from "shiki";
import tinycolor from "tinycolor2";

import type {
  CollapseConfig,
  LineType,
  Options,
  RenderItem,
  RenderLine,
  RenderToken,
  ThemeColors,
  TokenizedCode,
} from "./types";

type LineInfo = {
  type:
    | "default"
    // diff-only
    | "added"
    | "removed"
    // streaming-only
    | "current"
    | "upcoming";
  newLineNumber?: number;
  oldLineNumber?: number;
  collapse?: LineInfo[]; // this is a collapse of the given lines
  tokens?: shiki.ThemedToken[];
  /**
   * Sparse array of per-character modification marks, maps to true if the character at
   * the given index into the array has a mark
   */
  marks?: (true | undefined)[];
  specialText?: string; // special text to show instead of tokens, e.g. "added newline"
};

const DEFAULT_COLLAPSE_PADDING = 3;
const DEFAULT_COLLAPSE_SEPARATOR = (n: number) => `--- ${n} unchanged ---`;

const DEFAULT_INSERT_BG = "#17975f33";
const DEFAULT_REMOVE_BG = "#df404733";

/**
 * Prepares code/diff for rendering, returning an intermediate data structure
 * that can be used for custom rendering (HTML, React, etc.). Does all the prep work for
 * rendering, including diffing, collapsing unchanged lines, actual syntax highlighting
 * (tokenizing + applying theme), and marking up modified lines.
 */
export async function tokenize({
  code,
  diffWith,
  collapseUnchanged,
  filePath,
  theme,
  streaming,
  lang,
  highlighter,
}: Options): Promise<TokenizedCode> {
  // load shiki here to support CJS
  const shiki = await import("shiki");

  let resolvedLang = resolveLang(lang, filePath, shiki.bundledLanguagesInfo);
  highlighter =
    highlighter ||
    (await shiki.createHighlighter({
      langs: [resolvedLang],
      themes: [theme],
    }));

  if (typeof theme === "string") {
    // we need to access theme vars directly, so for named themes, get the theme object
    theme = highlighter.getTheme(theme);
  }

  // prep vars
  let isDiff = diffWith !== undefined;
  let isStreaming = !!streaming;
  let from = diffWith || "";
  let to = code;

  let fromNewlineEOF = true,
    toNewlineEOF = true;
  if (!from.endsWith("\n")) {
    from += "\n";
    fromNewlineEOF = false;
  }
  if (!to.endsWith("\n")) {
    to += "\n";
    toNewlineEOF = false;
  }
  let fromLines = from.split(/\n/g);
  let toLines = to.split(/\n/g);
  let fromLinesToDiff = streaming ? toLines.length + 3 : fromLines.length;
  let changes = diffLines(fromLines.slice(0, fromLinesToDiff).join("\n"), to);
  let maxLines = (Math.max(fromLines.length, toLines.length) || 1) + 1;
  let maxCols =
    Math.max(
      ...toLines.map((l) => l.length),
      ...fromLines.map((l) => l.length),
      1
    ) + 1; // extra padding on the right
  let lineDigits = String(maxLines).length;
  let lastChange = changes.at(-1);
  let secondToLastChange = changes.at(-2);

  // collapse config prep
  let collapseConfig: CollapseConfig | undefined = undefined;
  if (collapseUnchanged && isDiff && !streaming) {
    collapseConfig = {
      separator:
        collapseUnchanged === true || collapseUnchanged.separator === undefined
          ? DEFAULT_COLLAPSE_SEPARATOR
          : collapseUnchanged.separator,
      padding:
        collapseUnchanged === true || collapseUnchanged.padding === undefined
          ? DEFAULT_COLLAPSE_PADDING
          : collapseUnchanged.padding,
    };
  }

  // streaming-specific prep
  let upcomingLines: string[] = [];
  if (streaming) {
    upcomingLines = fromLines.slice(fromLinesToDiff);

    // if we see a "removed" block followed by an "added" block, or just a "removed" block,
    // it typically means we just haven't reached that part of the file yet... treat the removed
    // block as simply part of the "after" block
    if (lastChange?.added && secondToLastChange?.removed) {
      let added = lastChange;
      let [removed] = changes.splice(changes.length - 2, 1);
      if (removed?.value.startsWith(added.value.replace(/\n$/, ""))) {
        removed.value = removed.value.substring(
          removed.value.indexOf("\n") + 1
        );
      }
      upcomingLines = [removed!.value, ...upcomingLines];
    } else if (lastChange?.removed) {
      let [removed] = changes.splice(changes.length - 1, 1);
      upcomingLines = [removed!.value, ...upcomingLines];
    }
  }

  // convert the set of changes into a list of lines in prep for rendering
  let lineInfos: LineInfo[] = []; // first element always empty
  let unifiedLineNumber = 1; // in unified space
  let oldLineNumber = 1; // in original line space
  let newLineNumber = 1; // in original line space
  if (isDiff) {
    for (let i = 0; i < changes.length; i++) {
      let change = changes[i]!;
      let nextChange = changes[i + 1];
      let numLines = change.count || 0;
      if (change.removed && nextChange?.added) {
        // removed followed by added means a block was modified... process this
        // differently
        let innerChanges = diffWordsWithSpace(
          change.value.replace(/\n$/, ""),
          nextChange.value.replace(/\n$/, "")
        );
        let fromUnifiedLine = unifiedLineNumber;
        let fromCol = 0;
        let toUnifiedLine = unifiedLineNumber + numLines;
        let toCol = 0;
        for (let innerChange of innerChanges) {
          while (true) {
            lineInfos[fromUnifiedLine] ||= { type: "removed", oldLineNumber };
            lineInfos[toUnifiedLine] ||= { type: "added", newLineNumber };
            let newlineIndex = innerChange.value.indexOf("\n");
            let innerValue =
              newlineIndex >= 0
                ? innerChange.value.substring(0, newlineIndex)
                : innerChange.value;
            if (innerChange.removed) {
              for (let c = 0; c < innerValue.length; c++) {
                lineInfos[fromUnifiedLine]!.marks ||= [];
                lineInfos[fromUnifiedLine]!.marks![fromCol] = true;
                ++fromCol;
              }
            } else if (innerChange.added) {
              for (let c = 0; c < innerValue.length; c++) {
                lineInfos[toUnifiedLine]!.marks ||= [];
                lineInfos[toUnifiedLine]!.marks![toCol] = true;
                ++toCol;
              }
            } else {
              fromCol += innerValue.length;
              toCol += innerValue.length;
            }

            // the inner change crossed line boundaries, process the next line
            if (newlineIndex >= 0) {
              innerChange.value = innerChange.value.substring(newlineIndex + 1);
              if (innerChange.removed) {
                ++fromUnifiedLine;
                ++oldLineNumber;
                ++unifiedLineNumber;
                fromCol = 0;
              } else if (innerChange.added) {
                ++toUnifiedLine;
                ++newLineNumber;
                ++unifiedLineNumber;
                toCol = 0;
              } else {
                ++fromUnifiedLine;
                ++oldLineNumber;
                ++toUnifiedLine;
                ++newLineNumber;
                ++unifiedLineNumber;
                fromCol = 0;
                toCol = 0;
              }
              continue;
            }
            break;
          }
        }
        // skip over the next change, we've already processed it
        unifiedLineNumber = toUnifiedLine + 1;
        ++oldLineNumber;
        ++newLineNumber;
        ++i;
      } else if (change.added || change.removed) {
        // simply mark up a new or removed line, not a modified line
        for (let l = 0; l < numLines; l++) {
          lineInfos[unifiedLineNumber] = {
            type: change.added ? "added" : "removed",
            oldLineNumber: change.removed ? oldLineNumber : undefined,
            newLineNumber: change.added ? newLineNumber : undefined,
          };
          ++unifiedLineNumber;
          if (change.added) {
            ++newLineNumber;
          } else if (change.removed) {
            ++oldLineNumber;
          }
        }
      } else {
        for (let l = 0; l < numLines; l++) {
          lineInfos[unifiedLineNumber] = {
            type: "default",
            oldLineNumber,
            newLineNumber,
          };
          ++oldLineNumber;
          ++newLineNumber;
          ++unifiedLineNumber;
        }
      }
    }
  } else {
    for (let l = 0; l < toLines.length; l++) {
      lineInfos[l + 1] = {
        type: "default",
        newLineNumber: newLineNumber++,
      };
    }
    unifiedLineNumber = toLines.length + 1;
  }

  // mark upcoming lines
  let currentLineNumber = unifiedLineNumber - 1;
  if (streaming) {
    // current line
    lineInfos[currentLineNumber]!.type = "current";
    lineInfos[currentLineNumber]!.oldLineNumber = oldLineNumber;
    ++oldLineNumber;
    // upcoming lines
    for (let l = 1; l < upcomingLines.length; l++) {
      lineInfos[unifiedLineNumber] = {
        type: "upcoming",
        oldLineNumber,
      };
      ++unifiedLineNumber;
      ++oldLineNumber;
    }
  }

  // mark collapsed lines
  if (collapseConfig) {
    let pos = -1;
    while (pos < lineInfos.length) {
      // find the next span of unchanged lines
      let start = lineInfos.findIndex(
        (l, i) => i > pos && l?.type === "default"
      );
      if (start < 0) break; // no more unchanged lines
      let end = lineInfos.findIndex(
        (l, i) => i > start && l?.type !== "default"
      );
      if (end < 0) end = lineInfos.length;
      pos = end;
      // except at the beginning of the file, show N lines of padding
      if (start !== 1) start += collapseConfig.padding;
      // except at the end of the file, show N lines of padding
      if (end !== lineInfos.length) end -= collapseConfig.padding;
      // if nothing to collapse, move on to the next span
      if (end <= start) continue;
      // collapse these lines
      lineInfos[start] = {
        type: "default",
        collapse: lineInfos.slice(start, end),
      };
      lineInfos.splice(start + 1, end - start - 1);
      pos = start + 1;
    }
  }

  // special treatment for EOF newlines
  if (fromNewlineEOF !== toNewlineEOF) {
    let specialText = toNewlineEOF
      ? "(added newline at end of file)"
      : "(removed newline at end of file)";
    lineInfos.push({
      type: toNewlineEOF ? "added" : "removed",
      specialText,
    });
    maxCols = Math.max(maxCols, specialText.length + 1);
  }

  // actually do syntax highlighting and assign line tokens for each line
  let result = highlighter.codeToTokens(to, { theme, lang: resolvedLang });
  let fg = result.fg || theme.colors?.["editorForeground"];
  let bg = result.bg || theme.colors?.["editorBackground"];
  let beforeResult = isDiff
    ? highlighter.codeToTokens(from, { theme, lang: resolvedLang })
    : result;

  const assignTokens = (lineInfo: Partial<LineInfo>) => {
    let { type, oldLineNumber, newLineNumber } = lineInfo;
    lineInfo.tokens =
      (type === "removed" || type === "upcoming"
        ? beforeResult.tokens[(oldLineNumber || 0) - 1]!
        : result.tokens[(newLineNumber || 0) - 1]!) || [];
  };

  for (let i = 1; i < lineInfos.length; i++) {
    let lineInfo = (lineInfos[i] || {}) as Partial<LineInfo>;
    assignTokens(lineInfo);
    if (lineInfo.collapse) {
      for (let collapsedLine of lineInfo.collapse) {
        assignTokens(collapsedLine);
      }
    }
  }

  // Build theme colors
  let colors: ThemeColors = {
    foreground: flattenColors(fg),
    background: flattenColors(bg),
    insertedLineBackground: flattenColors(
      theme.colors?.["diffEditor.insertedLineBackground"] || DEFAULT_INSERT_BG,
      bg
    ),
    insertedTextBackground: flattenColors(
      theme.colors?.["diffEditor.insertedTextBackground"] || DEFAULT_INSERT_BG,
      theme.colors?.["diffEditor.insertedLineBackground"] || DEFAULT_INSERT_BG,
      bg
    ),
    removedLineBackground: flattenColors(
      theme.colors?.["diffEditor.removedLineBackground"] || DEFAULT_REMOVE_BG,
      bg
    ),
    removedTextBackground: flattenColors(
      theme.colors?.["diffEditor.removedTextBackground"] || DEFAULT_REMOVE_BG,
      theme.colors?.["diffEditor.removedLineBackground"] || DEFAULT_REMOVE_BG,
      bg
    ),
    lineNumberForeground: flattenColors(
      theme.colors?.["editorLineNumber.foreground"] ||
        tinycolor.mix(bg || "#000", fg || "#fff", 50).toHexString(),
      bg
    ),
    currentLineBackground: flattenColors(
      tinycolor.mix(bg || "#000", fg || "#fff", 20).toHexString(),
      bg
    ),
  };

  // Convert LineInfo[] to RenderItem[]
  let items: RenderItem[] = [];
  let currentLineIndex: number | undefined;

  for (let i = 1; i < lineInfos.length; i++) {
    let lineInfo = (lineInfos[i] || {}) as Partial<LineInfo>;

    if (collapseConfig && lineInfo.collapse) {
      let collapsedLines: RenderLine[] = lineInfo.collapse.map((li) =>
        convertLineInfoToRenderLine(li)
      );
      items.push({
        type: "collapsed",
        collapsedCount: lineInfo.collapse.length,
        lines: collapsedLines,
        separatorText: collapseConfig.separator(lineInfo.collapse.length),
      });
      continue;
    }

    let renderLine = convertLineInfoToRenderLine(lineInfo as LineInfo);
    if (renderLine.type === "current") {
      currentLineIndex = items.length;
    }
    items.push(renderLine);
  }

  return {
    items,
    colors,
    lineDigits,
    maxCols,
    isDiff,
    isStreaming,
    currentLineIndex,
  };
}

function convertLineInfoToRenderLine(lineInfo: LineInfo): RenderLine {
  let marks = lineInfo.marks;
  let tokens: RenderToken[] = [];
  let col = 0;

  for (let t of lineInfo.tokens || []) {
    let baseToken: Omit<RenderToken, "content" | "marked"> = {};
    if (t.color) baseToken.color = t.color;
    if (t.fontStyle) {
      if (t.fontStyle & 1) baseToken.fontStyle = "italic";
      else if (t.fontStyle & 2) baseToken.fontStyle = "bold";
      else if (t.fontStyle & 4) baseToken.fontStyle = "underline";
    }

    if (!marks) {
      tokens.push({ ...baseToken, content: t.content });
    } else {
      let spanStart = 0;
      let inMark = !!marks[col];
      for (let c = 0; c <= t.content.length; c++) {
        let isMarked = c < t.content.length ? !!marks[col + c] : !inMark;
        if (isMarked !== inMark || c === t.content.length) {
          if (c > spanStart) {
            let token: RenderToken = {
              ...baseToken,
              content: t.content.substring(spanStart, c),
            };
            if (inMark) token.marked = true;
            tokens.push(token);
          }
          inMark = isMarked;
          spanStart = c;
        }
      }
    }
    col += t.content.length;
  }

  let result: RenderLine = {
    type: lineInfo.type as LineType,
    tokens,
  };

  if (lineInfo.oldLineNumber !== undefined) {
    result.oldLineNumber = lineInfo.oldLineNumber;
  }
  if (lineInfo.newLineNumber !== undefined) {
    result.newLineNumber = lineInfo.newLineNumber;
  }
  if (lineInfo.specialText) {
    result.specialText = lineInfo.specialText;
  }

  return result;
}

function flattenColors(...colors: Array<string | undefined>) {
  let color: tinycolor.Instance | undefined = undefined;
  for (let c of colors.reverse()) {
    if (!c) continue;
    let tc = tinycolor(c);
    if (tc.getAlpha() !== 1) {
      color = tinycolor.mix(
        color || tinycolor("#000"),
        tc,
        tc.getAlpha() * 100
      );
    } else {
      color = tc;
    }
  }
  return color ? color.toHexString() : "#000";
}

function resolveLang(
  lang: shiki.BundledLanguage | shiki.SpecialLanguage | undefined,
  filePath: string | undefined,
  bundledLanguagesInfo: typeof shiki.bundledLanguagesInfo
): shiki.BundledLanguage | shiki.SpecialLanguage {
  if (lang) return lang;
  if (filePath) {
    let ext = String(filePath).split(".").pop();
    for (let info of bundledLanguagesInfo) {
      if (info.id === ext || info.aliases?.includes(ext || "")) {
        return info.id as shiki.BundledLanguage;
      }
    }
  }
  return "txt";
}
