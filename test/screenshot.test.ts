import { toMatchImageSnapshot } from "jest-image-snapshot";
import { describe, expect, it } from "vitest";
import { loadSnippet, nifttyToImage, type RenderParams } from "./test-util";
expect.extend({ toMatchImageSnapshot });

const DEFAULT_PARAMS: RenderParams = {
  ...loadSnippet("basic-cases.ts"),
  theme: "catppuccin-macchiato",
};

const CONFIGURATIONS: Record<string, Partial<RenderParams>> = {
  Simple: { diffWith: undefined },
  Diff: {},
  "Line numbers": { lineNumbers: true, diffWith: undefined },
  "Diff with line numbers": { lineNumbers: true },
  "Diff with both line numbers": {
    lineNumbers: "both",
  },
  "Light theme": {
    lineNumbers: "both",
    theme: "catppuccin-latte",
  },
  "Big change": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
  },
  "Big change, with collapse": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
    collapseUnchanged: {
      padding: 3,
      separator: (n) => `\n··· ${n} unchanged ···\n`,
    },
    theme: "github-dark-default",
  },
  "Big change, aggressive collapse": {
    ...loadSnippet("big-change.tsx"),
    lineNumbers: "both",
    theme: "everforest-dark",
    collapseUnchanged: {
      padding: 1,
    },
  },
  "Big change, streaming": {
    ...loadSnippet("big-change.tsx"),
    code: loadSnippet("big-change.tsx").code.substring(
      0,
      Math.floor(loadSnippet("big-change.tsx").code.length / 2)
    ),
    streaming: true,
  },
  "Big change, streaming, light theme": {
    ...loadSnippet("big-change.tsx"),
    code: loadSnippet("big-change.tsx").code.substring(
      0,
      Math.floor(loadSnippet("big-change.tsx").code.length / 2)
    ),
    streaming: true,
    theme: "catppuccin-latte",
  },
  "Small change, aggressive collapse": {
    ...loadSnippet("small-change.tsx"),
    lineNumbers: "both",
    collapseUnchanged: {
      padding: 1,
    },
  },
  Markdown: {
    ...loadSnippet("simple.md"),
    lineNumbers: true,
  },
  "Simple HTML": {
    ...loadSnippet("simple.html"),
    lineNumbers: "both",
  },
  "Wrap JSX Tag": {
    ...loadSnippet("wrap-tag.tsx"),
    lineNumbers: "both",
    theme: "dracula",
  },
};

describe("Basic screenshot tests", () => {
  for (let [name, overrideParams] of Object.entries(CONFIGURATIONS)) {
    it(`Renders with configuration: ${name}`, async () => {
      let { img } = await nifttyToImage({
        ...DEFAULT_PARAMS,
        ...overrideParams,
      });
      expect(img).toMatchImageSnapshot({
        customSnapshotIdentifier: (_) =>
          `golden-${name.replace(/[^\w]+/g, "-").toLowerCase()}`,
      });
    });
  }
});
