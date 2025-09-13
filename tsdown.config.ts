import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm", "cjs"],
  target: ["es2022"],
  // clean: true,
  minify: true,
  outputOptions: {
    legalComments: 'inline', // todo: get this working
  },
  dts: true,
  sourcemap: true,
  platform: "node",
});
