#!/usr/bin/env node
const { niftty } = require("niftty");

niftty({
  code: "let foo = 123;",
  diffWith: "let foo = 456;",
  lang: "tsx",
  theme: "catppuccin-frappe",
  lineNumbers: "both",
}).then(r => console.log(r));