// Follow-up probes (2026-10-17): Suspense-loaded options, selectedcontent staleness, hydration variants.
// Copy into packages/ui/src/__tests__/ and run with vitest --project browser; output via commands.writeFile.
import { Suspense, use, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { flushSync } from "react-dom";
import { afterAll, test } from "vitest";
import { commands, server } from "vitest/browser";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lines: string[] = [];
const log = (...a: unknown[]) => lines.push(`[${server.browser}] ` + a.map(String).join(" "));
afterAll(async () => { await commands.writeFile(`./zz-out2-${server.browser}.txt`, lines.join("\n") + "\n"); });
const css = document.createElement("style");
css.textContent = `select.c, select.c::picker(select) { appearance: base-select; }`;
document.head.append(css);

for (const cls of ["c", ""]) {
  for (const fallback of ["disabled-option", "enabled-option", "null"]) {
    test(`C2: Suspense options class=${cls || "native"} fallback=${fallback}`, async () => {
      let resolve!: (v: string[]) => void;
      const p = new Promise<string[]>((r) => (resolve = r));
      function Options() { return use(p).map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>); }
      const fb = fallback === "null" ? null : <option value="" disabled={fallback === "disabled-option"}>Loading…</option>;
      const el = document.createElement("div"); document.body.append(el);
      const root = createRoot(el);
      flushSync(() => root.render(<select className={cls} value="c" onChange={() => {}}><Suspense fallback={fb}><Options /></Suspense></select>));
      const s = el.querySelector("select")!;
      log(`C2 ${cls || "native"}/${fallback} before:`, JSON.stringify(s.value), s.selectedIndex);
      resolve(["a", "b", "c"]);
      await sleep(600);
      log(`C2 ${cls || "native"}/${fallback} after:`, JSON.stringify(s.value), s.selectedIndex, s.innerHTML);
      root.unmount(); el.remove();
    });
  }
}

test("C3: options replaced by a parent re-render (not Suspense)", async () => {
  let setOpts!: (o: string[]) => void;
  function App() {
    const [opts, so] = useState<string[]>([]);
    setOpts = so;
    return <select className="c" value="c" onChange={() => {}}>{opts.map((x) => <option key={x} value={x}>{x}</option>)}</select>;
  }
  const el = document.createElement("div"); document.body.append(el);
  const root = createRoot(el);
  flushSync(() => root.render(<App />));
  flushSync(() => setOpts(["a", "b", "c"]));
  log("C3 after parent re-render:", el.querySelector("select")!.value);
  root.unmount(); el.remove();
});

test("D2: forcing a <selectedcontent> refresh after the selected option's content changed", async () => {
  const el = document.createElement("div"); document.body.append(el);
  el.innerHTML = `<select class="c"><button><selectedcontent></selectedcontent></button><option value="a">A</option><option value="b" selected><i>Bee</i></option></select>`;
  const s = el.querySelector("select")!, sc = el.querySelector("selectedcontent")!, o = s.options[1];
  o.querySelector("i")!.textContent = "Bumblebee"; await sleep(10);
  log("D2 text mutation:", sc.innerHTML);
  o.selected = true; await sleep(10); log("D2 selected=true again:", sc.innerHTML);
  s.value = "b"; await sleep(10); log("D2 value=same:", sc.innerHTML);
  s.selectedIndex = -1; s.selectedIndex = 1; await sleep(10); log("D2 deselect+reselect:", sc.innerHTML);
  o.append(" (more)"); await sleep(10); log("D2 append child:", sc.innerHTML);
  const btn = s.querySelector("button")!; const sc2 = sc; sc2.remove(); btn.append(sc2); await sleep(10); log("D2 reinsert selectedcontent:", sc2.innerHTML);
  el.remove();
});

type Variant = "selectedcontent" | "selectedcontent-dsih" | "selectedcontent-dsih-shw" | "button-text" | "no-button";
for (const variant of ["selectedcontent", "selectedcontent-dsih", "selectedcontent-dsih-shw", "button-text", "no-button"] as Variant[]) {
  test(`E2: hydration variant ${variant}`, async () => {
    function App() {
      const [v, setV] = useState("b");
      return (
        <select className="c" name="fruit" value={v} onChange={(e) => setV(e.target.value)}>
          {variant === "selectedcontent" && <button type="button"><selectedcontent /></button>}
          {variant === "selectedcontent-dsih" && <button type="button"><selectedcontent dangerouslySetInnerHTML={{ __html: "" }} /></button>}
          {variant === "selectedcontent-dsih-shw" && <button type="button"><selectedcontent suppressHydrationWarning dangerouslySetInnerHTML={{ __html: "" }} /></button>}
          {variant === "button-text" && <button type="button">{v.toUpperCase()}</button>}
          <option value="a"><span aria-hidden="true">*</span> Apple</option>
          <option value="b"><b>Banana</b></option>
        </select>
      );
    }
    const html = renderToString(<App />);
    const iframe = document.createElement("iframe");
    iframe.srcdoc = `<!doctype html><style>select.c, select.c::picker(select){appearance:base-select}</style><div id="root">${html}</div>`;
    document.body.append(iframe);
    await new Promise((r) => (iframe.onload = r));
    const container = iframe.contentDocument!.getElementById("root")!;
    const errors: string[] = []; const recoverable: string[] = [];
    const orig = console.error; console.error = (...a: unknown[]) => errors.push(a.map(String).join(" ").slice(0, 200));
    const before = container.querySelector("select");
    hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(String((e as Error).message).slice(0, 120)) });
    await sleep(100);
    console.error = orig;
    log(`E2 ${variant}: kept select=${before === container.querySelector("select")} errors=${JSON.stringify(errors)} recoverable=${JSON.stringify(recoverable)}`);
    const s = container.querySelector("select")!;
    s.value = "a"; s.dispatchEvent(new Event("change", { bubbles: true })); await sleep(50);
    log(`E2 ${variant}: after change value=${s.value} button=${JSON.stringify(container.querySelector("button")?.innerHTML ?? null)}`);
    iframe.remove();
  });
}
