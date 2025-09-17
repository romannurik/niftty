#!/usr/bin/env npx tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { niftty } from "niftty";
import { createHighlighter } from "shiki";

const DEMO_CHUNK_SIZE = [15, 30] as const;
const DEMO_CHUNK_DELAY = [0, 30] as const;
const STREAM_WINDOW = 20;

let code = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../test/snippets/big-change.tsx/after.tsx"),
  "utf-8"
);
let diffWith = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../test/snippets/big-change.tsx/before.tsx"),
  "utf-8"
);

console.clear();
let length = 0;
let highlighter = await createHighlighter({
  langs: ["tsx"],
  themes: ["rose-pine-moon"],
});

while (length < code.length) {
  length +=
    DEMO_CHUNK_SIZE[0] +
    Math.floor(Math.random() * (DEMO_CHUNK_SIZE[1] - DEMO_CHUNK_SIZE[0]));
  let after = code.substring(0, length);
  process.stdout.write("\x1b[H");

  console.log(`${((after.length / code.length) * 100).toFixed(0)}%`);
  process.stdout.write(
    await niftty({
      highlighter,
      code: after,
      diffWith,
      streaming: STREAM_WINDOW,
      lang: "tsx",
      theme: "rose-pine-moon",
      lineNumbers: true,
    })
  );
  await new Promise((resolve) => {
    setTimeout(
      resolve,
      DEMO_CHUNK_DELAY[0] +
        Math.floor(Math.random() * (DEMO_CHUNK_DELAY[1] - DEMO_CHUNK_DELAY[0]))
    );
  });
}
