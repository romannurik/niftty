import { defineConfig } from "tsdown";

// TODO: outputOptions.legalComments isn't working, so manually add license banner.
const LICENSE_BANNER = `
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
`;

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm", "cjs"],
  target: ["es2022"],
  clean: true,
  minify: true,
  banner: LICENSE_BANNER,
  dts: true,
  sourcemap: true,
  platform: "node",
});
