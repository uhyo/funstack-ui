// F7 isolated (2026-10-17): the combined file showed no submission for F7 in Firefox, an ordering artifact.
// Copy into packages/ui/src/__tests__/ and run like react-form.browser.test.tsx; output zz-f7-<browser>.txt.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterAll, test } from "vitest";
import { commands, server, userEvent } from "vitest/browser";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lines: string[] = [];
const log = (...a: unknown[]) => lines.push(`[${server.browser}] ` + a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
afterAll(async () => { await commands.writeFile(`./zz-f7-${server.browser}.txt`, lines.join("\n") + "\n"); });
for (const variant of ["fill-both", "fill-uncontrolled-only", "no-fill", "fill-controlled-only"]) {
  test("F7 " + variant, async () => {
    const calls: string[] = []; const ev: string[] = [];
    function Form() {
      const [v, setV] = useState("");
      return (
        <form onSubmitCapture={() => ev.push("submit")} action={async (fd) => { calls.push(String(fd.get("u"))); }}>
          <input id="q7" name="q" value={v} onChange={(e) => setV(e.target.value)} />
          <input id="u7" name="u" defaultValue="" />
          <button id="b7" onClick={() => ev.push("click")}>Save</button>
        </form>);
    }
    const el = document.createElement("div"); document.body.append(el); const root = createRoot(el);
    flushSync(() => root.render(<Form />));
    if (variant === "fill-both" || variant === "fill-controlled-only") await userEvent.fill(el.querySelector("#q7")!, "controlled");
    if (variant === "fill-both" || variant === "fill-uncontrolled-only") await userEvent.fill(el.querySelector("#u7")!, "uncontrolled");
    await userEvent.click(el.querySelector("#b7")!); await sleep(300);
    log(variant, "events", ev, "calls", calls, "u", (el.querySelector("#u7") as HTMLInputElement).value);
    root.unmount(); el.remove();
  });
}
