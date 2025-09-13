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

type Options = {
  code: string;
  lang?: shiki.BundledLanguage | shiki.SpecialLanguage;
  theme: shiki.ThemeRegistration | shiki.BundledTheme;
  diffWith?: string;
  collapseUnchanged?: boolean | Partial<CollapseConfig>;
  filePath?: string;
  streaming?: boolean | number;
  highlighter?: shiki.Highlighter;
  lineNumbers?: boolean | "both";
};

// only for interesting lines (i.e. added/removed/modified)
type LineInfo = {
  type: "added" | "removed";
  /**
   * Sparse array of per-character modification marks, maps to true if the character at
   * the given index into the array has a mark
   */
  marks?: (true | undefined)[];
};

const DEFAULT_COLLAPSE_PADDING = 3;
const DEFAULT_COLLAPSE_SEPARATOR = (n: number) => `--- ${n} unchanged ---`;
const DEFAULT_STREAMING_WINDOW = 20; // N lines centered on the current one

const DEFAULT_INSERT_BG = "#17975f33";
const DEFAULT_REMOVE_BG = "#df404733";

/**
 * Renders a syntax-highlighted code snippet using [shiki](https://shiki.style/), in a "streaming"
 * style, typically used for showing code being generated or edited (by regenerating with changes)
 * by an LLM. Syntax highlighting is powered by the same engine and with the same automatic language
 * detection logic as the `CodeSnippet` component.
 */
export async function niftty({
  code,
  diffWith,
  collapseUnchanged,
  filePath,
  theme,
  streaming,
  lang,
  lineNumbers,
  highlighter,
}: Options): Promise<string> {
  let out: string[] = [];

  // do this here to support CJS
  const shiki = await import("shiki");

  let resolvedLang = resolveLang(lang, filePath, shiki.bundledLanguagesInfo); // TODO: resolve based on filePath (common language extensions) and code (magika)
  highlighter =
    highlighter ||
    (await shiki.createHighlighter({
      langs: [resolvedLang],
      themes: [theme],
    }));

  if (typeof theme === "string") {
    theme = highlighter.getTheme(theme);
  }

  let isDiff = diffWith !== undefined;
  let from = diffWith || "";
  let to = code;

  if (!from.endsWith("\n")) from += "\n";
  if (!to.endsWith("\n")) to += "\n";
  let fromLines = from.split(/\n/g);
  let toLines = to.split(/\n/g);
  let fromLinesToDiff = toLines.length + 3;
  let changes = diffLines(fromLines.slice(0, fromLinesToDiff).join("\n"), to);
  let upcomingLines = streaming ? fromLines.slice(fromLinesToDiff) : [];
  let numLines = (Math.max(fromLines.length, toLines.length) || 1) + 1;
  let numColumns =
    Math.max(
      ...toLines.map((l) => l.length),
      ...fromLines.map((l) => l.length),
      1
    ) + 1; // extra padding on the right
  let lineDigits = String(numLines).length;

  let lastChange = changes.at(-1);
  let secondToLastChange = changes.at(-2);

  // if we see a "removed" block followed by an "added" block, or just a "removed" block,
  // it typically means we just haven't reached that part of the file yet... treat the removed
  // block as simply part of the "after" block
  if (streaming) {
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
  let lineInfo: Record<number, LineInfo> = {};
  let lineNumber = 1;
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
        let fromLine = lineNumber;
        let fromCol = 0;
        let toLine = lineNumber + numLines;
        let toCol = 0;
        for (let innerChange of innerChanges) {
          while (true) {
            lineInfo[fromLine] ||= { type: "removed" };
            lineInfo[toLine] ||= { type: "added" };
            let newlineIndex = innerChange.value.indexOf("\n");
            let innerValue =
              newlineIndex >= 0
                ? innerChange.value.substring(0, newlineIndex)
                : innerChange.value;
            if (innerChange.removed) {
              for (let c = 0; c < innerValue.length; c++) {
                lineInfo[fromLine]!.marks ||= [];
                lineInfo[fromLine]!.marks![fromCol] = true;
                ++fromCol;
              }
            } else if (innerChange.added) {
              for (let c = 0; c < innerValue.length; c++) {
                lineInfo[toLine]!.marks ||= [];
                lineInfo[toLine]!.marks![toCol] = true;
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
                ++fromLine;
                fromCol = 0;
              } else if (innerChange.added) {
                ++toLine;
                toCol = 0;
              } else {
                ++fromLine;
                ++toLine;
                fromCol = 0;
                toCol = 0;
              }
              continue;
            }
            break;
          }
        }
        // skip over the next change, we've already processed it
        lineNumber += nextChange.count || 0;
        ++i;
      } else if (change.added || change.removed) {
        // simply mark up a new or removed line, not a modified line
        for (let l = 0; l < numLines; l++) {
          lineInfo[lineNumber + l] = {
            type: change.added ? "added" : "removed",
          };
        }
      }
      lineNumber += numLines;
    }
  }

  let currentLineNumber = lineNumber - 1;

  const codeToHighlight = isDiff
    ? changes.map((c) => c.value).join("") +
      (upcomingLines.length ? upcomingLines.join("\n") : "")
    : code;
  const result = highlighter.codeToTokens(codeToHighlight, {
    theme,
    lang: resolvedLang,
  });
  let collapse: CollapseConfig | false = false;
  if (collapseUnchanged) {
    collapse = {
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
  let prevChangedLineNumber = 0; // in displayed line space
  let unchangedLineCount: number | undefined; // after the previous added/removed line's line number

  let oldLineNumber = 0; // in original line space
  let newLineNumber = 0; // in original line space
  for (let lineNumber = 1; lineNumber <= result.tokens.length; lineNumber++) {
    let lineType: "default" | "added" | "removed" | "current" | "upcoming" =
      "default";
    if (lineNumber === currentLineNumber && streaming) {
      lineType = "current";
      ++oldLineNumber;
      ++newLineNumber;
    } else if (lineNumber > currentLineNumber && streaming) {
      lineType = "upcoming";
      ++oldLineNumber;
      ++newLineNumber;
    } else if (lineInfo[lineNumber] && isDiff) {
      if (lineInfo[lineNumber]?.type === "added") {
        lineType = "added";
        ++newLineNumber;
        prevChangedLineNumber = lineNumber;
        unchangedLineCount = undefined;
      } else if (lineInfo[lineNumber]?.type === "removed") {
        lineType = "removed";
        ++oldLineNumber;
        prevChangedLineNumber = lineNumber;
        unchangedLineCount = undefined;
      }
    } else {
      ++oldLineNumber;
      ++newLineNumber;
    }

    let fg = result.fg || theme.colors?.["editorForeground"];
    let bg = result.bg || theme.colors?.["editorBackground"];
    let normalBgChalk = chalk.bgHex(flattenColors(result.bg));
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

    if (lineType === "default" && isDiff && collapse) {
      // logic to collapse unchanged lines in diffs
      let shouldCollapse = false;
      if (unchangedLineCount === undefined) {
        // prepare span
        let i = lineNumber;
        for (; i <= result.tokens.length; i++) {
          if (
            lineInfo[i]?.type === "added" ||
            lineInfo[i]?.type === "removed"
          ) {
            unchangedLineCount = i - lineNumber;
            break;
          }
        }
        if (unchangedLineCount === undefined) {
          // collapse lines at the end
          unchangedLineCount = i - lineNumber + collapse.padding;
        }
      }
      let indexInCollapseSpan = lineNumber - prevChangedLineNumber;
      if (prevChangedLineNumber === 0) {
        // collapse logic at the start is different than everywhere else
        shouldCollapse =
          indexInCollapseSpan <= unchangedLineCount - collapse.padding;
      } else {
        shouldCollapse =
          indexInCollapseSpan > collapse.padding &&
          indexInCollapseSpan <= unchangedLineCount - collapse.padding;
      }
      if (shouldCollapse) {
        // skip rendering
        let firstInCollapseSpan =
          prevChangedLineNumber === 0
            ? lineNumber === 1 // special case: collapsing at the start
            : indexInCollapseSpan === collapse.padding + 1;
        if (firstInCollapseSpan) {
          // render collapse marker
          let prefix = "  "; // for the annotation
          if (lineNumbers === "both") {
            prefix += "".padEnd(2 * (lineDigits + 1), " ") + " ";
          } else if (lineNumbers) {
            prefix += "".padEnd(lineDigits + 1, " ") + " ";
          }
          let unchanged =
            unchangedLineCount -
            collapse.padding * (prevChangedLineNumber === 0 ? 1 : 2);
          collapse
            .separator(unchanged)
            .split(/\n/g)
            .forEach((sepLine) =>
              out.push(
                annotationChalk(prefix + sepLine.padEnd(numColumns, " ") + "\n")
              )
            );
        }
        continue;
      }
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
      if (lineType === "added") {
        lineChalk = insertedLineBgChalk;
        markedTokenLineChalk = insertedTextBgChalk;
        if (lineNumbers === "both") prefixLineNums[0] = 0;
        prefixAnnotation = "+ ";
      } else if (lineType === "removed") {
        lineChalk = removedLineBgCheck;
        markedTokenLineChalk = removedTextBgChalk;
        if (lineNumbers === "both") prefixLineNums[1] = 0;
        prefixAnnotation = "- ";
      } else if (lineType === "current") {
        lineChalk = markedTokenLineChalk = chalk.bgHex(
          flattenColors(
            tinycolor.mix(bg || "#000", fg || "#fff", 20).toHexString(),
            bg
          )
        );
        prefixAnnotation = "▶ ";
      }
    } else if (lineNumbers) {
      prefixLineNums = [newLineNumber];
    }

    // update foreground baesd on the new background
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
    let lineTokens = result.tokens[lineNumber - 1]!;
    let col = 0;
    if (lineType === "upcoming") {
      let fullLine = lineTokens.map((t) => t.content).join("");
      out.push(annotationChalk(fullLine));
      col = fullLine.length;
    } else {
      let marksForLine = lineInfo[lineNumber]?.marks;
      for (let token of lineTokens) {
        let tokenChalk = lineChalk;
        let markedTokenChalk = markedTokenLineChalk;
        if (token.color) {
          tokenChalk = lineChalk.hex(token.color);
          markedTokenChalk = markedTokenLineChalk.hex(token.color);
        }
        let spanStart = 0;
        let inMark = false;
        // iterate the token character-by-character to see if any characters are marked
        for (let c = 0; c < token.content.length; c++) {
          if (marksForLine?.[col + c] && !inMark) {
            // finish unmarked span
            spanStart !== c &&
              out.push(tokenChalk(token.content.substring(spanStart, c)));
            // start new span
            inMark = true;
            spanStart = c;
          } else if (!marksForLine?.[col + c] && inMark) {
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
    out.push(lineChalk(" ".repeat(Math.max(0, numColumns - col))) + "\n");
  }

  if (streaming) {
    // only return the streaming window
    let window =
      typeof streaming === "number" ? streaming : DEFAULT_STREAMING_WINDOW;
    let lines = out.join("").split(/\n/g);
    let start = 0;
    if (currentLineNumber > Math.floor(window / 2)) {
      start = currentLineNumber - Math.floor(window / 2);
    }
    if (start + window > lines.length) {
      start = Math.max(0, lines.length - window);
    }
    return lines.slice(start, start + window).join("\n");
  }

  return out.join("");
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
