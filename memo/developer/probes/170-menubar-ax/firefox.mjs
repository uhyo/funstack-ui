// Firefox: drive the Playwright Firefox build over Marionette and read the parent-process
// accessibility tree (what AT clients see) through nsIAccessibilityService in the chrome context.
// Driver from memo/architect/probes/121-popovertarget/ax-firefox.mjs.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { pw, html, openFile } from "./common.mjs";
const FF = process.env.FF ?? pw.firefox.executablePath();
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
}).listen(0);
const port = server.address().port;
const prof = mkdtempSync(tmpdir() + "/ffprof-");
writeFileSync(
  prof + "/user.js",
  [
    'user_pref("marionette.port", 2832);',
    'user_pref("accessibility.enable_all_cache_domains", true);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("browser.startup.homepage_override.mstone", "ignore");',
  ].join("\n"),
);
const ff = spawn(FF, ["-headless", "-marionette", "-remote-allow-system-access", "-no-remote", "-profile", prof], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 6000));
const sock = net.connect(2832, "127.0.0.1");
let buf = Buffer.alloc(0);
const waiters = [];
sock.on("data", (d) => {
  buf = Buffer.concat([buf, d]);
  for (;;) {
    const i = buf.indexOf(58);
    if (i < 0) break;
    const n = +buf.subarray(0, i).toString();
    if (buf.length < i + 1 + n) break;
    const msg = JSON.parse(buf.subarray(i + 1, i + 1 + n).toString());
    buf = buf.subarray(i + 1 + n);
    waiters.shift()?.(msg);
  }
});
let mid = 0;
const send = (name, params) =>
  new Promise((r, j) => {
    waiters.push((m) => (m[2] ? j(new Error(JSON.stringify(m[2]))) : r(m[3])));
    const s = JSON.stringify([0, ++mid, name, params]);
    sock.write(Buffer.byteLength(s) + ":" + s);
  });
await new Promise((r) => waiters.push(r));
await send("WebDriver:NewSession", {});
let ctx = "content";
const setCtx = async (c) => {
  if (ctx !== c) {
    await send("Marionette:SetContext", { value: c });
    ctx = c;
  }
};
const exec = async (c, script, args = []) => {
  await setCtx(c);
  return (await send("WebDriver:ExecuteScript", { script, args })).value;
};
const version = await exec("chrome", "return Services.appinfo.version");
await setCtx("content");
await send("WebDriver:Navigate", { url: `http://127.0.0.1:${port}/` });
for (let i = 0; i < 50 && !(await exec("content", "return !!window.__ready")); i++)
  await new Promise((r) => setTimeout(r, 100));
// The subtree of the element with id "bar": role "name" [states], children indented.
const TREE = `
const svc = Cc["@mozilla.org/accessibilityService;1"].getService(Ci.nsIAccessibilityService);
const win = Services.wm.getMostRecentWindow("navigator:browser");
const queue = [svc.getAccessibleFor(win.gBrowser.selectedBrowser)];
let bar = null;
while (queue.length && !bar) {
  const a = queue.shift();
  if (!a) continue;
  let id = null; try { id = a.id; } catch {}
  if (id === "bar") { bar = a; break; }
  for (let c = a.firstChild; c; c = c.nextSibling) queue.push(c);
}
if (!bar) return "(bar not found)";
const lines = [];
const walk = (a, depth) => {
  const role = svc.getStringRole(a.role);
  if (role === "text leaf") return;
  const s = {}, x = {}; a.getState(s, x);
  const states = [...svc.getStringStates(s.value, x.value)].filter((n) => /expand|collaps|haspopup|unavailable|focused|checked/.test(n));
  let parent = ""; try { parent = svc.getStringRole(a.parent.role); } catch {}
  lines.push("  ".repeat(depth) + role + ' "' + (a.name ?? "") + '" [' + states.join(",") + "]");
  for (let c = a.firstChild; c; c = c.nextSibling) walk(c, depth + 1);
};
walk(bar, 0);
return lines.join("\\n");`;
const tree = () => exec("chrome", TREE);
console.log("firefox", version);
try {
  await tree();
  await new Promise((r) => setTimeout(r, 2000));
  console.log("--- closed\n" + (await tree()));
  await exec("content", `return (() => { ${openFile} })()`);
  let open = "(bar not found)";
  for (let i = 0; i < 20 && open === "(bar not found)"; i++) {
    await new Promise((r) => setTimeout(r, 500));
    open = await tree();
  }
  console.log("--- File open\n" + open);
} finally {
  sock.end();
  ff.kill();
  server.close();
  setTimeout(() => rmSync(prof, { recursive: true, force: true }), 500);
}
