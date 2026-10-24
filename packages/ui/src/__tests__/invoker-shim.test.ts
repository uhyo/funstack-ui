// The jsdom invoker shim's `popovertarget` branch (#121): the popover target attribute activation
// behaviour the overlay Triggers rely on in JS-free mode and before hydration. Plain DOM; the
// component rows are in popover.test.tsx and menu.test.tsx.
import { afterEach, describe, expect, it } from "vitest";
import { popoverSource } from "./popover-shim.js";

function setup(attributes: Record<string, string>) {
  const popover = document.createElement("div");
  popover.id = "target";
  popover.setAttribute("popover", "auto");
  const button = document.createElement("button");
  button.type = "button";
  for (const [name, value] of Object.entries(attributes)) button.setAttribute(name, value);
  document.body.append(button, popover);
  const commands: Event[] = [];
  popover.addEventListener("command", (event) => commands.push(event));
  return { popover, button, commands };
}

const isOpen = (element: Element) => element.matches(":popover-open");

afterEach(() => {
  for (const element of document.querySelectorAll("[popover]")) {
    if (isOpen(element)) (element as HTMLElement).hidePopover();
  }
  document.body.innerHTML = "";
});

describe("invoker shim: popovertarget (#121)", () => {
  it("toggles by default with the button as source, and fires no command event", () => {
    const { popover, button, commands } = setup({ popovertarget: "target" });
    button.click();
    expect(isOpen(popover)).toBe(true);
    expect(popoverSource(popover)).toBe(button);
    button.click();
    expect(isOpen(popover)).toBe(false);
    expect(commands).toEqual([]);
  });

  it("an unknown popovertargetaction is toggle", () => {
    const { popover, button } = setup({ popovertarget: "target", popovertargetaction: "bogus" });
    button.click();
    expect(isOpen(popover)).toBe(true);
    button.click();
    expect(isOpen(popover)).toBe(false);
  });

  it("show only shows; hide only hides", () => {
    const { popover, button } = setup({ popovertarget: "target", popovertargetaction: "show" });
    button.click();
    button.click();
    expect(isOpen(popover)).toBe(true);
    button.setAttribute("popovertargetaction", "hide");
    button.click();
    button.click();
    expect(isOpen(popover)).toBe(false);
  });

  it("does nothing when cancelled, disabled, a form's submit button, or the target is no popover", () => {
    const { popover, button } = setup({ popovertarget: "target" });
    button.addEventListener("click", (event) => event.preventDefault(), { once: true });
    button.click();
    expect(isOpen(popover)).toBe(false);
    button.disabled = true;
    button.click();
    expect(isOpen(popover)).toBe(false);
    button.disabled = false;
    const form = document.createElement("form");
    form.addEventListener("submit", (event) => event.preventDefault());
    document.body.append(form);
    form.append(button);
    button.type = "submit";
    button.click();
    expect(isOpen(popover)).toBe(false);
    button.type = "button";
    popover.removeAttribute("popover");
    button.click();
    expect(isOpen(popover)).toBe(false);
  });

  it("commandfor takes precedence over popovertarget", () => {
    const { popover, button, commands } = setup({
      popovertarget: "target",
      commandfor: "target",
      command: "hide-popover",
    });
    button.click();
    // `hide-popover` on a hidden popover is invalid: nothing, and the toggle never ran.
    expect(isOpen(popover)).toBe(false);
    expect(commands).toEqual([]);
  });
});
