import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { createHighlighter } from "shiki";
import { niftty } from "niftty";
import { useResizeObserver } from "./useResizeObserver";
import { CodeRenderer } from "./CodeRenderer";
import * as shiki from "shiki";
import {
  Theme,
  Button,
  Select,
  Switch,
  Text,
  SegmentedControl,
  Flex,
  Heading,
  Code,
  Container,
  Section,
  Box,
  Link,
  Card,
} from "@radix-ui/themes";
import { GitHubLogoIcon, ExternalLinkIcon } from "@radix-ui/react-icons";

import "@radix-ui/themes/styles.css";
import "@xterm/xterm/css/xterm.css";
import styles from "./App.module.scss";

const DEMO_CHUNK_SIZE = [15, 30] as const;
const DEMO_CHUNK_DELAY = [0, 30] as const;
const STREAM_WINDOW = 15;

const USAGE_EXAMPLE = `import { niftty } from "niftty";

process.stdout.write(
  await niftty({
    code: "let foo = 123;",
    diffWith: "let foo = 456;",
    lang: "tsx",
    theme: "catppuccin-frappe",
    lineNumbers: "both",
  })
);`;

const FEATURES = [
  {
    title: "Syntax Highlighting",
    description:
      "Powered by Shiki with support for 200+ languages and any VSCode theme",
  },
  {
    title: "Diff Rendering",
    description:
      "Show additions, removals, and intra-line changes with collapsible unchanged regions",
  },
  {
    title: "Streaming Support",
    description:
      "Perfect for LLM code generation with live diff preview as code streams in",
  },
  {
    title: "Dual Output",
    description:
      "ANSI output for terminals via niftty() or structured tokens via tokenize() for custom rendering",
  },
];

function App() {
  const [node, setNode] = useState<HTMLDivElement>();
  const [before, setBefore] = useState<string>("Loading...");
  const [after, setAfter] = useState<string>("Loading...");
  const [theme, setTheme] = useState<string>("catppuccin-macchiato");
  const [highlighter, setHighlighter] = useState<shiki.Highlighter>();
  const [collapse, setCollapse] = useState(true);
  const [renderMode, setRenderMode] = useState<"terminal" | "dom">("terminal");

  const [streaming, setStreaming] = useState(false);
  const [streamingCode, setStreamingCode] = useState<string | null>(null);
  const streamingCodeRef = useRef<string | null>(null);
  streamingCodeRef.current = streamingCode;

  const lastScrollSyncRef = useRef<{
    source: "left" | "right" | "term" | "dom";
    time: number;
  }>({ source: "left", time: 0 });

  const editorLeft = useRef<HTMLTextAreaElement>(null);
  const editorRight = useRef<HTMLTextAreaElement>(null);
  const domRendererRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<{
    terminal: Terminal;
    fitAddon: FitAddon;
  }>();

  useEffect(() => {
    let cancel = false;
    (async () => {
      let highlighter = await createHighlighter({
        langs: ["tsx", "typescript"],
        themes: [theme],
      });
      if (cancel) return;
      setHighlighter(highlighter);
    })();
    return () => {
      cancel = true;
    };
  }, [theme]);

  const syncScroll = (
    pctScroll: number,
    source: "left" | "right" | "term" | "dom"
  ) => {
    if (streamingCodeRef.current) return;
    if (
      lastScrollSyncRef.current.source !== source &&
      lastScrollSyncRef.current.time > Date.now() - 500
    ) {
      return;
    }
    lastScrollSyncRef.current = { source, time: Date.now() };
    if (source !== "term") {
      termRef.current?.terminal.scrollToLine(
        Math.floor(
          pctScroll * (termRef.current?.terminal.buffer.active.baseY || 0)
        )
      );
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

  useResizeObserver(() => termRef.current?.fitAddon.fit(), node, []);

  useEffect(() => {
    if (!node) return;
    const terminal = new Terminal({
      convertEol: true,
      fontFamily: "Google Sans Code",
      fontSize: 12,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(node);
    terminal.onScroll((top) => {
      if (
        lastScrollSyncRef.current.source !== "term" &&
        lastScrollSyncRef.current.time > Date.now() - 500
      ) {
        return;
      }
      syncScroll(top / (terminal.buffer.active.baseY || 1), "term");
    });
    termRef.current = { terminal, fitAddon };
    fitAddon.fit();

    (async () => {
      const [BEFORE, AFTER] = await Promise.all([
        fetch("fs/before").then((res) => res.text()),
        fetch("fs/after").then((res) => res.text()),
      ]);
      setBefore(BEFORE);
      setAfter(AFTER);
    })();

    return () => {
      termRef.current = undefined;
      terminal.dispose();
    };
  }, [node]);

  useEffect(() => {
    if (!streaming || !highlighter) return;
    let cancel = false;
    termRef.current?.terminal.clear();
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
    if (!termRef.current || !highlighter) return;
    let cancel = false;
    let terminal = termRef.current.terminal;
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
        // terminal.reset();
        terminal.write("\x1b[H");
        terminal.write(
          `${((streamingCode.length / after.length) * 100).toFixed(0)}%\n\n`
        );
        terminal.write(out);
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
        lastScrollSyncRef.current = { source: "left", time: Date.now() };
        terminal.reset();
        terminal.clear();
        terminal.write(out);
        setTimeout(() => terminal.scrollToTop());
      }
    })();
    return () => {
      cancel = true;
    };
  }, [streamingCode, highlighter, theme, before, after, collapse]);

  return (
    <Theme
      appearance="dark"
      accentColor="iris"
      grayColor="slate"
      radius="medium"
    >
      <div className={styles.page}>
        {/* Hero Section */}
        <Section size="3" className={styles.hero}>
          <Container size="2">
            <Flex direction="column" align="center" gap="4">
              <Heading size="9" align="center">
                Niftty
              </Heading>
              <Text
                size="5"
                color="gray"
                align="center"
                style={{ maxWidth: 500 }}
              >
                A nifty code syntax highlighter for the terminal, powered by
                Shiki
              </Text>
              <Flex align="center" gap="2" mt="2">
                <Code size="4" className={styles.installCode}>
                  npm install niftty
                </Code>
              </Flex>
              <Flex gap="3" mt="2">
                <Button asChild variant="soft">
                  <a
                    href="https://github.com/romannurik/niftty"
                    target="_blank"
                    rel="noopener"
                  >
                    <GitHubLogoIcon /> GitHub
                  </a>
                </Button>
                <Button asChild variant="soft">
                  <a
                    href="https://npmjs.com/package/niftty"
                    target="_blank"
                    rel="noopener"
                  >
                    <ExternalLinkIcon /> NPM
                  </a>
                </Button>
              </Flex>
            </Flex>
          </Container>
        </Section>

        {/* Usage Example */}
        <Section size="2">
          <Container size="2">
            <Flex direction="column" gap="3">
              <Heading size="5" align="center">
                Quick Start
              </Heading>
              <Box className={styles.codeExample}>
                {highlighter ? (
                  <CodeRenderer
                    highlighter={highlighter}
                    code={USAGE_EXAMPLE}
                    lang="typescript"
                    theme={theme as shiki.ThemeRegistrationAny}
                    lineNumbers={false}
                  />
                ) : (
                  <Text color="gray">Loading...</Text>
                )}
              </Box>
            </Flex>
          </Container>
        </Section>

        {/* Features */}
        <Section size="2">
          <Container size="3">
            <Flex direction="column" gap="4">
              <Heading size="5" align="center">
                Features
              </Heading>
              <div className={styles.featuresGrid}>
                {FEATURES.map((feature) => (
                  <Card key={feature.title} className={styles.featureCard}>
                    <Flex direction="column" gap="1">
                      <Text weight="bold">{feature.title}</Text>
                      <Text size="2" color="gray">
                        {feature.description}
                      </Text>
                    </Flex>
                  </Card>
                ))}
              </div>
            </Flex>
          </Container>
        </Section>

        {/* Interactive Demo */}
        <Section size="2">
          <Container size="4">
            <Flex direction="column" gap="3">
              <Heading size="5" align="center">
                Interactive Demo
              </Heading>
              <Text size="2" color="gray" align="center">
                Edit the code on either side to see the diff update in real-time
              </Text>

              <Card className={styles.demoCard}>
                <Flex
                  className={styles.demoToolbar}
                  align="center"
                  gap="5"
                  p="3"
                >
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
                      <Switch
                        size="2"
                        checked={collapse}
                        onCheckedChange={setCollapse}
                      />
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
                    onValueChange={(value) =>
                      setRenderMode(value as "terminal" | "dom")
                    }
                  >
                    <SegmentedControl.Item value="terminal">
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
                  <div className={styles.terminalContainer}>
                    <Text size="1" color="gray" mb="1">
                      Output
                    </Text>
                    <div
                      className={styles.terminal}
                      ref={(node) => setNode(node || undefined)}
                      style={{
                        display: renderMode === "terminal" ? undefined : "none",
                      }}
                    />
                    {renderMode === "dom" &&
                      (highlighter ? (
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
                          streaming={
                            streamingCode !== null ? STREAM_WINDOW : undefined
                          }
                          collapseUnchanged={
                            streamingCode !== null
                              ? undefined
                              : collapse
                              ? {
                                  padding: 3,
                                  separator: (u) => `··· ${u} unchanged ···`,
                                }
                              : undefined
                          }
                        />
                      ) : (
                        <div className={styles.domRenderer}>
                          Loading highlighter...
                        </div>
                      ))}
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
            </Flex>
          </Container>
        </Section>

        {/* Footer */}
        <Section size="2" className={styles.footer}>
          <Container size="2">
            <Flex direction="column" align="center" gap="2">
              <Text size="2" color="gray">
                Made by{" "}
                <Link
                  href="https://roman.nurik.net"
                  target="_blank"
                  rel="noopener"
                >
                  Roman Nurik
                </Link>{" "}
                at Google
              </Text>
              <Text size="1" color="gray">
                Brought to you with 💜 from New York
              </Text>
            </Flex>
          </Container>
        </Section>
      </div>
    </Theme>
  );
}

export default App;
