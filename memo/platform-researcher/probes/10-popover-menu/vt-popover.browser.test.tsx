// Probe: does a React <ViewTransition> animate a popover opened/closed by the library inside a
// transition commit (showPopover/hidePopover in a layout effect)?
// Copy to packages/ui/src/__tests__/ and run:
//   pnpm --filter @funstack/ui exec vitest run --project browser src/__tests__/vt-popover.browser.test.tsx --silent=false
// Delete the copy afterwards. Output (2026-10-17) in vt-popover.output.txt.
import { startTransition, useLayoutEffect, useRef, useState, ViewTransition } from "react";
import { createRoot } from "react-dom/client";
import { it } from "vitest";
import { server } from "vitest/browser";

type Variant = "content-in-vt" | "vt-wraps-popover" | "no-vt";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function run(variant: Variant) {
  const doc = document as Document & { startViewTransition: (...a: any[]) => any };
  const orig = doc.startViewTransition.bind(doc);
  const recs: { pseudo: string[]; openAtUpdate?: boolean; error?: string }[] = [];
  doc.startViewTransition = (arg: any) => {
    const rec: (typeof recs)[number] = { pseudo: [] };
    recs.push(rec);
    const update = typeof arg === "function" ? arg : arg.update;
    const wrapped = async () => {
      const r = await update();
      rec.openAtUpdate = document.getElementById("pop")?.matches(":popover-open");
      return r;
    };
    const vt = orig(typeof arg === "function" ? wrapped : { ...arg, update: wrapped });
    vt.ready.then(
      () => {
        rec.pseudo = document
          .getAnimations()
          .map((a) => (a.effect as KeyframeEffect).pseudoElement ?? "")
          .filter(Boolean);
      },
      (e: Error) => (rec.error = String(e)),
    );
    return vt;
  };
  const style = document.createElement("style");
  style.textContent = `[popover]{margin:0} ::view-transition-group(*){animation-duration:200ms}`;
  document.head.append(style);
  const host = document.createElement("div");
  document.body.append(host);
  let setOpen!: (v: boolean) => void;
  function App() {
    const [open, _set] = useState(false);
    setOpen = _set;
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
      const el = ref.current!;
      if (open && !el.matches(":popover-open")) el.showPopover();
      if (!open && el.matches(":popover-open")) el.hidePopover();
    }, [open]);
    const content = open ? <p>Menu content</p> : null;
    if (variant === "vt-wraps-popover")
      return (
        <ViewTransition enter="x" exit="x" update="x">
          <div id="pop" popover="manual" ref={ref}>
            static
          </div>
        </ViewTransition>
      );
    return (
      <div id="pop" popover="manual" ref={ref}>
        {variant === "content-in-vt" ? <ViewTransition enter="x" exit="x">{content}</ViewTransition> : content}
      </div>
    );
  }
  const root = createRoot(host);
  root.render(<App />);
  await sleep(50);
  startTransition(() => setOpen(true));
  await sleep(400);
  startTransition(() => setOpen(false));
  await sleep(400);
  root.unmount();
  host.remove();
  style.remove();
  doc.startViewTransition = orig;
  console.log(`VTPOP ${JSON.stringify({ ua: server.browser, variant, recs })}`);
}

it("probe", async () => {
  for (const v of ["content-in-vt", "vt-wraps-popover", "no-vt"] as Variant[]) await run(v);
}, 20000);
