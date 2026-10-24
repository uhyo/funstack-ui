import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { run } from "./ax-sequence.mjs";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const here = new URL(".", import.meta.url).pathname;
const b = await pw.chromium.launch();
const page = await b.newPage();
await page.setContent(readFileSync(here + "ax-page.html", "utf8"));
const cdp = await page.context().newCDPSession(page);
const d = {
  eval: (js) => page.evaluate(js),
  async ax(ids) {
    const out = {};
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    for (const id of ids) {
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: `#${id}` });
      const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
      const n = nodes[0];
      const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value ?? p.value.relatedNodes?.length]));
      out[id] = `${n.role?.value} expanded=${props.expanded ?? "(none)"}`;
    }
    return out;
  },
};
console.log("chromium", b.version());
await run(d, (k, v) => console.log(k, JSON.stringify(v, null, 1)));
await b.close();
