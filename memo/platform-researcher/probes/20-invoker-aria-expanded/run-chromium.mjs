import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { run } from "./sequence.mjs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const here = new URL(".", import.meta.url).pathname;
const b = await pw.chromium.launch();
const page = await b.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.setContent(readFileSync(here + "page.html", "utf8"));
await page.waitForFunction(() => window.__ready);
const cdp = await page.context().newCDPSession(page);
const d = {
  eval: (js) => page.evaluate(js),
  async ax(ids) {
    const out = {};
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    for (const id of ids) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `[data-probe="${id}"], #${id}` });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
      const n = nodes[0];
      const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value ?? p.value.relatedNodes?.length]));
      out[id] = `${n.role?.value} expanded=${props.expanded ?? "(none)"}${props.details !== undefined ? " details" : ""}${props.hasPopup ? " hasPopup=" + props.hasPopup : ""}`;
    }
    return out;
  },
};
console.log("chromium", b.version());
await run(d, console.log);
await b.close();
