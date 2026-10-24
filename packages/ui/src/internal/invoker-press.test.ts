// The foreign invoker press guard (conventions 3.5, #126) on plain DOM. The jsdom invoker shim
// reflects the IDL it reads; the component rows are in menu.test.tsx and combobox.test.tsx.
import { afterEach, describe, expect, it } from "vitest";
import { isPopoverInvoker, listenInvokerPresses } from "./invoker-press.js";

function setup() {
  const popup = document.createElement("div");
  popup.id = "popup";
  popup.setAttribute("popover", "auto");
  const inner = document.createElement("button");
  inner.setAttribute("popovertarget", "popup");
  popup.append(inner);
  const other = document.createElement("div");
  other.id = "other";
  other.setAttribute("popover", "auto");
  document.body.append(popup, other);
  return { popup, inner };
}

function button(attributes: Record<string, string>, label = "") {
  const element = document.createElement("button");
  element.type = "button";
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (label !== "") {
    const span = document.createElement("span");
    span.textContent = label;
    element.append(span);
  }
  document.body.append(element);
  return element;
}

const press = (target: Element, init: MouseEventInit = {}) => {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isPopoverInvoker", () => {
  it("is a button outside the popup that names it", () => {
    const { popup } = setup();
    expect(isPopoverInvoker(button({ popovertarget: "popup" }), popup)).toBe(true);
    for (const command of ["toggle-popover", "show-popover", "hide-popover"]) {
      expect(isPopoverInvoker(button({ commandfor: "popup", command }), popup)).toBe(true);
    }
    // The press lands on the button's content.
    const labelled = button({ popovertarget: "popup" }, "Open");
    expect(isPopoverInvoker(labelled.firstElementChild, popup)).toBe(true);
  });

  it("is not a plain button, another command, another popover, or a button inside the popup", () => {
    const { popup, inner } = setup();
    expect(isPopoverInvoker(button({}), popup)).toBe(false);
    expect(isPopoverInvoker(button({ commandfor: "popup", command: "--my-cmd" }), popup)).toBe(
      false,
    );
    expect(isPopoverInvoker(button({ commandfor: "popup", command: "close" }), popup)).toBe(false);
    expect(isPopoverInvoker(button({ commandfor: "popup" }), popup)).toBe(false);
    expect(isPopoverInvoker(button({ popovertarget: "other" }), popup)).toBe(false);
    expect(isPopoverInvoker(button({ commandfor: "other", command: "hide-popover" }), popup)).toBe(
      false,
    );
    expect(isPopoverInvoker(inner, popup)).toBe(false);
    expect(isPopoverInvoker(document.body, popup)).toBe(false);
    expect(isPopoverInvoker(null, popup)).toBe(false);
  });
});

describe("listenInvokerPresses", () => {
  it("prevents a primary press on an invoker until the cleanup", () => {
    const { popup } = setup();
    const invoker = button({ popovertarget: "popup" });
    const plain = button({});
    const stop = listenInvokerPresses(popup);
    expect(press(invoker).defaultPrevented).toBe(true);
    expect(press(invoker, { button: 2 }).defaultPrevented).toBe(false);
    expect(press(invoker, { button: 1 }).defaultPrevented).toBe(false);
    expect(press(plain).defaultPrevented).toBe(false);
    stop();
    expect(press(invoker).defaultPrevented).toBe(false);
  });
});
