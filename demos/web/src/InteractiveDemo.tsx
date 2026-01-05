import { useEffect, useRef, useState } from "react";
import { createHighlighter } from "shiki";
import { niftty, tokenize, type ThemeColors } from "niftty";
import { CodeRenderer } from "./CodeRenderer";
import { AnsiRenderer } from "./AnsiRenderer";
import * as shiki from "shiki";
import {
  Button,
  Select,
  Switch,
  Text,
  SegmentedControl,
  Flex,
  Code,
  Card,
} from "@radix-ui/themes";
import styles from "./InteractiveDemo.module.scss";

export const DEFAULT_THEME = "houston";

const DEMO_CHUNK_SIZE = [15, 30] as const;
const DEMO_CHUNK_DELAY = [0, 30] as const;
const STREAM_WINDOW = 15;

export function InteractiveDemo() {
  const [before, setBefore] = useState<string>("Loading...");
  const [after, setAfter] = useState<string>("Loading...");
  const [theme, setTheme] = useState<string>(DEFAULT_THEME);
  const [highlighter, setHighlighter] = useState<shiki.Highlighter>();
  const [collapse, setCollapse] = useState(true);
  const [renderMode, setRenderMode] = useState<"ansi" | "dom">("ansi");
  const [ansiOutput, setAnsiOutput] = useState<string>("");
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null);

  const [streaming, setStreaming] = useState(false);
  const [streamingCode, setStreamingCode] = useState<string | null>(null);
  const streamingCodeRef = useRef<string | null>(null);
  streamingCodeRef.current = streamingCode;

  const lastScrollSyncRef = useRef<{
    source: "left" | "right" | "ansi" | "dom";
    time: number;
  }>({ source: "left", time: 0 });

  const editorLeft = useRef<HTMLTextAreaElement>(null);
  const editorRight = useRef<HTMLTextAreaElement>(null);
  const ansiRendererRef = useRef<HTMLPreElement>(null);
  const domRendererRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [BEFORE, AFTER] = await Promise.all([
        fetch("fs/before").then((res) => res.text()),
        fetch("fs/after").then((res) => res.text()),
      ]);
      setBefore(BEFORE);
      setAfter(AFTER);
    })();
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      let highlighter = await createHighlighter({
        langs: ["tsx", "typescript"],
        themes: [theme],
      });
      if (cancel) return;
      setHighlighter(highlighter);

      const { colors } = await tokenize({
        highlighter,
        code: "",
        lang: "tsx",
        theme: theme as shiki.ThemeRegistrationAny,
      });
      if (cancel) return;
      setThemeColors(colors);
    })();
    return () => {
      cancel = true;
    };
  }, [theme]);

  const syncScroll = (
    pctScroll: number,
    source: "left" | "right" | "ansi" | "dom"
  ) => {
    if (streamingCodeRef.current) return;
    if (
      lastScrollSyncRef.current.source !== source &&
      lastScrollSyncRef.current.time > Date.now() - 500
    ) {
      return;
    }
    lastScrollSyncRef.current = { source, time: Date.now() };
    if (source !== "ansi" && ansiRendererRef.current) {
      ansiRendererRef.current.scrollTop =
        (ansiRendererRef.current.scrollHeight -
          ansiRendererRef.current.clientHeight) *
        pctScroll;
    }
    if (source !== "dom" && domRendererRef.current) {
      domRendererRef.current.scrollTop =
        (domRendererRef.current.scrollHeight -
          domRendererRef.current.clientHeight) *
        pctScroll;
    }
    if (source !== "left" && editorLeft.current) {
      editorLeft.current.scrollTop =
        (editorLeft.current.scrollHeight - editorLeft.current.clientHeight) *
        pctScroll;
    }
    if (source !== "right" && editorRight.current) {
      editorRight.current.scrollTop =
        (editorRight.current.scrollHeight - editorRight.current.clientHeight) *
        pctScroll;
    }
  };

  useEffect(() => {
    if (!streaming || !highlighter) return;
    let cancel = false;
    setStreamingCode("");
    (async () => {
      let length = 0;
      while (!cancel && length < after.length) {
        length +=
          DEMO_CHUNK_SIZE[0] +
          Math.floor(Math.random() * (DEMO_CHUNK_SIZE[1] - DEMO_CHUNK_SIZE[0]));
        let curAfter = after.substring(0, length);
        setStreamingCode(curAfter);

        await new Promise((resolve) => {
          setTimeout(
            resolve,
            DEMO_CHUNK_DELAY[0] +
              Math.floor(
                Math.random() * (DEMO_CHUNK_DELAY[1] - DEMO_CHUNK_DELAY[0])
              )
          );
        });
      }
      setStreaming(false);
      setStreamingCode(null);
    })();
    return () => {
      cancel = true;
      setStreamingCode(null);
    };
  }, [streaming, highlighter, after]);

  useEffect(() => {
    if (!highlighter) return;
    let cancel = false;
    (async () => {
      if (streamingCode !== null) {
        let out = await niftty({
          highlighter,
          code: streamingCode,
          diffWith: before,
          streaming: STREAM_WINDOW,
          lang: "tsx",
          theme: theme as shiki.ThemeRegistrationAny,
          lineNumbers: true,
        });
        if (cancel) return;
        const pct = ((streamingCode.length / after.length) * 100).toFixed(0);
        setAnsiOutput(`${pct}%\n\n${out}`);
      } else {
        let out = await niftty({
          highlighter,
          code: after,
          diffWith: before,
          lang: "tsx",
          theme: theme as shiki.ThemeRegistrationAny,
          lineNumbers: "both",
          collapseUnchanged: collapse
            ? {
                padding: 3,
                separator: (u) => `\n··· ${u} unchanged ···\n`,
              }
            : undefined,
        });
        if (cancel) return;
        setAnsiOutput(out);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [streamingCode, highlighter, theme, before, after, collapse]);

  return (
    <Card className={styles.demoCard}>
      <Flex className={styles.demoToolbar} align="center" gap="5" p="3">
        <Select.Root
          size="1"
          value={theme}
          onValueChange={(value) => {
            setTheme(value);
            setHighlighter(undefined);
          }}
        >
          <Select.Trigger placeholder="Theme" />
          <Select.Content>
            {shiki.bundledThemesInfo.map((b) => (
              <Select.Item key={b.id} value={b.id}>
                {b.displayName}
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Flex align="center" gap="2" asChild>
          <Text as="label" size="1">
            <Switch size="2" checked={collapse} onCheckedChange={setCollapse} />
            Collapse common lines
          </Text>
        </Flex>
        <Button
          size="1"
          disabled={streaming}
          onClick={() => setStreaming(true)}
        >
          Stream
        </Button>
        <div style={{ flex: 1 }} />
        <SegmentedControl.Root
          size="1"
          value={renderMode}
          onValueChange={(value) => setRenderMode(value as "ansi" | "dom")}
        >
          <SegmentedControl.Item value="ansi">
            ANSI via{" "}
            <Code color="gray" variant="ghost">
              niftty()
            </Code>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="dom">
            DOM via{" "}
            <Code color="gray" variant="ghost">
              tokenize()
            </Code>
          </SegmentedControl.Item>
        </SegmentedControl.Root>
      </Flex>

      <div className={styles.demoContainer}>
        <div className={styles.editorLeft}>
          <Text size="1" color="gray" mb="1">
            diffWith (before)
          </Text>
          <textarea
            ref={editorLeft}
            value={before}
            onScroll={(ev) => {
              syncScroll(
                ev.currentTarget.scrollTop /
                  (ev.currentTarget.scrollHeight -
                    ev.currentTarget.clientHeight),
                "left"
              );
            }}
            onInput={(ev) => setBefore(ev.currentTarget.value)}
          />
        </div>
        <div className={styles.outputContainer}>
          <Text size="1" color="gray" mb="1">
            Output
          </Text>
          {renderMode === "ansi" ? (
            <AnsiRenderer
              className={styles.ansiRenderer}
              ref={ansiRendererRef}
              ansi={ansiOutput}
              backgroundColor={themeColors?.background}
              foregroundColor={themeColors?.foreground}
              onScroll={(ev) => {
                syncScroll(
                  ev.currentTarget.scrollTop /
                    (ev.currentTarget.scrollHeight -
                      ev.currentTarget.clientHeight),
                  "ansi"
                );
              }}
            />
          ) : highlighter ? (
            <CodeRenderer
              className={styles.domRenderer}
              ref={domRendererRef}
              onScroll={(ev) => {
                syncScroll(
                  ev.currentTarget.scrollTop /
                    (ev.currentTarget.scrollHeight -
                      ev.currentTarget.clientHeight),
                  "dom"
                );
              }}
              highlighter={highlighter}
              code={streamingCode ?? after}
              diffWith={before}
              lang="tsx"
              theme={theme as shiki.ThemeRegistrationAny}
              lineNumbers={streamingCode !== null ? true : "both"}
              streaming={streamingCode !== null ? STREAM_WINDOW : undefined}
              collapseUnchanged={
                streamingCode !== null
                  ? undefined
                  : collapse
                  ? {
                      padding: 3,
                      separator: (u) => `${u} unchanged`,
                    }
                  : undefined
              }
            />
          ) : (
            <div className={styles.domRenderer}>Loading highlighter...</div>
          )}
        </div>
        <div className={styles.editorRight}>
          <Text size="1" color="gray" mb="1">
            code (after)
          </Text>
          <textarea
            ref={editorRight}
            value={after}
            onScroll={(ev) => {
              syncScroll(
                ev.currentTarget.scrollTop /
                  (ev.currentTarget.scrollHeight -
                    ev.currentTarget.clientHeight),
                "right"
              );
            }}
            onInput={(ev) => setAfter(ev.currentTarget.value)}
          />
        </div>
      </div>
    </Card>
  );
}
