// Field/Form probes (2026-10-17, wave 5): constraint validation x React 19.3 form actions.
// Copy into packages/ui/src/__tests__/ and run in packages/ui with
//   FUNSTACK_BROWSERS=chromium,firefox pnpm exec vitest run --project browser src/__tests__/react-form.browser.test.tsx
// Output is written by commands.writeFile to packages/ui/zz-form-<browser>.txt.
import { useActionState, useState, useEffect, useRef, startTransition as startTransitionShim } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterAll, test } from "vitest";
import { commands, server, userEvent } from "vitest/browser";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lines: string[] = [];
const log = (...a: unknown[]) => lines.push(`[${server.browser}] ` + a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
afterAll(async () => { await commands.writeFile(`./zz-form-${server.browser}.txt`, lines.join("\n") + "\n"); });

function mount(node: React.ReactNode) {
  const el = document.createElement("div"); document.body.append(el);
  const root = createRoot(el);
  flushSync(() => root.render(node));
  return { el, done: () => { root.unmount(); el.remove(); } };
}
const ae = () => { const a = document.activeElement as HTMLElement | null; return a?.id || a?.tagName; };
const ui = (el: Element) => { try { return el.matches(":user-invalid"); } catch { return "n/a"; } };

test("F1 required field blocks the form action; invalid event; focus; :user-invalid", async () => {
  const calls: string[] = []; const invalids: string[] = [];
  const { el, done } = mount(
    <form id="f1" action={(fd) => { calls.push(String(fd.get("q"))); }}>
      <input id="q1" name="q" required onInvalid={(e) => invalids.push(e.type)} />
      <button id="b1">Submit</button>
    </form>);
  const q = el.querySelector("#q1")!;
  log("F1 :user-invalid before submit", ui(q), "validationMessage", (q as HTMLInputElement).validationMessage);
  await userEvent.click(el.querySelector("#b1")!); await sleep(50);
  log("F1 after click submit: action calls", calls, "invalid events", invalids, "focus", ae(), ":user-invalid", ui(q));
  log("F1 form action attribute", el.querySelector("form")!.getAttribute("action")?.slice(0, 60));
  done();
});

test("F2 invalid event canceled: no bubble -> does the browser still focus the field?", async () => {
  const calls: string[] = [];
  const { el, done } = mount(
    <form action={() => { calls.push("x"); }}>
      <input id="other" />
      <input id="q2" name="q" required onInvalid={(e) => e.preventDefault()} />
      <button id="b2">Submit</button>
    </form>);
  (el.querySelector("#other") as HTMLElement).focus();
  await userEvent.click(el.querySelector("#b2")!); await sleep(50);
  log("F2 canceled invalid: action calls", calls.length, "focus", ae(), ":user-invalid", ui(el.querySelector("#q2")!));
  done();
});

test("F3 noValidate: action runs with invalid data; requestSubmit validates", async () => {
  const calls: string[] = [];
  const { el, done } = mount(
    <form id="f3" noValidate action={(fd) => { calls.push("novalidate:" + fd.get("q")); }}>
      <input id="q3" name="q" required />
      <button id="b3">Submit</button>
    </form>);
  await userEvent.click(el.querySelector("#b3")!); await sleep(50);
  log("F3 noValidate click: calls", calls, ":user-invalid", ui(el.querySelector("#q3")!));
  done();
  const calls2: string[] = []; const inv: string[] = [];
  const m = mount(
    <form id="f3b" action={(fd) => { calls2.push("rs:" + fd.get("q")); }}>
      <input id="q3b" name="q" required onInvalid={() => inv.push("invalid")} />
    </form>);
  const form = m.el.querySelector("form")!;
  form.requestSubmit(); await sleep(50);
  log("F3 requestSubmit() on invalid form: calls", calls2, "invalid events", inv, "focus", ae());
  (m.el.querySelector("#q3b") as HTMLInputElement).value = "ok";
  form.requestSubmit(); await sleep(50);
  log("F3 requestSubmit() on valid form: calls", calls2);
  log("F3 checkValidity fires invalid?", (() => { inv.length = 0; (m.el.querySelector("#q3b") as HTMLInputElement).value = ""; const r = form.checkValidity(); return [r, inv.length]; })());
  m.done();
});

function Pending({ id }: { id: string }) {
  const s = useFormStatus();
  return <span id={id}>{s.pending ? "pending:" + String(s.data?.get("q")) : "idle"}</span>;
}

test("F4 useActionState returning field errors: auto reset of uncontrolled inputs, :user-invalid, setCustomValidity", async () => {
  let release!: () => void;
  function Form() {
    const [state, dispatch, isPending] = useActionState(async (_prev: { error?: string; value?: string }, fd: FormData) => {
      await new Promise<void>((r) => (release = r));
      const v = String(fd.get("q"));
      return v === "taken" ? { error: "Name is taken", value: v } : {};
    }, {});
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.setCustomValidity(state.error ?? ""); }, [state]);
    return (
      <form action={dispatch}>
        <input id="q4" name="q" ref={ref} required aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? "e4" : undefined} onInput={(e) => e.currentTarget.setCustomValidity("")} />
        {state.error && <p id="e4">{state.error}</p>}
        <Pending id="p4" />
        {createPortal(<Pending id="p4portal" />, document.body)}
        <span id="ip4">{String(isPending)}</span>
        <button id="b4">Save</button>
      </form>);
  }
  const { el, done } = mount(<Form />);
  const q = el.querySelector("#q4") as HTMLInputElement;
  await userEvent.fill(q, "taken");
  await userEvent.click(el.querySelector("#b4")!); await sleep(50);
  log("F4 pending: useFormStatus", document.getElementById("p4")!.textContent, "| in portal", document.getElementById("p4portal")?.textContent, "| isPending", el.querySelector("#ip4")!.textContent, "| input value during pending", q.value);
  release(); await sleep(100);
  log("F4 after error result: input value", JSON.stringify(q.value), "| valid", q.validity.valid, "customError", q.validity.customError, "| :user-invalid", ui(q), "| error shown", el.querySelector("#e4")?.textContent);
  await userEvent.fill(q, "free");
  log("F4 after typing again: valid", q.validity.valid, ":user-invalid", ui(q));
  // submit again with custom validity cleared by onInput
  await userEvent.click(el.querySelector("#b4")!); await sleep(50); release(); await sleep(100);
  log("F4 after success: input value", JSON.stringify(q.value), ":user-invalid", ui(q), "error", el.querySelector("#e4")?.textContent ?? null);
  done(); document.getElementById("p4portal")?.remove();
});

test("F5 setCustomValidity persists until cleared; blocks next submit", async () => {
  const calls: string[] = [];
  const { el, done } = mount(
    <form action={() => { calls.push("x"); }}>
      <input id="q5" name="q" />
      <button id="b5">Submit</button>
    </form>);
  const q = el.querySelector("#q5") as HTMLInputElement;
  q.setCustomValidity("Server says no");
  await userEvent.fill(q, "changed");
  log("F5 after typing (custom validity not cleared): valid", q.validity.valid, "msg", q.validationMessage);
  await userEvent.click(el.querySelector("#b5")!); await sleep(50);
  log("F5 submit blocked? calls", calls.length, ":user-invalid", ui(q));
  done();
});

test("F6 form.reset() clears :user-invalid (user validity flag)", async () => {
  const { el, done } = mount(
    <form>
      <input id="q6" name="q" required defaultValue="" />
      <button type="button" id="b6">x</button>
    </form>);
  const q = el.querySelector("#q6") as HTMLInputElement;
  await userEvent.fill(q, "a"); await userEvent.fill(q, "");
  (el.querySelector("#b6") as HTMLElement).focus();
  log("F6 after typing+clearing+blur: :user-invalid", ui(q));
  el.querySelector("form")!.reset();
  log("F6 after reset: :user-invalid", ui(q));
  done();
});

test("F7 controlled text input + successful form action: auto reset is a no-op for controlled", async () => {
  const calls: string[] = [];
  function Form() {
    const [v, setV] = useState("");
    return (
      <form action={async (fd) => { calls.push(String(fd.get("u"))); }}>
        <input id="q7" name="q" value={v} onChange={(e) => setV(e.target.value)} />
        <input id="u7" name="u" defaultValue="" />
        <button id="b7">Save</button>
      </form>);
  }
  const { el, done } = mount(<Form />);
  await userEvent.fill(el.querySelector("#q7")!, "controlled");
  await userEvent.fill(el.querySelector("#u7")!, "uncontrolled");
  await userEvent.click(el.querySelector("#b7")!); await sleep(400);
  log("F7 action calls", calls);
  log("F7 after successful action: controlled", JSON.stringify((el.querySelector("#q7") as HTMLInputElement).value), "uncontrolled", JSON.stringify((el.querySelector("#u7") as HTMLInputElement).value));
  done();
});

test("F8 returning submitted values as defaultValue survives the auto reset; onSubmit+dispatch avoids reset", async () => {
  function FormA() {
    const [state, dispatch] = useActionState(async (_p: { q: string }, fd: FormData) => ({ q: String(fd.get("q")) }), { q: "" });
    return (<form action={dispatch}><input id="q8a" name="q" defaultValue={state.q} /><button id="b8a">Save</button></form>);
  }
  const a = mount(<FormA />);
  await userEvent.fill(a.el.querySelector("#q8a")!, "kept"); await userEvent.click(a.el.querySelector("#b8a")!); await sleep(300);
  log("F8a defaultValue={state.q} after action:", JSON.stringify((a.el.querySelector("#q8a") as HTMLInputElement).value));
  a.done();
  function FormB() {
    const [, dispatch, isPending] = useActionState(async (_p: null, fd: FormData) => { await sleep(50); void fd; return null; }, null);
    return (<form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransitionShim(() => dispatch(fd)); }}>
      <input id="q8b" name="q" required /><span id="ip8b">{String(isPending)}</span><Pending id="p8b" /><button id="b8b">Save</button></form>);
  }
  const b = mount(<FormB />);
  await userEvent.fill(b.el.querySelector("#q8b")!, "kept"); await userEvent.click(b.el.querySelector("#b8b")!); await sleep(10);
  log("F8b onSubmit+dispatch while pending: isPending", b.el.querySelector("#ip8b")!.textContent, "useFormStatus", b.el.querySelector("#p8b")!.textContent);
  await sleep(300);
  log("F8b onSubmit+dispatch after action:", JSON.stringify((b.el.querySelector("#q8b") as HTMLInputElement).value));
  b.done();
});
