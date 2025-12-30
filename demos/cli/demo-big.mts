#!/usr/bin/env npx tsx
import * as fs from "node:fs";
import * as path from "node:path";
import { niftty } from "niftty";

let code = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../test/snippets/big-change.tsx/after.tsx"),
  "utf-8"
);
let diffWith = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../test/snippets/big-change.tsx/before.tsx"),
  "utf-8"
);

console.log(
  await niftty({
    code,
    diffWith,
    lang: "tsx",
    theme: "everforest-dark",
    collapseUnchanged: {
      padding: 3,
      separator: (n) => `\n··· ${n} unchanged ···\n`,
    },
    lineNumbers: "both",
  })
);
