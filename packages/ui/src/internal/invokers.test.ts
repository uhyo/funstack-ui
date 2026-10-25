// The foreign invoker press guard (conventions 3.5, #126) on plain DOM. The jsdom invoker shim
// reflects the IDL it reads; the component rows are in menu.test.tsx and combobox.test.tsx.
import { afterEach, describe, expect, it } from "vitest";
import { isPopoverInvoker, listenInvokerPresses } from "./invokers.js";

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

function inputButton(type: string, form?: HTMLFormElement) {
  const element = document.createElement("input");
  element.type = type;
  element.setAttribute("popovertarget", "popup");
  (form ?? document.body).append(element);
  return element;
}

// #126 review
describe("isPopoverInvoker: HTML's invoker relationship", () => {
  it("an <input> of a button type is one; another <input> is not", () => {
    const { popup } = setup();
    for (const type of ["button", "reset", "submit", "image"]) {
      expect(isPopoverInvoker(inputButton(type), popup)).toBe(true);
    }
    expect(isPopoverInvoker(inputButton("text"), popup)).toBe(false);
    expect(isPopoverInvoker(inputButton("checkbox"), popup)).toBe(false);
    // `commandfor` is a <button> attribute.
    const input = inputButton("button");
    input.removeAttribute("popovertarget");
    input.setAttribute("commandfor", "popup");
    input.setAttribute("command", "toggle-popover");
    expect(isPopoverInvoker(input, popup)).toBe(false);
  });

  it("a disabled button is not one", () => {
    const { popup } = setup();
    const disabled = button({ popovertarget: "popup" });
    disabled.disabled = true;
    expect(isPopoverInvoker(disabled, popup)).toBe(false);
    const command = button({ commandfor: "popup", command: "hide-popover" });
    command.disabled = true;
    expect(isPopoverInvoker(command, popup)).toBe(false);
    const input = inputButton("button");
    input.disabled = true;
    expect(isPopoverInvoker(input, popup)).toBe(false);
  });

  it("a submit button with a form owner is not one; outside a form it is", () => {
    const { popup } = setup();
    const form = document.createElement("form");
    document.body.append(form);
    // No `type`: a <button> is a submit button.
    const inForm = document.createElement("button");
    inForm.setAttribute("popovertarget", "popup");
    form.append(inForm);
    expect(isPopoverInvoker(inForm, popup)).toBe(false);
    const command = document.createElement("button");
    command.setAttribute("commandfor", "popup");
    command.setAttribute("command", "toggle-popover");
    form.append(command);
    expect(isPopoverInvoker(command, popup)).toBe(false);
    expect(isPopoverInvoker(inputButton("submit", form), popup)).toBe(false);
    expect(isPopoverInvoker(inputButton("image", form), popup)).toBe(false);
    // Not submit buttons: invokers in a form too.
    inForm.type = "button";
    expect(isPopoverInvoker(inForm, popup)).toBe(true);
    expect(isPopoverInvoker(inputButton("reset", form), popup)).toBe(true);
    expect(isPopoverInvoker(inputButton("button", form), popup)).toBe(true);
    // A submit button with no form owner.
    const loose = document.createElement("button");
    loose.setAttribute("popovertarget", "popup");
    document.body.append(loose);
    expect(isPopoverInvoker(loose, popup)).toBe(true);
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
