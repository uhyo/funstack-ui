// React 19.3.1 + <select> probes (2026-10-17). Copy into packages/ui/src/__tests__/ to run with
// `pnpm --filter @funstack/ui exec vitest run --project browser <file>`, then delete.
import { Suspense, startTransition, use, useOptimistic, useState } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { flushSync } from "react-dom";
import { afterAll, test } from "vitest";
import { commands, server } from "vitest/browser";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lines: string[] = [];
const log = (...a: unknown[]) => lines.push(`[${server.browser}] ` + a.map((x) => (typeof x === "string" ? x : String(x))).join(" "));
afterAll(async () => { await commands.writeFile(`./zz-out-${server.browser}.txt`, lines.join("\n") + "\n"); });
const css = document.createElement("style");
css.textContent = `select.c, select.c::picker(select) { appearance: base-select; }`;
document.head.append(css);

function mount(node: React.ReactNode) {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  flushSync(() => root.render(node));
  return { el, root };
}
function pick(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

test("A: controlled select, async transition, no optimistic", async () => {
  function App() {
    const [v, setV] = useState("a");
    return (
      <select className="c" value={v} onChange={(e) => { const nv = e.target.value; startTransition(async () => { await sleep(150); startTransition(() => setV(nv)); }); }}>
        <button><selectedcontent /></button>
        <option value="a">A</option><option value="b"><b>B</b> rich</option><option value="c">C</option>
      </select>
    );
  }
  const { el, root } = mount(<App />);
  const s = el.querySelector("select")!; const sc = el.querySelector("selectedcontent");
  pick(s, "b");
  log("A sync after change:", s.value, sc?.textContent);
  await sleep(0); log("A after microtask:", s.value, sc?.textContent);
  await sleep(50); log("A pending:", s.value, sc?.textContent);
  await sleep(200); log("A committed:", s.value, sc?.textContent);
  root.unmount(); el.remove();
});

test("B: controlled select, async transition + useOptimistic", async () => {
  function App() {
    const [v, setV] = useState("a");
    const [ov, setOv] = useOptimistic(v);
    return (
      <select className="c" value={ov} onChange={(e) => { const nv = e.target.value; startTransition(async () => { setOv(nv); await sleep(150); startTransition(() => setV(nv)); }); }}>
        <button><selectedcontent /></button>
        <option value="a">A</option><option value="b"><b>B</b> rich</option><option value="c">C</option>
      </select>
    );
  }
  const { el, root } = mount(<App />);
  const s = el.querySelector("select")!; const sc = el.querySelector("selectedcontent");
  pick(s, "b");
  log("B sync after change:", s.value, sc?.textContent);
  await sleep(0); log("B after microtask:", s.value, sc?.textContent);
  await sleep(50); log("B pending:", s.value, sc?.textContent);
  await sleep(200); log("B committed:", s.value, sc?.textContent);
  root.unmount(); el.remove();
});

test("C: options inside Suspense, value set before they load", async () => {
  let resolve!: (v: string[]) => void;
  const p = new Promise<string[]>((r) => (resolve = r));
  function Options() { return use(p).map((x) => <option key={x} value={x}>{x.toUpperCase()}</option>); }
  function App() {
    return (
      <select className="c" value="c" onChange={() => {}}>
        <button><selectedcontent /></button>
        <Suspense fallback={<option value="" disabled>Loading…</option>}><Options /></Suspense>
      </select>
    );
  }
  const { el, root } = mount(<App />);
  const s = el.querySelector("select")!;
  log("C before load:", JSON.stringify(s.value), el.querySelector("selectedcontent")?.textContent);
  resolve(["a", "b", "c"]);
  await sleep(50);
  log("C after load:", JSON.stringify(s.value), "selectedIndex", s.selectedIndex, el.querySelector("selectedcontent")?.textContent);
  root.unmount(); el.remove();
});

test("D: React re-render of the selected option's content updates <selectedcontent>?", async () => {
  let setLabel!: (s: string) => void;
  function App() {
    const [label, sl] = useState("Bee");
    setLabel = sl;
    return (
      <select className="c" defaultValue="b">
        <button><selectedcontent /></button>
        <option value="a">A</option><option value="b"><i>{label}</i></option>
      </select>
    );
  }
  const { el, root } = mount(<App />);
  const sc = el.querySelector("selectedcontent")!;
  log("D initial:", sc.innerHTML);
  flushSync(() => setLabel("Bumblebee"));
  await sleep(20);
  log("D after content change:", sc.innerHTML);
  root.unmount(); el.remove();
});

test("E: SSR + hydrateRoot of select with button/selectedcontent/rich options (real parser via iframe)", async () => {
  function App({ onPick }: { onPick?: () => void }) {
    const [v, setV] = useState("b");
    return (
      <form>
        <select className="c" name="fruit" value={v} onChange={(e) => { setV(e.target.value); onPick?.(); }}>
          <button type="button"><selectedcontent /></button>
          <option value="a"><span aria-hidden="true">🍎</span> Apple</option>
          <optgroup label="More"><option value="b"><span aria-hidden="true">🍌</span> <b>Banana</b></option></optgroup>
          <hr />
          <option value="c">Cherry</option>
        </select>
      </form>
    );
  }
  const html = renderToString(<App />);
  log("E ssr html:", html);
  const iframe = document.createElement("iframe");
  iframe.srcdoc = `<!doctype html><style>select.c, select.c::picker(select){appearance:base-select}</style><div id="root">${html}</div>`;
  document.body.append(iframe);
  await new Promise((r) => (iframe.onload = r));
  const doc = iframe.contentDocument!;
  const container = doc.getElementById("root")!;
  log("E parsed (pre-hydration):", container.innerHTML);
  const errors: string[] = [];
  const origError = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.map(String).join(" ").slice(0, 400)); };
  const recoverable: string[] = [];
  const before = container.querySelector("select");
  hydrateRoot(container, <App />, { onRecoverableError: (e) => recoverable.push(String((e as Error).message).slice(0, 300)) });
  await sleep(100);
  console.error = origError;
  log("E same select node after hydration:", before === container.querySelector("select"));
  log("E console.error:", JSON.stringify(errors));
  log("E recoverable:", JSON.stringify(recoverable));
  log("E post-hydration selectedcontent:", container.querySelector("selectedcontent")?.innerHTML);
  const s = container.querySelector("select")!;
  s.value = "c"; s.dispatchEvent(new Event("change", { bubbles: true }));
  await sleep(50);
  log("E after change:", s.value, container.querySelector("selectedcontent")?.textContent);
  iframe.remove();
});
