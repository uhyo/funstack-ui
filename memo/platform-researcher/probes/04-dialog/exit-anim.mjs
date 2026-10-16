// Visual probe: does a closing modal dialog keep rendering (and stay above other content) during an
// exit transition? Samples pixels from screenshots. Cover = blue fixed z-index max (NOT top layer);
// dialog = red; backdrop = green.
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");
const { PNG } = await import("/home/uhyo/repos/funstack-ui/node_modules/.pnpm/node_modules/pngjs/lib/png.js").catch(() => ({}));
function px(buf, x, y) {
  const png = PNG.sync.read(buf); const i = (png.width * y + x) << 2;
  const [r, g, bl] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  return r > 200 && g < 80 && bl < 80 ? "red(dialog)" : bl > 200 && r < 80 ? "blue(cover)" : g > 100 && r < 80 && bl < 80 ? "green(backdrop)" : r > 240 && g > 240 && bl > 240 ? "white(page)" : `rgb(${r},${g},${bl})`;
}
const variants = {
  transition: (ov) => `dialog{transition: opacity 2s, display 2s allow-discrete${ov}} dialog::backdrop{transition: opacity 2s, display 2s allow-discrete${ov}}
    dialog:not([open]){opacity:0} dialog:not([open])::backdrop{opacity:0}`,
  keyframes: () => `dialog:not([open]){animation: out 2s} dialog:not([open])::backdrop{animation: out 2s} @keyframes out{from{opacity:1;display:block}to{opacity:0;display:block}}`,
};
for (const name of ["chromium", "firefox"]) {
  const b = await pw[name].launch();
  for (const [vk, css] of Object.entries(variants)) for (const ov of ["", ", overlay 2s allow-discrete"]) {
    if (vk === "keyframes" && ov) continue;
    const page = await b.newPage({ viewport: { width: 400, height: 400 } });
    await page.setContent(`<!doctype html><style>body{margin:0}
      #cover{position:fixed;left:0;top:0;width:400px;height:400px;z-index:2147483647;background:rgba(0,0,255,0.5)}
      dialog{position:fixed;inset:0;margin:auto;width:100px;height:100px;padding:0;border:0;background:rgb(255,0,0)}
      dialog::backdrop{background:rgb(0,160,0)}
      ${css(ov)}</style><div id="cover"></div><dialog id="d"></dialog>`);
    await page.evaluate(() => document.getElementById("d").showModal());
    await page.waitForTimeout(100);
    const open = await page.screenshot();
    await page.evaluate(() => document.getElementById("d").close());
    await page.waitForTimeout(300);
    const during = await page.screenshot();
    const cs = await page.evaluate(() => getComputedStyle(document.getElementById("d")).display);
    console.log(name, vk, ov ? "+overlay" : "no-overlay", JSON.stringify({ open: [px(open, 200, 200), px(open, 10, 10)], during: [px(during, 200, 200), px(during, 10, 10)], displayDuring: cs }));
    await page.close();
  }
  await b.close();
}
