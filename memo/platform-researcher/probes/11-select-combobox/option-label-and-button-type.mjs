import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const b = await pw.chromium.launch(); const p = await b.newPage();
const cdp = await p.context().newCDPSession(p); await cdp.send("Accessibility.enable");
await p.setContent(`<style>.c,.c::picker(select){appearance:base-select}</style><form id=f onsubmit="window.sub=(window.sub||0)+1;return false">
<select id=n aria-label=native><option label="L1">Content1</option><option>Two</option></select>
<select id=b class=c aria-label=base><button><selectedcontent></selectedcontent></button><option label="L1">Content1</option><option>Two</option></select></form>`);
const {nodes} = await cdp.send("Accessibility.getFullAXTree");
console.log(nodes.filter(n=>["option","combobox"].includes(n.role?.value)).map(n=>`${n.role.value} "${n.name?.value}" value=${n.value?.value}`).join("\n"));
console.log("sc:", await p.evaluate(()=>document.querySelector("selectedcontent").textContent));
await p.click("#b"); await p.waitForTimeout(100); await p.keyboard.press("Escape");
await p.focus("#b"); await p.keyboard.press("Enter"); await p.waitForTimeout(100); await p.keyboard.press("Escape");
console.log("submits:", await p.evaluate(()=>window.sub||0));
await b.close();
