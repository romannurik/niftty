import { forwardRef, useMemo } from "react";
import { parseAnsiSequences, createColorPalette } from "ansi-sequence-parser";
import styles from "./AnsiRenderer.module.scss";

type Props = {
  ansi: string;
  className?: string;
  onScroll?: React.UIEventHandler<HTMLPreElement>;
  backgroundColor?: string;
  foregroundColor?: string;
};

const colorPalette = createColorPalette();

function ansiToHtml(ansi: string): string {
  const tokens = parseAnsiSequences(ansi);
  const result: string[] = [];

  for (const token of tokens) {
    const styleAttrs: string[] = [];

    if (token.foreground) {
      styleAttrs.push(`color:${colorPalette.value(token.foreground)}`);
    }
    if (token.background) {
      styleAttrs.push(`background-color:${colorPalette.value(token.background)}`);
    }
    if (token.decorations.has("bold")) {
      styleAttrs.push("font-weight:bold");
    }
    if (token.decorations.has("italic")) {
      styleAttrs.push("font-style:italic");
    }
    if (token.decorations.has("underline")) {
      styleAttrs.push("text-decoration:underline");
    }

    const escaped = token.value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    if (styleAttrs.length > 0) {
      result.push(`<span style="${styleAttrs.join(";")}">${escaped}</span>`);
    } else {
      result.push(escaped);
    }
  }

  return result.join("");
}

export const AnsiRenderer = forwardRef<HTMLPreElement, Props>(
  function AnsiRenderer({ ansi, className, onScroll, backgroundColor, foregroundColor }, ref) {
    const html = useMemo(() => ansiToHtml(ansi), [ansi]);

    return (
      <pre
        ref={ref}
        className={`${styles.container} ${className || ""}`}
        style={{ backgroundColor, color: foregroundColor }}
        onScroll={onScroll}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
);
