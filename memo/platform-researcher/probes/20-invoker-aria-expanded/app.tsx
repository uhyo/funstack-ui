import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Popover } from "@funstack/ui/popover";
import { Menu } from "@funstack/ui/menu";
import { Combobox } from "@funstack/ui/combobox";

// window.__hang = "close" | "open" | null: which openChangeAction direction never settles until __release().
const w = window as any;
w.__hang = null;
const pending: Array<() => void> = [];
w.__release = () => { while (pending.length) pending.shift()!(); };
const gate = (open: boolean) => {
  if ((w.__hang === "close" && !open) || (w.__hang === "open" && open)) {
    return new Promise<void>((r) => pending.push(r));
  }
  return undefined;
};

function ComboWithInvoker() {
  // Simulates design/components/combobox.md (#112): commandfor + command written after hydration.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = rootRef.current!.querySelector<HTMLButtonElement>("[data-probe=cb-trigger]")!;
    const popup = rootRef.current!.querySelector<HTMLElement>("[popover]")!;
    t.setAttribute("commandfor", popup.id);
    t.setAttribute("command", "toggle-popover");
    // The design cancels the click so the command never runs.
    t.addEventListener("click", (e) => e.preventDefault());
  }, []);
  return (
    <div ref={rootRef}>
      <Combobox.Root openChangeAction={gate}>
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.Input data-probe="cb-input" />
        <Combobox.Trigger data-probe="cb-trigger" aria-label="Show fruits">v</Combobox.Trigger>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Option value="apple">apple</Combobox.Option>
            <Combobox.Option value="pear">pear</Combobox.Option>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    </div>
  );
}

function App() {
  return (
    <>
      <Popover.Root defaultOpen={false} openChangeAction={gate}>
        <Popover.Trigger data-probe="pl-trigger">Popover (library)</Popover.Trigger>
        <p>filler</p>
        <Popover.Popup id="pl-popup" aria-label="lib">content</Popover.Popup>
      </Popover.Root>
      <Popover.Root>
        <Popover.Trigger data-probe="pj-trigger">Popover (JS-free)</Popover.Trigger>
        <p>filler</p>
        <Popover.Popup id="pj-popup" aria-label="jsfree">content</Popover.Popup>
      </Popover.Root>
      <Menu.Root openChangeAction={gate}>
        <Menu.Trigger data-probe="m-trigger">Menu</Menu.Trigger>
        <Menu.Popup id="m-popup">
          <Menu.Item>Cut</Menu.Item>
          <Menu.Item>Copy</Menu.Item>
        </Menu.Popup>
      </Menu.Root>
      <ComboWithInvoker />
      <Combobox.Root>
        <Combobox.Label>Plain</Combobox.Label>
        <Combobox.Input data-probe="cb2-input" />
        <Combobox.Trigger data-probe="cb2-trigger" aria-label="Show plain">v</Combobox.Trigger>
        <Combobox.Popup>
          <Combobox.List>
            <Combobox.Option value="x">x</Combobox.Option>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Root>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
w.__ready = true;
