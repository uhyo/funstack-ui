// Firefox: drive the Playwright Firefox build over Marionette; read the parent-process accessibility
// tree (what AT clients see) through nsIAccessibilityService in the chrome context.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import net from "node:net";
import { run } from "./sequence.mjs";
const here = new URL(".", import.meta.url).pathname;
const FF = process.env.FF ?? `${process.env.HOME}/.cache/ms-playwright/firefox-1555/firefox/firefox`;
const html = readFileSync(here + "page.html");
const server = createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(html); }).listen(0);
const port = server.address().port;
const prof = mkdtempSync(here + "ffprof-");
writeFileSync(prof + "/user.js", [
  'user_pref("marionette.port", 2831);',
  'user_pref("accessibility.enable_all_cache_domains", true);',
  'user_pref("browser.shell.checkDefaultBrowser", false);',
  'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
  'user_pref("browser.aboutwelcome.enabled", false);',
  'user_pref("browser.startup.homepage_override.mstone", "ignore");',
].join("\n"));
const ff = spawn(FF, ["-headless", "-marionette", "-remote-allow-system-access", "-no-remote", "-profile", prof], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 6000));
const sock = net.connect(2831, "127.0.0.1");
let buf = Buffer.alloc(0); const waiters = [];
sock.on("data", (d) => { buf = Buffer.concat([buf, d]); for (;;) { const i = buf.indexOf(58); if (i < 0) break; const n = +buf.subarray(0, i).toString(); if (buf.length < i + 1 + n) break; const msg = JSON.parse(buf.subarray(i + 1, i + 1 + n).toString()); buf = buf.subarray(i + 1 + n); waiters.shift()?.(msg); } });
let mid = 0;
const send = (name, params) => new Promise((r, j) => { waiters.push((m) => (m[2] ? j(new Error(JSON.stringify(m[2]))) : r(m[3]))); const s = JSON.stringify([0, ++mid, name, params]); sock.write(Buffer.byteLength(s) + ":" + s); });
await new Promise((r) => waiters.push(r));
await send("WebDriver:NewSession", {});
let ctx = "content";
const setCtx = async (c) => { if (ctx !== c) { await send("Marionette:SetContext", { value: c }); ctx = c; } };
const exec = async (c, script, args = []) => { await setCtx(c); return (await send("WebDriver:ExecuteScript", { script, args })).value; };
const version = await exec("chrome", "return Services.appinfo.version");
await setCtx("content");
await send("WebDriver:Navigate", { url: `http://127.0.0.1:${port}/` });
for (let i = 0; i < 50 && !(await exec("content", "return !!window.__ready")); i++) await new Promise((r) => setTimeout(r, 100));
const AX = `
const [ids] = arguments;
const svc = Cc["@mozilla.org/accessibilityService;1"].getService(Ci.nsIAccessibilityService);
const win = Services.wm.getMostRecentWindow("navigator:browser");
const queue = [svc.getAccessibleFor(win.gBrowser.selectedBrowser)];
const out = {};
while (queue.length) {
  const a = queue.shift();
  if (!a) continue;
  let id = null; try { id = a.id; } catch {}
  if (id && ids.includes(id)) {
    const s = {}, x = {}; a.getState(s, x);
    const states = [...svc.getStringStates(s.value, x.value)].filter((n) => /expand|collaps/.test(n));
    out[id] = svc.getStringRole(a.role) + " [" + states.join(",") + "]";
  }
  for (let c = a.firstChild; c; c = c.nextSibling) queue.push(c);
}
return out;`;
const d = {
  eval: (js) => exec("content", `return (${js});`),
  async ax(probes) {
    const map = await exec("content", `return arguments[0].map((p) => { const e = document.querySelector('[data-probe="' + p + '"]') ?? document.getElementById(p); if (!e.id) e.id = 'probe-' + p; return e.id; });`, [probes]);
    const res = await exec("chrome", AX, [map]);
    return Object.fromEntries(probes.map((p, i) => [p, res[map[i]] ?? "(not found)"]));
  },
};
console.log("firefox", version);
// Warm-up: the first call starts the accessibility service; the tree arrives asynchronously.
await d.ax(["a-cf-false"]); await new Promise((r) => setTimeout(r, 2000));
try { await run(d, console.log); } finally { sock.end(); ff.kill(); server.close(); }
