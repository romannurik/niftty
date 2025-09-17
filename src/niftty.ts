/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import chalk from "chalk";
import { diffLines, diffWordsWithSpace } from "diff";
import type * as shiki from "shiki"; // don't load shiki as a module globally to support CJS
import tinycolor from "tinycolor2";

type CollapseConfig = {
  padding: number;
  separator: (numCollapsedLines: number) => string;
};

/**
 * Options for rendering code snippet.
 */
type Options = {
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
const DEFAULT_STREAMING_WINDOW = 20; // N lines centered on the current one

const DEFAULT_INSERT_BG = "#17975f33";
const DEFAULT_REMOVE_BG = "#df404733";

/**
 * Renders a code snippet using [shiki](https://shiki.style/), into an ANSI-encoded string that
 * can be written to `stdout`, e.g. using `process.stdout.write()`.
 */
export async function niftty(options: Options): Promise<string> {
  let out: string[] = []; // terminal output

  let { streaming, lineNumbers } = options;

  // Prepare everything for rendering, producing a render context
  let {
    lineInfos,
    isDiff,
    collapseConfig,
    theme,
    lineDigits,
    maxCols,
    currentLineNumber,
    colorDefaultBackground: bg,
    colorDefaultForeground: fg,
  } = await prepareRender(options);

  // Render out the render context
  for (let i = 1; i < lineInfos.length; i++) {
    let lineInfo = (lineInfos[i] || {}) as Partial<LineInfo>;
    let { type, oldLineNumber, newLineNumber, marks, tokens } = lineInfo;
    oldLineNumber ||= 0;
    newLineNumber ||= 0;
    tokens ||= [];

    // prepare set of chalks to paint with
    let normalBgChalk = chalk.bgHex(flattenColors(bg));
    let insertedLineBgChalk = chalk.bgHex(
      flattenColors(
        theme.colors?.["diffEditor.insertedLineBackground"] ||
          DEFAULT_INSERT_BG,
        bg
      )
    );

    let insertedTextBgChalk = chalk.bgHex(
      flattenColors(
        theme.colors?.["diffEditor.insertedTextBackground"] ||
          DEFAULT_INSERT_BG,
        theme.colors?.["diffEditor.insertedLineBackground"] ||
          DEFAULT_INSERT_BG,
        bg
      )
    );
    let removedLineBgCheck = chalk.bgHex(
      flattenColors(
        theme.colors?.["diffEditor.removedLineBackground"] || DEFAULT_REMOVE_BG,
        bg
      )
    );
    let removedTextBgChalk = chalk.bgHex(
      flattenColors(
        theme.colors?.["diffEditor.removedTextBackground"] || DEFAULT_REMOVE_BG,
        theme.colors?.["diffEditor.removedLineBackground"] || DEFAULT_REMOVE_BG,
        bg
      )
    );
    let lineChalk = normalBgChalk;
    let markedTokenLineChalk = lineChalk;
    let annotationChalk = lineChalk.hex(
      flattenColors(
        theme.colors?.["editorLineNumber.foreground"] ||
          tinycolor.mix(bg || "#000", fg || "#fff", 50).toHexString(),
        bg
      )
    );

    // if this is a collapsed span, render the separator
    if (collapseConfig && lineInfo.collapse) {
      let prefix = "  "; // for the annotation
      if (lineNumbers === "both") {
        prefix += "".padEnd(2 * (lineDigits + 1), " ") + " ";
      } else if (lineNumbers) {
        prefix += "".padEnd(lineDigits + 1, " ") + " ";
      }
      out.push(
        collapseConfig
          .separator(lineInfo.collapse.length)
          .split(/\n/g)
          .map((sepLine) =>
            annotationChalk(prefix + sepLine.padEnd(maxCols, " ") + "\n")
          )
          .join("")
      );
      // skip rendering
      continue;
    }

    // prepare prefixes
    let prefixLineNums: number[] = [];
    let prefixAnnotation = "";
    if (isDiff) {
      prefixAnnotation = "  ";
      // prefix line with marking
      if (lineNumbers === true) {
        prefixLineNums = [streaming ? newLineNumber : oldLineNumber];
      } else if (lineNumbers === "both") {
        prefixLineNums = [oldLineNumber, newLineNumber];
      }
      if (type === "added") {
        lineChalk = insertedLineBgChalk;
        markedTokenLineChalk = insertedTextBgChalk;
        if (lineNumbers === "both") prefixLineNums[0] = 0;
        else if (lineNumbers) prefixLineNums[0] = 0;
        prefixAnnotation = "+ ";
      } else if (type === "removed") {
        lineChalk = removedLineBgCheck;
        markedTokenLineChalk = removedTextBgChalk;
        if (lineNumbers === "both") prefixLineNums[1] = 0;
        prefixAnnotation = "- ";
      } else if (type === "current") {
        lineChalk = markedTokenLineChalk = chalk.bgHex(
          flattenColors(
            tinycolor.mix(bg || "#000", fg || "#fff", 20).toHexString(),
            bg
          )
        );
        prefixAnnotation = "▶ ";
      } else if (type === "upcoming") {
        if (lineNumbers === "both") prefixLineNums[1] = 0;
      }
    } else if (lineNumbers) {
      prefixLineNums = [newLineNumber];
    }

    // update foreground based on the new background
    annotationChalk = lineChalk.hex(
      flattenColors(
        theme.colors?.["editorLineNumber.foreground"] ||
          tinycolor.mix(bg || "#000", fg || "#fff", 50).toHexString(),
        bg
      )
    );

    // render line prefixes
    out.push(
      annotationChalk(
        " " +
          prefixLineNums
            .map((n) => String(n || "").padEnd(lineDigits, " ") + " ")
            .join("") +
          prefixAnnotation
      )
    );

    // render the actual line, token by token, including marks (changed characters in a modified line)
    let col = 0;
    if (type === "upcoming") {
      let fullLine = tokens.map((t) => t.content).join("");
      out.push(annotationChalk(fullLine));
      col = fullLine.length;
    } else if (lineInfo.specialText) {
      out.push(annotationChalk(lineInfo.specialText));
      col = lineInfo.specialText.length;
    } else {
      for (let token of tokens) {
        let tokenChalk = lineChalk.hex(token.color || fg || "#fff");
        let markedTokenChalk = markedTokenLineChalk.hex(
          token.color || fg || "#fff"
        );
        let spanStart = 0;
        let inMark = false;
        // iterate the token character-by-character to see if any characters are marked
        for (let c = 0; c < token.content.length; c++) {
          if (marks?.[col + c] && !inMark) {
            // finish unmarked span
            spanStart !== c &&
              out.push(tokenChalk(token.content.substring(spanStart, c)));
            // start new span
            inMark = true;
            spanStart = c;
          } else if (!marks?.[col + c] && inMark) {
            // finish marked span
            spanStart !== c &&
              out.push(markedTokenChalk(token.content.substring(spanStart, c)));
            // start new span
            inMark = false;
            spanStart = c;
          }
        }
        out.push(
          (inMark ? markedTokenChalk : tokenChalk)(
            token.content.substring(spanStart)
          )
        );
        col += token.content.length;
      }
    }

    // render out the rest of the line
    out.push(lineChalk(" ".repeat(Math.max(0, maxCols - col))) + "\n");
  }

  // if streaming, only return the streaming window (max. # of lines)
  if (streaming) {
    let window =
      typeof streaming === "number" ? streaming : DEFAULT_STREAMING_WINDOW;
    let lines = out.join("").split(/\n/g);
    let start = 0;
    if (currentLineNumber > Math.floor(window / 2)) {
      start = currentLineNumber - Math.floor(window / 2);
    }
    if (start + window > lines.length) {
      start = Math.max(0, lines.length - window - 1);
    }
    return (
      lines.slice(start, start + window).join("\n") +
      // end with newline to match non-streaming behavior
      "\n"
    );
  }

  return out.join("");
}

/**
 * Does all the preparation work for rendering, including diffing, collapsing unchanged lines,
 * actual syntax highlighting (tokenizing + applying theme), and marking up modified lines.
 *
 * @returns Context needed for actual rendering.
 */
async function prepareRender({
  code,
  diffWith,
  collapseUnchanged,
  filePath,
  theme,
  streaming,
  lang,
  highlighter,
}: Options) {
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
  let result = highlighter.codeToTokens(to, {
    theme,
    lang: resolvedLang,
  });
  let colorDefaultForeground = result.fg || theme.colors?.["editorForeground"];
  let colorDefaultBackground = result.bg || theme.colors?.["editorBackground"];
  let beforeResult = isDiff
    ? highlighter.codeToTokens(from, { theme, lang: resolvedLang })
    : result;

  for (let i = 1; i < lineInfos.length; i++) {
    let lineInfo = (lineInfos[i] || {}) as Partial<LineInfo>;
    let { type, oldLineNumber, newLineNumber } = lineInfo;
    lineInfo.tokens =
      (type === "removed" || type === "upcoming"
        ? beforeResult.tokens[(oldLineNumber || 0) - 1]!
        : result.tokens[(newLineNumber || 0) - 1]!) || [];
  }

  // return context for actual rendering
  return {
    from,
    to,
    resolvedLang,
    theme,
    highlighter,
    lineInfos,
    isDiff,
    collapseConfig,
    maxLines,
    maxCols,
    lineDigits,
    currentLineNumber,
    colorDefaultForeground,
    colorDefaultBackground,
  };
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
