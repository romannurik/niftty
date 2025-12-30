import { forwardRef, useEffect, useMemo, useState } from "react";
import { tokenize, type Options, type RenderItem, type RenderLine, type TokenizedCode } from "niftty";
import styles from "./CodeRenderer.module.scss";

type Props = Omit<Options, "highlighter"> & {
  highlighter: NonNullable<Options["highlighter"]>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  className?: string;
};

export const CodeRenderer = forwardRef<HTMLDivElement, Props>(function CodeRenderer(props, ref) {
  const [tokenized, setTokenized] = useState<TokenizedCode | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancel = false;
    (async () => {
      const result = await tokenize(props);
      if (cancel) return;
      setTokenized(result);
      setExpandedSections(new Set());
    })();
    return () => {
      cancel = true;
    };
  }, [props.code, props.diffWith, props.theme, props.lang, props.collapseUnchanged, props.streaming, props.lineNumbers, props.highlighter]);

  const items = useMemo(() => {
    if (!tokenized) return [];
    const result: RenderItem[] = [];
    tokenized.items.forEach((item, index) => {
      if (item.type === "collapsed" && expandedSections.has(index)) {
        result.push(...item.lines);
      } else {
        result.push(item);
      }
    });
    return result;
  }, [tokenized, expandedSections]);

  if (!tokenized) {
    return <div className={styles.container}>Loading...</div>;
  }

  const { colors, lineDigits, isDiff } = tokenized;
  const showBothLineNumbers = props.lineNumbers === "both";

  const toggleSection = (originalIndex: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(originalIndex)) {
        next.delete(originalIndex);
      } else {
        next.add(originalIndex);
      }
      return next;
    });
  };

  const getOriginalIndex = (item: RenderItem): number => {
    return tokenized.items.indexOf(item);
  };

  return (
    <div
      ref={ref}
      className={`${styles.container} ${props.className || ""}`}
      style={{
        backgroundColor: colors.background,
        color: colors.foreground,
      }}
      onScroll={props.onScroll}
    >
      {items.map((item, index) => {
        if (item.type === "collapsed") {
          const originalIndex = getOriginalIndex(item);
          return (
            <div
              key={`collapsed-${index}`}
              className={styles.collapsedSection}
              onClick={() => toggleSection(originalIndex)}
              style={{ color: colors.lineNumberForeground }}
            >
              {item.separatorText}
            </div>
          );
        }

        return (
          <Line
            key={`line-${index}`}
            line={item}
            colors={colors}
            lineDigits={lineDigits}
            showLineNumbers={!!props.lineNumbers}
            showBothLineNumbers={showBothLineNumbers}
            isDiff={isDiff}
          />
        );
      })}
    </div>
  );
});

function Line({
  line,
  colors,
  lineDigits,
  showLineNumbers,
  showBothLineNumbers,
  isDiff,
}: {
  line: RenderLine;
  colors: TokenizedCode["colors"];
  lineDigits: number;
  showLineNumbers: boolean;
  showBothLineNumbers: boolean;
  isDiff: boolean;
}) {
  let backgroundColor: string | undefined;
  if (line.type === "added") {
    backgroundColor = colors.insertedLineBackground;
  } else if (line.type === "removed") {
    backgroundColor = colors.removedLineBackground;
  } else if (line.type === "current") {
    backgroundColor = colors.currentLineBackground;
  }

  const lineNumberStyle = { color: colors.lineNumberForeground };
  const formatLineNumber = (n?: number) =>
    n !== undefined ? String(n).padStart(lineDigits, " ") : " ".repeat(lineDigits);

  return (
    <div
      className={`${styles.line} ${line.type === "upcoming" ? styles.upcoming : ""}`}
      style={{ backgroundColor }}
    >
      {showLineNumbers && (
        <span className={styles.lineNumber} style={lineNumberStyle}>
          {showBothLineNumbers && isDiff ? (
            <>
              {formatLineNumber(line.oldLineNumber)} {formatLineNumber(line.newLineNumber)}
            </>
          ) : (
            formatLineNumber(line.newLineNumber ?? line.oldLineNumber)
          )}
        </span>
      )}
      <span className={styles.lineContent}>
        {line.specialText ? (
          <span style={{ color: colors.lineNumberForeground, fontStyle: "italic" }}>
            {line.specialText}
          </span>
        ) : (
          line.tokens.map((token, i) => {
            let tokenBackground: string | undefined;
            if (token.marked) {
              if (line.type === "added") {
                tokenBackground = colors.insertedTextBackground;
              } else if (line.type === "removed") {
                tokenBackground = colors.removedTextBackground;
              }
            }

            return (
              <span
                key={i}
                style={{
                  color: token.color,
                  backgroundColor: tokenBackground,
                  fontStyle: token.fontStyle === "italic" ? "italic" : undefined,
                  fontWeight: token.fontStyle === "bold" ? "bold" : undefined,
                  textDecoration: token.fontStyle === "underline" ? "underline" : undefined,
                }}
              >
                {token.content}
              </span>
            );
          })
        )}
      </span>
    </div>
  );
}
