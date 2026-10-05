import esbuild from "esbuild";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const prod = process.argv[2] === "production";
// Built files also land in the test vault, when there is one, so a reload in Obsidian picks them up.
const vaultPlugin = "test-vault/.obsidian/plugins/tinted-highlights";

await esbuild.build({
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  format: "cjs",
  target: "es2020",
  sourcemap: prod ? false : "inline",
  minify: prod,
  outfile: "main.js",
});
if (existsSync("test-vault")) {
  mkdirSync(vaultPlugin, { recursive: true });
  for (const f of ["main.js", "manifest.json", "styles.css"]) copyFileSync(f, `${vaultPlugin}/${f}`);
}
console.log("built");
