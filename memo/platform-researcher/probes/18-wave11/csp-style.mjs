// Wave 11 research (#88), 2026-10-22. Run: node csp-style.mjs
// Under `Content-Security-Policy: style-src 'nonce-abc'`, which style mechanisms apply?
// - a server-rendered style="" attribute
// - CSSOM writes (el.style.setProperty, what react-dom's client does for the `style` prop)
// - el.setAttribute('style', ...)
// - a script-inserted <style> without nonce, and with setAttribute('nonce', 'abc') (what
//   react-dom's client does for a hoisted <style href precedence nonce>)
// - a script-inserted <style> with no nonce whose text matches a 'sha256-...' source (s3)
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const pw = require("playwright");

import { createHash } from "node:crypto";
const S3 = ".s3{width:16px}";
const S3_HASH = createHash("sha256").update(S3).digest("base64");
const html = `<!doctype html><div id="ssr" style="width: 11px"></div><div id="om"></div><div id="attr"></div>
<div id="s1" class="s1"></div><div id="s2" class="s2"></div><div id="s3" class="s3"></div>
<script nonce="abc">
document.getElementById('om').style.setProperty('width','12px');
document.getElementById('attr').setAttribute('style','width: 13px');
const a=document.createElement('style');a.textContent='.s1{width:14px}';document.head.append(a);
const b=document.createElement('style');b.setAttribute('nonce','abc');b.textContent='.s2{width:15px}';document.head.append(b);
const c=document.createElement('style');c.textContent=${JSON.stringify(S3)};document.head.append(c);
</script>`;

for (const type of ["chromium", "firefox"]) {
  const browser = await pw[type].launch();
  const p = await browser.newPage();
  await p.route("https://probe.test/", (r) =>
    r.fulfill({ contentType: "text/html", headers: { "content-security-policy": `style-src 'nonce-abc' 'sha256-${S3_HASH}'; script-src 'nonce-abc'` }, body: html }));
  await p.goto("https://probe.test/");
  const r = await p.evaluate(() => Object.fromEntries(["ssr", "om", "attr", "s1", "s2", "s3"].map((id) => [id, getComputedStyle(document.getElementById(id)).width])));
  console.log(type, browser.version(), JSON.stringify(r));
  await browser.close();
}
