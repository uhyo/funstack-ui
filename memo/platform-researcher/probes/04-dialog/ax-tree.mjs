// Chromium accessibility tree via CDP: is a showModal() dialog exposed as modal, is the rest hidden,
// and what does a command="show-modal" invoker expose (expanded / haspopup)?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const b = await pw.chromium.launch();
const page = await b.newPage();
await page.setContent(`<button id="inv" commandfor="d" command="show-modal">Open</button><p>Background text</p>
<dialog id="d" aria-labelledby="h"><h2 id="h">Title</h2><button commandfor="d" command="close">Close</button></dialog>
<button id="pinv" popovertarget="p">Pop</button><div id="p" popover>pop</div>`);
const cdp = await page.context().newCDPSession(page);
const dump = async (label) => {
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const out = nodes.filter((n) => !n.ignored && n.role?.value !== "none" && n.role?.value !== "generic" && n.role?.value !== "InlineTextBox" && n.role?.value !== "StaticText")
    .map((n) => `${n.role?.value} "${n.name?.value ?? ""}" ${(n.properties ?? []).map((p) => `${p.name}=${JSON.stringify(p.value.value)}`).join(" ")}`);
  console.log(`--- ${label}\n` + out.join("\n"));
};
await dump("closed");
await page.click("#inv");
await dump("after command=show-modal");
await b.close();
