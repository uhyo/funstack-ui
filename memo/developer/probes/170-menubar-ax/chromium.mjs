// Chromium: the full accessibility tree over CDP, closed and with File open, plus axe.
import { pw, html, axeSource, openFile, runAxe } from "./common.mjs";
const b = await pw.chromium.launch();
const page = await b.newPage();
await page.setContent(html);
const cdp = await page.context().newCDPSession(page);
const skip = new Set(["none", "generic", "InlineTextBox", "StaticText", "LineBreak"]);
async function tree() {
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const lines = [];
  const walk = (n, depth) => {
    const role = n.role?.value;
    const shown = !n.ignored && !skip.has(role);
    const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value]));
    const extra = ["expanded", "hasPopup", "disabled", "focused", "checked"]
      .filter((k) => k in props)
      .map((k) => `${k}=${props[k]}`);
    if (shown) lines.push(`${"  ".repeat(depth)}${role} "${n.name?.value ?? ""}" ${extra.join(" ")}`);
    for (const c of n.childIds ?? []) {
      const child = byId.get(c);
      if (child) walk(child, shown ? depth + 1 : depth);
    }
  };
  walk(nodes[0], 0);
  return lines.join("\n");
}
console.log("chromium", b.version());
console.log("--- closed\n" + (await tree()));
await page.evaluate(openFile);
await page.waitForTimeout(300);
console.log("--- File open\n" + (await tree()));
await page.addScriptTag({ content: axeSource });
console.log("--- axe (File open)\n" + JSON.stringify(await page.evaluate(runAxe), null, 1));
await b.close();
