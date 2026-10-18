// <progress> / <meter> probes (2026-10-18, wave 6). Run: node progress-meter.mjs
// Styling is measured by sampling screenshot pixels (red = value bar, blue = track).
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const { PNG } = createRequire("/home/uhyo/repos/funstack-ui/node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs/package.json")("pngjs");

const CSS = `
  body { margin: 0; font: 14px sans-serif; }
  .s { display:block; appearance:none; -webkit-appearance:none; width:200px; height:20px; border:0; margin:4px 0; background: rgb(0,0,255); }
  .s::-webkit-progress-bar { background: rgb(0,0,255); }
  .s::-webkit-progress-value { background: rgb(255,0,0); transition: inline-size 1s linear; }
  .s::-moz-progress-bar { background: rgb(255,0,0); transition: inline-size 1s linear; }
  .s::-webkit-meter-bar { background: rgb(0,0,255); border:0; }
  .s::-webkit-meter-optimum-value, .s::-webkit-meter-suboptimum-value, .s::-webkit-meter-even-less-good-value { background: rgb(255,0,0); }
  .s::-moz-meter-bar { background: rgb(255,0,0); }
  .vert { writing-mode: vertical-lr; direction: rtl; width:20px; height:100px; }
  .rtl { direction: rtl; }
`;
const PAGE = `<!doctype html><html lang="en"><head><style>${CSS}</style></head><body>
<progress id="p" class="s" value="25" max="100" aria-label="p">25%</progress>
<progress id="pi" class="s" aria-label="indeterminate"></progress>
<meter id="m" class="s" value="0.75" aria-label="m">75%</meter>
<progress id="prtl" class="s rtl" value="25" max="100" aria-label="rtl"></progress>
<progress id="pv" class="s vert" value="25" max="100" aria-label="vertical"></progress>
<progress id="child" class="s" value="50" aria-label="child"><span id="kid" style="display:block;width:50px;height:20px;background:lime">x</span></progress>
<progress id="native" value="40" max="100" aria-label="native"></progress>
<meter id="mlow" value="10" min="0" max="100" low="20" high="80" optimum="90" aria-label="mlow"></meter>
<progress id="pvt" value="30" max="100" aria-label="Upload" aria-valuetext="3 of 10 files"></progress>
<div id="ariaP" role="progressbar" aria-label="aria progress" aria-valuenow="30" aria-valuetext="30 percent"></div>
<div id="ariaPi" role="progressbar" aria-label="aria indeterminate"></div>
<div id="ariaM" role="meter" aria-label="aria meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="70"></div>
<label for="lp">Labelled by label</label><progress id="lp" value="1"></progress>
</body></html>`;

for (const name of ["chromium", "firefox"]) {
  const browser = await pw[name].launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 600 } });
  await page.setContent(PAGE);
  console.log(`\n######## ${name} ${browser.version()}`);
  const out = (k, v) => console.log(k.padEnd(48), JSON.stringify(v));
  const sample = async (id) => {
    const b = await page.locator("#" + id).boundingBox();
    const buf = await page.screenshot({ clip: b });
    const png = PNG.sync.read(buf);
    const at = (fx, fy) => { const x = Math.min(png.width - 1, Math.floor(png.width * fx)), y = Math.min(png.height - 1, Math.floor(png.height * fy)); const i = (y * png.width + x) * 4; const [r, g, bl] = [png.data[i], png.data[i + 1], png.data[i + 2]]; return r > 200 && g < 60 && bl < 60 ? "R" : bl > 200 && r < 60 && g < 60 ? "B" : g > 200 && r < 60 ? "G" : `(${r},${g},${bl})`; };
    // a strip of 10 samples along the inline axis (or block axis for tall boxes)
    const tall = png.height > png.width;
    return Array.from({ length: 10 }, (_, i) => (tall ? at(0.5, (i + 0.5) / 10) : at((i + 0.5) / 10, 0.5))).join("");
  };
  out("CSS.supports selectors", await page.evaluate(() => Object.fromEntries(["::-webkit-progress-value", "::-moz-progress-bar", "::-webkit-meter-optimum-value", "::-moz-meter-bar", ":-moz-meter-optimum", "::slider-fill", ":indeterminate"].map((s) => [s, CSS.supports(`selector(${s})`)]))));
  out("styled progress 25%", await sample("p"));
  out("styled indeterminate", await sample("pi"));
  out("styled meter 0.75", await sample("m"));
  out("styled progress rtl 25%", await sample("prtl"));
  out("styled progress vertical-lr rtl 25% (top->bottom)", await sample("pv"));
  out("progress with child span (G = child shown)", await sample("child"));
  out("child span box", await page.evaluate(() => { const r = document.getElementById("kid").getBoundingClientRect(); return [r.width, r.height]; }));
  out("indeterminate :indeterminate / position", await page.evaluate(() => [document.getElementById("pi").matches(":indeterminate"), document.getElementById("pi").position, document.getElementById("p").position]));
  out("removeAttribute(value) -> indeterminate", await page.evaluate(() => { const p = document.getElementById("native"); p.removeAttribute("value"); const r = p.matches(":indeterminate"); p.value = 40; return [r, p.matches(":indeterminate")]; }));
  out("value clamping (progress 150/100, meter 2)", await page.evaluate(() => { const p = document.getElementById("native"); p.value = 150; const m = document.getElementById("m"); m.value = 2; const r = [p.value, m.value]; p.value = 40; m.value = 0.75; return r; }));
  // transition: change value, sample mid-way
  await page.evaluate(() => document.getElementById("p").value = 100);
  await page.waitForTimeout(400);
  out("transition 25->100 after 400ms (1s linear)", await sample("p"));
  await page.waitForTimeout(800);
  out("transition settled", await sample("p"));
  out("labels", await page.evaluate(() => [document.getElementById("lp").labels.length, document.getElementById("p").labels.length]));
  if (name === "chromium") {
    const cdp = await page.context().newCDPSession(page); await cdp.send("Accessibility.enable");
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    for (const n of nodes.filter((n) => ["progressbar", "meter", "ProgressIndicator"].includes(n.role?.value))) {
      const p = Object.fromEntries((n.properties || []).map((x) => [x.name, x.value?.value]));
      out("AX " + n.role.value + " " + n.name?.value, { value: n.value?.value, min: p.valuemin, max: p.valuemax, busy: p.busy });
    }
    out("all roles", [...new Set(nodes.map((n) => n.role?.value))]);
  }
  await browser.close();
}
