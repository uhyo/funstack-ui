// Wave 23 (#166), 2026-11-26. Run: node ax-focus.mjs
// Chromium: AX of an interestfor invoker with a plain vs rich target (full AX tree, all properties),
// and sequential focus order when the shown target is NOT next to the invoker in the DOM (card at the
// end of <body>, as a portalled popup would be).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await pw.chromium.launch();
console.log("Chromium", b.version());
const variants = {
  plain: `<a id="inv" href="#u" interestfor="card">@user</a><a id="mid" href="#m">mid</a><div id="card" popover="hint">Ada Lovelace, mathematician</div>`,
  rich: `<a id="inv" href="#u" interestfor="card">@user</a><a id="mid" href="#m">mid</a><div id="card" popover="hint"><h3>Ada</h3><a id="cardLink" href="#p">Profile</a></div>`,
  richFar: `<a id="inv" href="#u" interestfor="card">@user</a><a id="mid" href="#m">mid</a><a id="mid2" href="#m2">mid2</a><div id="card" popover="hint"><a id="cardLink" href="#p">Profile</a></div>`,
  richButton: `<button id="inv" interestfor="card">@user</button><a id="mid" href="#m">mid</a><div id="card" popover="hint"><a id="cardLink" href="#p">Profile</a></div>`,
  richExplicit: `<a id="inv" href="#u" interestfor="card" aria-describedby="card">@user</a><a id="mid" href="#m">mid</a><div id="card" popover="hint" role="dialog" aria-label="Ada"><a id="cardLink" href="#p">Profile</a></div>`,
};
for (const [name, body] of Object.entries(variants)) {
  const p = await b.newPage();
  // richFar: card moved to the end of body, after #mid2
  await p.setContent(`<!doctype html><button id="first">first</button>${body}<a id="last" href="#l">last</a>`);
  if (name === "richFar") await p.evaluate(() => document.body.append(document.getElementById("card")));
  const cdp = await p.context().newCDPSession(p);
  await cdp.send("Accessibility.enable");
  const dump = async () => {
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    return nodes
      .filter((n) => !n.ignored && ["link", "button", "tooltip", "group", "dialog", "generic", "heading", "StaticText"].includes(n.role?.value) && n.role?.value !== "StaticText")
      .map((n) => `${n.role.value} "${n.name?.value ?? ""}"${n.description?.value ? ` desc="${n.description.value}"` : ""} ${(n.properties ?? []).filter((x) => !["focusable", "url", "level", "settable"].includes(x.name)).map((x) => `${x.name}=${x.value.value ?? (x.value.relatedNodes ?? []).map((r) => r.idref ?? r.backendDOMNodeId).join("|")}`).join(" ")}`);
  };
  await p.focus("#first");
  await p.keyboard.press("Tab");
  await wait(800);
  const open = await p.evaluate(() => document.getElementById("card").matches(":popover-open"));
  console.log(`\n== ${name} (open=${open})`);
  for (const line of await dump()) console.log("  ", line);
  const order = [];
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press("Tab");
    await wait(50);
    order.push(await p.evaluate(() => document.activeElement.id || document.activeElement.tagName));
  }
  console.log("   Tab order after inv:", order.join(" > "), "| card open:", await p.evaluate(() => document.getElementById("card").matches(":popover-open")));
  await p.close();
}
await b.close();
