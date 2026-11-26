import { useState } from "react";
import { Drawer } from "@funstack/ui/drawer";
import type { DrawerOpenChangeDetails, DrawerSide } from "@funstack/ui/drawer";
import { fakeSave } from "./shared/fake-backend.js";
import { Spinner } from "./shared/Spinner.js";
import { Demo } from "./shared/Demo.js";
import "./drawer-demo.css";

function log(label: string, channel: string) {
  return (open: boolean, { reason, event }: DrawerOpenChangeDetails) => {
    console.log(`[${label}] ${channel} open=${open} reason=${reason} event=${event?.type}`);
  };
}

/* 1. A bottom sheet with a scrolling list ----------------------------------------------- */

function BottomSheet() {
  const [fail, setFail] = useState(false);
  return (
    <section>
      <h3>Bottom sheet</h3>
      <p>
        Drag the grabber, the title or the footer down (mouse, pen or touch): past a quarter, or
        with a flick, it slides out and closes, logged as <code>onOpenChange</code> with a{" "}
        <code>pointerup</code>. A press in the list scrolls it and never drags. "Apply" is a Close
        with an <code>action</code>; check "fail" to keep the sheet open on a rejection.
      </p>
      <label>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /> fail
      </label>
      <Drawer.Root
        defaultOpen={false}
        openChangeAction={log("sheet", "openChangeAction")}
        onOpenChange={log("sheet", "onOpenChange")}
      >
        <Drawer.Trigger>Open the sheet</Drawer.Trigger>
        <Drawer.Popup className="drw" side="bottom">
          <div className="drw-grabber" aria-hidden />
          <Drawer.Title>Sort and filter</Drawer.Title>
          <ul className="drw-body">
            {Array.from({ length: 30 }, (_, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" /> Option {i + 1}
                </label>
              </li>
            ))}
          </ul>
          <div className="drw-footer">
            <Drawer.Close>Cancel</Drawer.Close>
            <Drawer.Close action={() => fakeSave("sheet", "filters", { fail })}>
              {({ pending }) => (
                <>
                  {pending && <Spinner />}
                  Apply
                </>
              )}
            </Drawer.Close>
          </div>
        </Drawer.Popup>
      </Drawer.Root>
    </section>
  );
}

/* 2. Every side, JS-free ------------------------------------------------------------------ */

const sides: readonly DrawerSide[] = [
  "top",
  "bottom",
  "left",
  "right",
  "inline-start",
  "inline-end",
];

function Sides() {
  return (
    <section>
      <h3>Every side (JS-free)</h3>
      <p>
        Roots without open-state props: Invoker Commands open and close them, and after hydration
        the swipe closes them too. The inline sides follow the direction of the subtree; the last
        row is right-to-left.
      </p>
      {(["ltr", "rtl"] as const).map((dir) => (
        <div key={dir} dir={dir} className="drw-row">
          {sides.map((side) => (
            <Drawer.Root key={side}>
              <Drawer.Trigger>
                {side} ({dir})
              </Drawer.Trigger>
              <Drawer.Popup className="drw" side={side}>
                <div className="drw-grabber" aria-hidden />
                <Drawer.Title>{side}</Drawer.Title>
                <p>Swipe me toward my edge.</p>
                <Drawer.Close>Close</Drawer.Close>
              </Drawer.Popup>
            </Drawer.Root>
          ))}
        </div>
      ))}
    </section>
  );
}

/* 3. A non-modal side panel without the swipe -------------------------------------------- */

function Panel() {
  return (
    <section>
      <h3>Non-modal panel</h3>
      <p>
        <code>modal={"{false}"}</code> and <code>swipeDismiss={"{false}"}</code>: the page stays
        usable, a click on it does not close the panel (<code>lightDismiss</code> follows{" "}
        <code>modal</code>), only its button and Escape do.
      </p>
      <Drawer.Root defaultOpen={false} modal={false} onOpenChange={log("panel", "onOpenChange")}>
        <Drawer.Trigger>Inspector</Drawer.Trigger>
        <Drawer.Popup className="drw" side="inline-end" swipeDismiss={false}>
          <Drawer.Title>Inspector</Drawer.Title>
          <p>Nothing selected.</p>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Popup>
      </Drawer.Root>
    </section>
  );
}

export function DrawerDemo() {
  return (
    <Demo title="Drawer">
      <p>
        A Dialog on an edge that the user can swipe away. The stylesheet places it from{" "}
        <code>data-side</code> and moves it with <code>--drawer-swipe-x</code> /{" "}
        <code>--drawer-swipe-y</code>; the backdrop fades with <code>--drawer-swipe-progress</code>.
      </p>
      <BottomSheet />
      <Sides />
      <Panel />
    </Demo>
  );
}
