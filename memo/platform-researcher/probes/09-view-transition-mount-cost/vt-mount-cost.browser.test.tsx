// Probe for issue #35: does a <ViewTransition default="none"> that mounts in a transition commit
// start a document view transition, and how long does the next transition commit wait?
// Copy to packages/ui/src/__tests__/ and run:
//   pnpm --filter @funstack/ui exec vitest run --project browser src/__tests__/vt-mount-cost.browser.test.tsx
//     --silent=false
// Results are printed as `VTPROBE`, `VTPROBE-TABS` and `VTPROBE-HIT` console lines; the output from
// 2026-10-16 (Chromium 156, Firefox 157, react-dom 19.3.1) is in output.txt next to this file.
// Delete the copy from packages/ui/src/__tests__/ afterwards.
import {
  Activity,
  startTransition,
  useEffect,
  useLayoutEffect,
  useState,
  ViewTransition,
} from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { it } from "vitest";
import { userEvent } from "vitest/browser";
import { Tabs } from "../tabs/index.js";

type Variant =
  | "baseline-no-vt"
  | "mount-default-none"
  | "mount-default-none-enter-exit-none"
  | "mount-default-map-none"
  | "mount-default-none+css-root-animation-none"
  | "mount-default-none+css-root-duration-0"
  | "mount-default-none+html-vt-name-none"
  | "mount-default-none+css-group-star-animation-none"
  | "mount-vt-inside-new-subtree"
  | "mount-vt-under-function-wrapper"
  | "activity-reveal-default-none"
  | "unmount-default-none"
  | "update-inside-default-none"
  | "conditional-vt-omitted"
  | "consumer-fade-plus-mount-none"
  | "consumer-fade-plus-mount-none+css-root-animation-none"
  | "consumer-fade-plus-mount-none+html-vt-name-none";

const CSS: Partial<Record<Variant, string>> = {
  "mount-default-none+css-root-animation-none":
    "::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation:none}",
  "mount-default-none+css-root-duration-0":
    "::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation-duration:0s}",
  "mount-default-none+html-vt-name-none": ":root{view-transition-name:none}",
  "mount-default-none+css-group-star-animation-none":
    "::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none}",
  "consumer-fade-plus-mount-none+css-root-animation-none":
    "::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation:none}",
  "consumer-fade-plus-mount-none+html-vt-name-none": ":root{view-transition-name:none}",
};
const CONSUMER_CSS =
  "@keyframes probe-fade{from{opacity:0}to{opacity:1}}" +
  "::view-transition-new(.probe-fade){animation:300ms linear both probe-fade}" +
  "::view-transition-old(.probe-fade){animation:none;opacity:0}";

const now = () => performance.now();
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface VtRec {
  calledAt: number;
  readyAt?: number;
  finishedAt?: number;
  pseudo: string[];
}
interface Record_ {
  vtCalls: number;
  vtError: string | null;
  pseudo: string[];
  vts: VtRec[];
  pending: Promise<unknown>[];
  t: Record<string, number>;
}

async function runOnce(variant: Variant): Promise<Record_> {
  const rec: Record_ = { vtCalls: 0, vtError: null, pseudo: [], vts: [], pending: [], t: {} };
  const doc = document as Document & { startViewTransition?: (...a: unknown[]) => unknown };
  const orig = doc.startViewTransition;
  if (orig) {
    doc.startViewTransition = function (this: Document, ...args: unknown[]) {
      rec.vtCalls++;
      try {
        const vr: VtRec = { calledAt: now(), pseudo: [] };
        rec.vts.push(vr);
        const vt = orig.apply(this, args) as ViewTransition_;
        rec.pending.push(vt.finished.catch(() => {}));
        vt.ready.then(
          () => {
            vr.readyAt = now();
            vr.pseudo = document.documentElement
              .getAnimations({ subtree: true })
              .map((a) => {
                const e = a.effect as KeyframeEffect;
                return `${e.pseudoElement} ${String(e.getTiming().duration)}ms`;
              })
              .filter((s) => s.startsWith("::view-transition"));
          },
          (e) => (rec.vtError = String(e)),
        );
        vt.finished.then(() => (vr.finishedAt = now()));
        return vt;
      } catch (e) {
        rec.vtError = String(e);
        throw e;
      }
    };
  }
  const style = document.createElement("style");
  style.textContent = (CSS[variant] ?? "") + (variant.startsWith("consumer") ? CONSUMER_CSS : "");
  document.head.append(style);

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  let setStep!: (n: number) => void;
  let setCounter!: (n: number) => void;

  function Subject({ children }: { children: ReactNode }) {
    useLayoutEffect(() => {
      rec.t["commit1"] ??= now();
      // Kick off the second transition as soon as the first has committed.
      setTimeout(() => {
        rec.t["start2"] = now();
        startTransition(() => setCounter(1));
      }, 0);
    }, []);
    useEffect(() => {
      rec.t["passive1"] ??= now();
    }, []);
    return <>{children}</>;
  }
  function Counter({ n }: { n: number }) {
    useLayoutEffect(() => {
      if (n === 1) rec.t["commit2"] = now();
    }, [n]);
    return <p>counter {n}</p>;
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }
  function App() {
    const [step, s1] = useState(0);
    const [counter, s2] = useState(0);
    setStep = s1;
    setCounter = s2;
    const content = <div style={{ width: 200, height: 50, background: "teal" }}>panel</div>;
    let subject: ReactNode = null;
    switch (variant) {
      case "baseline-no-vt":
      case "conditional-vt-omitted":
        subject = step === 1 ? <Subject>{content}</Subject> : null;
        break;
      case "mount-default-none-enter-exit-none":
        subject =
          step === 1 ? (
            <Subject>
              <ViewTransition default="none" enter="none" exit="none" update="none" share="none">
                {content}
              </ViewTransition>
            </Subject>
          ) : null;
        break;
      case "mount-default-map-none":
        subject =
          step === 1 ? (
            <Subject>
              <ViewTransition default={{ default: "none" }}>{content}</ViewTransition>
            </Subject>
          ) : null;
        break;
      case "mount-vt-inside-new-subtree":
        subject =
          step === 1 ? (
            <Subject>
              <section>
                <div>
                  <ViewTransition default="none">{content}</ViewTransition>
                </div>
              </section>
            </Subject>
          ) : null;
        break;
      case "mount-vt-under-function-wrapper":
        subject =
          step === 1 ? (
            <Subject>
              <Wrapper>
                <ViewTransition default="none">{content}</ViewTransition>
              </Wrapper>
            </Subject>
          ) : null;
        break;
      case "activity-reveal-default-none":
        subject = (
          <Activity mode={step === 1 ? "visible" : "hidden"}>
            {step === 1 ? (
              <Subject>
                <ViewTransition default="none">{content}</ViewTransition>
              </Subject>
            ) : (
              <ViewTransition default="none">{content}</ViewTransition>
            )}
          </Activity>
        );
        break;
      case "unmount-default-none":
        subject =
          step === 1 ? (
            <Subject>{null}</Subject>
          ) : (
            <ViewTransition default="none">{content}</ViewTransition>
          );
        break;
      case "update-inside-default-none":
        subject = (
          <ViewTransition default="none">
            <div>{step === 1 ? <Subject>updated</Subject> : "initial"}</div>
          </ViewTransition>
        );
        break;
      default:
        subject =
          step === 1 ? (
            <Subject>
              <ViewTransition default="none">{content}</ViewTransition>
            </Subject>
          ) : null;
    }
    const consumer = variant.startsWith("consumer") ? (
      <ViewTransition default="probe-fade">
        <div>consumer {step}</div>
      </ViewTransition>
    ) : null;
    return (
      <>
        {consumer}
        {subject}
        <Counter n={counter} />
      </>
    );
  }

  root.render(<App />);
  await frame();
  await frame();
  await sleep(50);
  rec.t["start1"] = now();
  startTransition(() => setStep(1));
  const deadline = now() + 3000;
  while (rec.t["commit2"] === undefined && now() < deadline) await sleep(5);
  await Promise.all(rec.pending);
  await sleep(20);
  root.unmount();
  host.remove();
  style.remove();
  if (orig) doc.startViewTransition = orig;
  await sleep(50);
  return rec;
}
interface ViewTransition_ {
  ready: Promise<void>;
  finished: Promise<void>;
}

const VARIANTS: Variant[] = [
  "baseline-no-vt",
  "conditional-vt-omitted",
  "mount-default-none",
  "mount-default-none-enter-exit-none",
  "mount-default-map-none",
  "mount-vt-inside-new-subtree",
  "mount-vt-under-function-wrapper",
  "activity-reveal-default-none",
  "unmount-default-none",
  "update-inside-default-none",
  "mount-default-none+css-root-animation-none",
  "mount-default-none+css-root-duration-0",
  "mount-default-none+css-group-star-animation-none",
  "mount-default-none+html-vt-name-none",
  "consumer-fade-plus-mount-none",
  "consumer-fade-plus-mount-none+css-root-animation-none",
  "consumer-fade-plus-mount-none+html-vt-name-none",
];

it("measures", { timeout: 120_000 }, async () => {
  const ua = navigator.userAgent;
  for (const v of VARIANTS) {
    const runs: Record_[] = [];
    for (let i = 0; i < 5; i++) runs.push(await runOnce(v));
    const med = (f: (r: Record_) => number | undefined) => {
      const xs = runs.map(f).filter((x): x is number => x !== undefined && !Number.isNaN(x));
      xs.sort((a, b) => a - b);
      return xs.length ? Math.round(xs[Math.floor(xs.length / 2)]!) : null;
    };
    const r0 = runs[0]!;
    console.log(
      "VTPROBE " +
        JSON.stringify({
          ua: ua.includes("Firefox") ? "firefox" : ua.includes("Chrome") ? "chromium" : ua,
          variant: v,
          vtCalls: r0.vtCalls,
          vtError: r0.vtError,
          vtsPerRun: r0.vts.length,
          pseudoFirstVt: r0.vts[0]?.pseudo ?? [],
          pseudoSecondVt: r0.vts[1]?.pseudo ?? [],
          commit1: med((r) => r.t["commit1"]! - r.t["start1"]!),
          passive1: med((r) => r.t["passive1"]! - r.t["start1"]!),
          commit2Wait: med((r) => r.t["commit2"]! - r.t["start2"]!),
          vt1Finished: med((r) => (r.vts[0]?.finishedAt ?? NaN) - r.t["start1"]!),
          vt2CalledAfterStart2: med((r) => (r.vts[1]?.calledAt ?? NaN) - r.t["start2"]!),
        }),
    );
  }
});

// Real Tabs.Panel from master: click B, and as soon as panel B is in the DOM click C; measure
// click C -> panel C in the DOM. Uncontrolled, no action: the switch commits in a transition.
async function tabsRun(keepMounted: false | true, transition: "none" | undefined, css = "") {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  const vts: number[] = [];
  const doc = document as Document & { startViewTransition: (...a: unknown[]) => unknown };
  const orig = doc.startViewTransition;
  const pending: Promise<unknown>[] = [];
  doc.startViewTransition = function (this: Document, ...args: unknown[]) {
    vts.push(now());
    const vt = orig.apply(this, args) as ViewTransition_;
    pending.push(vt.finished.catch(() => {}));
    return vt;
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(
    <Tabs.Root defaultValue="a">
      <Tabs.List aria-label="t">
        <Tabs.Tab value="a">A</Tabs.Tab>
        <Tabs.Tab value="b">B</Tabs.Tab>
        <Tabs.Tab value="c">C</Tabs.Tab>
      </Tabs.List>
      {(["a", "b", "c"] as const).map((v) => (
        <Tabs.Panel key={v} value={v} keepMounted={keepMounted} transition={transition}>
          <span data-probe={v}>panel {v}</span>
        </Tabs.Panel>
      ))}
    </Tabs.Root>,
  );
  await frame();
  await frame();
  await sleep(50);
  const tab = (name: string) =>
    [...host.querySelectorAll<HTMLElement>('[role="tab"]')].find((t) => t.textContent === name)!;
  const visible = (v: string) => {
    const el = host.querySelector(`[data-probe="${v}"]`);
    return !!el && (el as HTMLElement).checkVisibility();
  };
  const tB = now();
  tab("B").click();
  while (!visible("b")) await new Promise((r) => setTimeout(r, 0));
  const bShown = now() - tB;
  const tC = now();
  tab("C").click();
  while (!visible("c") && now() - tC < 3000) await new Promise((r) => setTimeout(r, 0));
  const cShown = now() - tC;
  await Promise.all(pending);
  root.unmount();
  host.remove();
  style.remove();
  doc.startViewTransition = orig;
  await sleep(50);
  return { vtCalls: vts.length, bShown, cShown };
}

it("tabs panel", { timeout: 60_000 }, async () => {
  const ua = navigator.userAgent.includes("Firefox") ? "firefox" : "chromium";
  const cases: [string, false | true, "none" | undefined, string][] = [
    ["keepMounted=false", false, undefined, ""],
    ["keepMounted=true (Activity)", true, undefined, ""],
    [
      "keepMounted=false + root animation:none CSS",
      false,
      undefined,
      "::view-transition-group(root),::view-transition-old(root),::view-transition-new(root){animation:none}",
    ],
  ];
  for (const [label, km, tr, css] of cases) {
    const runs = [];
    for (let i = 0; i < 5; i++) runs.push(await tabsRun(km, tr, css));
    const med = (xs: number[]) => Math.round([...xs].sort((a, b) => a - b)[2]!);
    console.log(
      "VTPROBE-TABS " +
        JSON.stringify({
          ua,
          label,
          vtCallsPerRun: runs[0]!.vtCalls,
          clickBToPanelB: med(runs.map((r) => r.bShown)),
          clickCToPanelC: med(runs.map((r) => r.cShown)),
        }),
    );
  }
});

// Real pointer input during the root cross-fade: mount a <ViewTransition default="none"> in a
// transition, then 50 ms later click a button with a real (Playwright) mouse click.
it("hit testing during the cross-fade", { timeout: 60_000 }, async () => {
  const ua = navigator.userAgent.includes("Firefox") ? "firefox" : "chromium";
  for (const [label, withVt, css] of [
    ["no VT", false, ""],
    ["VT default=none mounts", true, ""],
    ["VT default=none mounts + ::view-transition{pointer-events:none}", true, "::view-transition{pointer-events:none}"],
  ] as const) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    let set!: (b: boolean) => void;
    let clicks = 0;
    let activeAtClickHandler = false;
    let activeAtClick = false;
    let clickAt = 0;
    let vtEnd = 0;
    const docAny = document as Document & { startViewTransition: (...a: unknown[]) => unknown };
    const origSvt = docAny.startViewTransition;
    docAny.startViewTransition = function (this: Document, ...a: unknown[]) {
      const vt = origSvt.apply(this, a) as ViewTransition_;
      vt.finished.then(() => (vtEnd = now()));
      return vt;
    };
    function App() {
      const [on, s] = useState(false);
      set = s;
      return (
        <>
          <button type="button" data-probe-btn onClick={() => {
            clicks++;
            clickAt = now();
            activeAtClickHandler = document.documentElement.matches(":active-view-transition");
          }}>target</button>
          {on && (withVt ? <ViewTransition default="none"><div>m</div></ViewTransition> : <div>m</div>)}
        </>
      );
    }
    root.render(<App />);
    await frame();
    await sleep(50);
    startTransition(() => set(true));
    await sleep(50);
    activeAtClick = document.documentElement.matches(":active-view-transition");
    const clickIssued = now();
    await userEvent.click(host.querySelector("[data-probe-btn]")!);
    await sleep(400);
    console.log("VTPROBE-HIT " + JSON.stringify({
          ua,
          label,
          activeWhenClickIssued: activeAtClick,
          clicksReceived: clicks,
          activeInHandler: activeAtClickHandler,
          clickIssuedToHandler: Math.round(clickAt - clickIssued),
          handlerMinusVtEnd: vtEnd ? Math.round(clickAt - vtEnd) : null,
        }));
    docAny.startViewTransition = origSvt;
    root.unmount();
    host.remove();
    style.remove();
    await sleep(50);
  }
});
