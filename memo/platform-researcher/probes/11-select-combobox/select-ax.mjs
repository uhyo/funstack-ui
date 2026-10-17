// Chromium 156 accessibility tree for customizable <select> (CDP). Run: node select-ax.mjs
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

const HTML = `<style>.c, .c::picker(select) { appearance: base-select; }</style>
<label for="s">Fruit</label>
<select class="c" id="s" name="fruit" required>
  <button><selectedcontent></selectedcontent></button>
  <option value="">Choose a fruit</option>
  <optgroup label="Citrus">
    <option value="orange"><span class="icon" aria-hidden="true">O</span><span>Orange</span> <small>tangy</small></option>
    <option value="lemon" label="Lemon (label attr)">Lemon <b>content</b></option>
  </optgroup>
  <hr>
  <option value="apple" disabled>Apple</option>
  <option value="banana">Banana</option>
</select>
<label for="n">Native</label>
<select id="n"><option>One</option><option>Two</option></select>
<label for="ns">No-button base-select</label>
<select class="c" id="ns"><option>One <i>x</i></option><option>Two</option></select>
<label for="l">Listbox</label>
<select class="c" id="l" multiple size="3"><option>A</option><option selected>B</option><option>C</option></select>`;

function dump(nodes) {
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const lines = [];
  const walk = (n, depth) => {
    const role = n.role?.value;
    const ignored = n.ignored;
    const props = (n.properties || []).filter((p) => ["expanded", "selected", "disabled", "required", "invalid", "hasPopup", "focusable", "focused", "multiselectable", "setsize", "posinset", "controls", "activedescendant"].includes(p.name))
      .map((p) => `${p.name}=${JSON.stringify(p.value.value ?? p.value.relatedNodes?.map((r) => r.backendDOMNodeId))}`);
    if (!ignored && role && !["none", "generic", "InlineTextBox", "LineBreak"].includes(role))
      lines.push(`${"  ".repeat(depth)}${role} "${n.name?.value ?? ""}"${n.value?.value ? ` value="${n.value.value}"` : ""} ${props.join(" ")}`);
    for (const c of n.childIds || []) { const ch = byId.get(c); if (ch) walk(ch, ignored || !role || ["none","generic"].includes(role) ? depth : depth + 1); }
  };
  walk(nodes[0], 0);
  return lines.join("\n");
}

const browser = await pw.chromium.launch();
console.log("chromium", browser.version());
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
await cdp.send("Accessibility.enable");
await page.setContent(HTML);
const snap = async (label) => { const { nodes } = await cdp.send("Accessibility.getFullAXTree"); console.log(`\n== ${label}\n${dump(nodes)}`); };
await snap("closed");
await page.focus("#s"); await page.keyboard.press("Enter"); await page.waitForTimeout(100);
await snap("#s open (Enter)");
await page.keyboard.press("ArrowDown"); await page.waitForTimeout(50);
await snap("#s open, ArrowDown");
await page.keyboard.press("Escape");
await page.focus("#s"); await page.keyboard.type("lem"); await page.waitForTimeout(50);
console.log("\ntypeahead 'lem' (closed) value:", await page.evaluate(() => document.getElementById("s").value));
await page.keyboard.type("or"); await page.waitForTimeout(600);
await page.keyboard.type("or"); await page.waitForTimeout(50);
console.log("typeahead 'or' (closed) value:", await page.evaluate(() => document.getElementById("s").value));
await page.focus("#ns"); await page.keyboard.press("Enter"); await page.waitForTimeout(100);
await snap("#ns (no <button>) open");
await browser.close();
