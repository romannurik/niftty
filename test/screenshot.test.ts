import { toMatchImageSnapshot } from "jest-image-snapshot";
import { describe, expect, it } from "vitest";
import { loadSnippet, nifttyToImage, type RenderParams } from "./test-util";
expect.extend({ toMatchImageSnapshot });

const DEFAULT_PARAMS: RenderParams = {
  ...loadSnippet("basic-cases.ts"),
  theme: "catppuccin-macchiato",
};

const CONFIGURATIONS: Record<string, Partial<RenderParams>> = {
  // Basic tests
  Simple: { diffWith: undefined },
  "Simple / Markdown": {
    ...loadSnippet("simple.md"),
    lineNumbers: true,
  },
  "Simple / HTML": {
    ...loadSnippet("simple.html"),
    lineNumbers: "both",
  },
  "Simple / Line numbers": { lineNumbers: true, diffWith: undefined },

  // Tests focused on diffs
  Diff: {},
  "Diff / Line numbers": { lineNumbers: true },
  "Diff / Line numbers (Both)": {
    lineNumbers: "both",
  },
  "Diff / Big change": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
  },
  "Diff / Wrap JSX Tag": {
    ...loadSnippet("wrap-tag.tsx"),
    lineNumbers: "both",
    theme: "dracula",
  },

  // Tests focused on collapse behaviors
  "Collapse / Big change": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
    collapseUnchanged: {
      padding: 3,
      separator: (n) => `\n··· ${n} unchanged ···\n`,
    },
    theme: "github-dark-default",
  },
  "Collapse / Aggressive": {
    ...loadSnippet("small-change.tsx"),
    lineNumbers: "both",
    collapseUnchanged: {
      padding: 1,
    },
  },
  "Collapse / Aggressive / Big change": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
    theme: "everforest-dark",
    collapseUnchanged: {
      padding: 1,
    },
  },

  // Tests focused on streaming
  Streaming: {
    ...loadSnippet("big-change.tsx"),
    code: loadSnippet("big-change.tsx").code.substring(
      0,
      Math.floor(loadSnippet("big-change.tsx").code.length / 2)
    ),
    streaming: true,
  },
  "Streaming / Start": {
    ...loadSnippet("big-change.tsx"),
    code: "",
    streaming: true,
  },
  "Streaming / End": {
    ...loadSnippet("big-change.tsx"),
    code: loadSnippet("big-change.tsx").code.substring(
      0,
      loadSnippet("big-change.tsx").code.length - 1
    ),
    streaming: true,
  },

  // Tests focused on theming
  "Themes / Light": {
    lineNumbers: "both",
    theme: "catppuccin-latte",
  },
  "Themes / Light / Streaming": {
    ...loadSnippet("big-change.tsx"),
    code: loadSnippet("big-change.tsx").code.substring(
      0,
      Math.floor(loadSnippet("big-change.tsx").code.length / 2)
    ),
    streaming: true,
    theme: "catppuccin-latte",
  },

  // Newline at EOF changes
  "Newline EOF / Add": {
    ...loadSnippet("added-newline-eof.txt"),
  },
  "Newline EOF / Remove": {
    ...loadSnippet("removed-newline-eof.txt"),
  },
};

describe("Screenshot tests", () => {
  for (let [name, overrideParams] of Object.entries(CONFIGURATIONS)) {
    it(`Renders with configuration: ${name}`, async () => {
      let { img, output } = await nifttyToImage({
        ...DEFAULT_PARAMS,
        ...overrideParams,
      });
      if (process.env.DEBUG) {
        process.stdout.write(output + "\n");
      }
      expect(img).toMatchImageSnapshot({
        customSnapshotIdentifier: (_) =>
          `golden-${name.replace(/[^\w]+/g, "-").toLowerCase()}`,
      });
    });
  }
});
