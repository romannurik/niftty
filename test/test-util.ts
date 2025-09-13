import { chromium } from "playwright";
import * as shiki from "shiki";
import stringLength from "string-length";
import { niftty } from "..";
import fs from "node:fs";
import path from "node:path";

export type RenderParams = Parameters<typeof niftty>[0];

export async function nifttyToImage(...args: Parameters<typeof niftty>) {
  let output = await niftty(...args);
  let { lines, cols } = measureAnsiString(output);
  let html = await shiki.codeToHtml(output, {
    lang: "ansi",
    theme: "light-plus",
  });
  let fontSize = 24;
  const htmlHarness = (innerHtml: string) => `
<style>
  html, body {
    margin: 0;
    background: white;
    font-smooth: never;
    -webkit-font-smoothing: none;
  }
  pre {
    padding: 0;
    margin: 0;
    font-family: courier;
    font-size: ${fontSize}px;
  }
</style>
${innerHtml}
`;

  const browser = await chromium.launch({
    args: [
      // https://peter.sh/experiments/chromium-command-line-switches/
      "--disable-lcd-text",
      "--disable-gpu",
      "--disable-gpu-rasterization",
      "--disable-gpu-compositing",
      "--disable-font-subpixel-positioning",
      "--disable-software-rasterizer",
      "--ppapi-subpixel-rendering-setting=0",
      "--force-device-scale-factor=1",
      "--force-color-profile=srgb",
    ],
  });

  const page = await browser.newPage({
    viewport: {
      width: Math.ceil(cols * fontSize * 0.6),
      height: Math.ceil(lines * fontSize * 1.165),
    },
  });
  await page.setContent(htmlHarness(html));
  let img = await page.screenshot();
  await browser.close();
  return { output, img };
}

function measureAnsiString(str: string) {
  let lines = str.split("\n");
  let maxCols = lines.reduce(
    (max, line) => Math.max(max, stringLength(line)),
    0
  );
  return { lines: lines.length - 1, cols: maxCols };
}

export function loadSnippet(name: string): {
  code: string;
  diffWith?: string;
  lang: shiki.BuiltinLanguage | shiki.SpecialLanguage;
} {
  let ext = name.match(/\.(\w+)$/)?.[1] ?? "txt";
  let code = fs.readFileSync(
    path.resolve(__dirname, "snippets", name, `after.${ext}`),
    "utf-8"
  );
  let diffWith = fs.readFileSync(
    path.resolve(__dirname, "snippets", name, `before.${ext}`),
    "utf-8"
  );
  return {
    code,
    diffWith,
    lang: ext as shiki.BuiltinLanguage | shiki.SpecialLanguage,
  };
}
