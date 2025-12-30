import { Dithering, ImageDithering } from "@paper-design/shaders-react";
import { ExternalLinkIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  Card,
  Code,
  Container,
  Flex,
  Heading,
  Link,
  Section,
  Text,
  Theme,
} from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useMemo, useState } from "react";
import * as shiki from "shiki";
import { createHighlighter } from "shiki";
import styles from "./App.module.scss";
import { CodeRenderer } from "./CodeRenderer";
import { InteractiveDemo } from "./InteractiveDemo";
import logotypeUrl from "/logotype.jpg";

const DEFAULT_THEME = "poimandres";

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
  const [highlighter, setHighlighter] = useState<shiki.Highlighter>();
  const [scrollTop, setScrollTop] = useState(0);
  const startFrame = useMemo(() => Math.random() * 10000, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      let highlighter = await createHighlighter({
        langs: ["typescript"],
        themes: [DEFAULT_THEME],
      });
      if (cancel) return;
      setHighlighter(highlighter);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollTop(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <Theme
      appearance="dark"
      accentColor="iris"
      grayColor="slate"
      radius="medium"
    >
      <Dithering
        className={styles.bgShader}
        colorBack="#000000"
        colorFront="#111"
        shape="warp"
        type="4x4"
        size={2}
        speed={0.2}
        frame={startFrame}
        scale={2}
        offsetY={-scrollTop / 3000}
      />

      <div className={styles.page}>
        {/* Hero Section */}
        <Section size="3" className={styles.hero}>
          <Container size="2">
            <Flex direction="column" align="center" gap="4">
              <ImageDithering
                width={1408 / 3}
                height={768 / 3}
                image={logotypeUrl}
                colorFront="#B1A9FF"
                colorHighlight="#fff"
                colorBack="#00000000"
                type="8x8"
                colorSteps={9}
                size={lerp(2, 20, invLerp(0, 300, scrollTop))}
              />
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
          <Container size="1">
            <Flex direction="column" gap="3">
              <Heading size="5" align="center">
                Quickstart
              </Heading>
              <Box className={styles.codeExample}>
                {highlighter ? (
                  <CodeRenderer
                    highlighter={highlighter}
                    code={USAGE_EXAMPLE}
                    lang="typescript"
                    theme={DEFAULT_THEME as shiki.ThemeRegistrationAny}
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
              <InteractiveDemo />
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

function invLerp(a: number, b: number, v: number) {
  return Math.max(0, Math.min(1, (v - a) / (b - a)));
}

function lerp(a: number, b: number, v: number) {
  return a + (b - a) * v;
}

export default App;
