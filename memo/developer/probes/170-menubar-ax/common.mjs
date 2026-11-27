// Shared by the engine drivers: the page, the open step and the axe run.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
export const here = new URL(".", import.meta.url).pathname;
export const html = readFileSync(here + "page.html", "utf8");
// Playwright from packages/ui (run from a checkout with `pnpm install` done).
export const pw = createRequire(new URL("../../../../packages/ui/package.json", import.meta.url))(
  "playwright",
);
// axe-core 4.14.1, fetched outside the repo: AXE=/path/to/axe.min.js
export const axeSource = readFileSync(process.env.AXE, "utf8");
export const openFile = `document.getElementById("file").showPopover({ source: document.getElementById("file-trigger") }); document.getElementById("file-new").focus(); true`;
export const runAxe = `(async () => { const r = await axe.run(document, { resultTypes: ["violations", "incomplete"] }); return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")) })), incomplete: r.incomplete.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) })) }; })()`;
