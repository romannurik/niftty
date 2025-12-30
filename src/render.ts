/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import chalk from "chalk";

import { tokenize } from "./tokenize";
import type { Options } from "./types";

const DEFAULT_STREAMING_WINDOW = 20; // N lines centered on the current one

/**
 * Renders a code snippet using [shiki](https://shiki.style/), into an ANSI-encoded string that
 * can be written to `stdout`, e.g. using `process.stdout.write()`.
 */
export async function niftty(options: Options): Promise<string> {
  let { streaming, lineNumbers } = options;

  // Tokenize the code
  let { items, colors, lineDigits, maxCols, isDiff, currentLineIndex } =
    await tokenize(options);

  // Prepare set of chalks to paint with (from pre-computed colors)
  let normalBgChalk = chalk.bgHex(colors.background);
  let insertedLineBgChalk = chalk.bgHex(colors.insertedLineBackground);
  let insertedTextBgChalk = chalk.bgHex(colors.insertedTextBackground);
  let removedLineBgChalk = chalk.bgHex(colors.removedLineBackground);
  let removedTextBgChalk = chalk.bgHex(colors.removedTextBackground);
  let currentLineBgChalk = chalk.bgHex(colors.currentLineBackground);

  let out: string[] = [];

  // Render out each item
  for (let item of items) {
    // Handle collapsed sections
    if (item.type === "collapsed") {
      let prefix = "  "; // for the annotation
      if (lineNumbers === "both") {
        prefix += "".padEnd(2 * (lineDigits + 1), " ") + " ";
      } else if (lineNumbers) {
        prefix += "".padEnd(lineDigits + 1, " ") + " ";
      }
      let annotationChalk = normalBgChalk.hex(colors.lineNumberForeground);
      out.push(
        item.separatorText
          .split(/\n/g)
          .map((sepLine) =>
            annotationChalk(prefix + sepLine.padEnd(maxCols, " ") + "\n")
          )
          .join("")
      );
      // skip rendering
      continue;
    }

    // It's a RenderLine
    let { type, oldLineNumber, newLineNumber, tokens, specialText } = item;
    oldLineNumber ||= 0;
    newLineNumber ||= 0;

    let lineChalk = normalBgChalk;
    let markedTokenLineChalk = lineChalk;

    // Prepare prefixes
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
        lineChalk = removedLineBgChalk;
        markedTokenLineChalk = removedTextBgChalk;
        if (lineNumbers === "both") prefixLineNums[1] = 0;
        prefixAnnotation = "- ";
      } else if (type === "current") {
        lineChalk = markedTokenLineChalk = currentLineBgChalk;
        prefixAnnotation = "▶ ";
      } else if (type === "upcoming") {
        if (lineNumbers === "both") prefixLineNums[1] = 0;
      }
    } else if (lineNumbers) {
      prefixLineNums = [newLineNumber];
    }

    let annotationChalk = lineChalk.hex(colors.lineNumberForeground);

    // Render line prefixes
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
    } else if (specialText) {
      out.push(annotationChalk(specialText));
      col = specialText.length;
    } else {
      for (let token of tokens) {
        let bgChalk = token.marked ? markedTokenLineChalk : lineChalk;
        let tokenChalk = bgChalk.hex(token.color || colors.foreground);
        out.push(tokenChalk(token.content));
        col += token.content.length;
      }
    }

    // render out the rest of the line
    out.push(lineChalk(" ".repeat(Math.max(0, maxCols - col))) + "\n");
  }

  // if streaming, only return the streaming window (max. # of lines)
  if (streaming && currentLineIndex !== undefined) {
    let window =
      typeof streaming === "number" ? streaming : DEFAULT_STREAMING_WINDOW;
    let lines = out.join("").split(/\n/g);
    let start = 0;
    if (currentLineIndex > Math.floor(window / 2)) {
      start = currentLineIndex - Math.floor(window / 2);
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
