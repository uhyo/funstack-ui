// Wave 23 (#165), 2026-11-26. Run: node select-multiple.mjs
// <select multiple> in Chromium (native and appearance: base-select listbox) and Firefox (native):
// does a plain click toggle an option or replace the selection? Space/arrow keys? Events per pick?
// Does `multiple size=1` with base-select render a drop-down (flag off) or a listbox?
// Chromium AX via CDP.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const html = (base, size) => `<!doctype html><style>${base ? "select,::picker(select){appearance:base-select}" : ""} select{font:16px sans-serif}</style>
<select id="s" multiple ${size ? `size="${size}"` : ""} name="fruit"><option value="a">Apple</option><option value="b">Banana</option><option value="c">Cherry</option><option value="d">Date</option></select>
<script>window.log=[];s.addEventListener('input',()=>log.push('input'));s.addEventListener('change',()=>log.push('change:'+[...s.selectedOptions].map(o=>o.value).join('')));</script>`;
for (const [name, type] of [["chromium", pw.chromium], ["firefox", pw.firefox]]) {
  const b = await type.launch();
  console.log(`\n### ${name} ${b.version()}`);
  for (const [base, size] of [[false, null], [false, 1], [true, null], [true, 1]]) {
    if (name === "firefox" && base) continue;
    const p = await b.newPage();
    await p.setContent(html(base, size));
    const st = () => p.evaluate(() => ({ sel: [...s.selectedOptions].map((o) => o.value).join("") || "-", log: log.splice(0), h: Math.round(s.getBoundingClientRect().height), open: (() => { try { return s.matches(":open"); } catch { return "n/a"; } })() }));
    const label = `base=${base} size=${size ?? "none"}`;
    console.log(label, "initial", JSON.stringify(await st()));
    const opt = async (v) => {
      const box = await (await p.$(`option[value=${v}]`)).boundingBox();
      return box;
    };
    let box = await opt("a");
    if (!box || box.height === 0) {
      // drop-down: click the select to open
      await p.click("#s");
      await wait(100);
      console.log(label, "after clicking the select", JSON.stringify(await st()), "picker style:", await p.evaluate(() => getComputedStyle(s, "::picker(select)").display + " appearance=" + getComputedStyle(s).appearance));
      box = await opt("a");
    }
    if (box && box.height > 0) {
      await p.mouse.click(box.x + 5, box.y + box.height / 2);
      await wait(50);
      console.log(label, "click Apple", JSON.stringify(await st()));
      const bb = await opt("b");
      await p.mouse.click(bb.x + 5, bb.y + bb.height / 2);
      await wait(50);
      console.log(label, "click Banana", JSON.stringify(await st()));
      await p.mouse.click(bb.x + 5, bb.y + bb.height / 2);
      await wait(50);
      console.log(label, "click Banana again", JSON.stringify(await st()));
      await p.keyboard.press("ArrowDown");
      await wait(50);
      console.log(label, "ArrowDown", JSON.stringify(await st()));
      await p.keyboard.press(" ");
      await wait(50);
      console.log(label, "Space", JSON.stringify(await st()));
    } else console.log(label, "no visible options");
    if (name === "chromium") {
      const cdp = await p.context().newCDPSession(p);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      console.log(label, "AX", nodes.filter((n) => !n.ignored && ["listbox", "combobox", "option", "MenuListPopup", "MenuListOption"].includes(n.role?.value)).map((n) => `${n.role.value}${(n.properties ?? []).filter((x) => ["multiselectable", "selected", "expanded", "hasPopup"].includes(x.name)).map((x) => ` ${x.name}=${x.value.value}`).join("")}`).join(" | "));
    }
    await p.close();
  }
  await b.close();
}
