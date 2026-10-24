import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const esbuild = require("/home/uhyo/repos/funstack-ui/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild");
const here = new URL(".", import.meta.url).pathname; // page.html is written next to this file
const src = "/home/uhyo/repos/funstack-ui/packages/ui/src";
const r = await esbuild.build({ entryPoints: [here + "app.tsx"], bundle: true, write: false, format: "iife", jsx: "automatic",
  nodePaths: ["/home/uhyo/repos/funstack-ui/packages/ui/node_modules"],
  alias: { "@funstack/ui/popover": src + "/popover/index.ts", "@funstack/ui/menu": src + "/menu/index.ts", "@funstack/ui/combobox": src + "/combobox/index.ts" },
  define: { "process.env.NODE_ENV": '"development"' } });
const html = `<!doctype html><html><head><meta charset=utf-8><title>probe</title></head><body>${readFileSync(here + "static.html", "utf8")}<div id="root"></div><script>${r.outputFiles[0].text.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
writeFileSync(here + "page.html", html);
console.log("built", html.length);
