import { describe, expect, it } from "vitest";
import { createPopupFlags, showWithFocus } from "./overlay-show.js";

describe("createPopupFlags", () => {
  it("starts clear", () => {
    const flags = createPopupFlags();
    expect(flags.awaitingClose()).toBe(false);
    expect(flags.takeLibraryClose()).toBe(false);
    expect(flags.takeRefusedFact()).toBe(false);
  });

  it("awaitingClose follows beginClose / endClose", () => {
    const flags = createPopupFlags();
    flags.beginClose();
    expect(flags.awaitingClose()).toBe(true);
    // Reading does not clear it.
    expect(flags.awaitingClose()).toBe(true);
    flags.endClose();
    expect(flags.awaitingClose()).toBe(false);
  });

  it("the library echo is consumed by the first take", () => {
    const flags = createPopupFlags();
    flags.markLibraryClose();
    expect(flags.takeLibraryClose()).toBe(true);
    expect(flags.takeLibraryClose()).toBe(false);
  });

  it("the refused fact is consumed by the next show, or cleared once adopted", () => {
    const flags = createPopupFlags();
    flags.markFact();
    expect(flags.takeRefusedFact()).toBe(true);
    expect(flags.takeRefusedFact()).toBe(false);

    flags.markFact();
    flags.factAdopted();
    expect(flags.takeRefusedFact()).toBe(false);
  });

  it("a different element ends the close and drops the echo; the same one keeps them (#159)", () => {
    const flags = createPopupFlags();
    const first = document.createElement("dialog");
    flags.attach(first);
    flags.beginClose();
    flags.markLibraryClose();
    flags.markFact();
    // Re-attached: its event still comes.
    flags.attach(first);
    expect(flags.awaitingClose()).toBe(true);
    // A new element: the old one's event never comes.
    flags.attach(document.createElement("dialog"));
    expect(flags.awaitingClose()).toBe(false);
    expect(flags.takeLibraryClose()).toBe(false);
    // The refused fact is about state, not the element.
    expect(flags.takeRefusedFact()).toBe(true);
  });

  it("keeps each instance's flags apart", () => {
    const a = createPopupFlags();
    const b = createPopupFlags();
    a.beginClose();
    a.markLibraryClose();
    a.markFact();
    expect(b.awaitingClose()).toBe(false);
    expect(b.takeLibraryClose()).toBe(false);
    expect(b.takeRefusedFact()).toBe(false);
  });
});

describe("showWithFocus", () => {
  function setup() {
    const popup = document.createElement("div");
    const target = document.createElement("button");
    popup.append(target);
    document.body.append(popup);
    return { popup, target };
  }

  it("writes autofocus on the target during the show only", () => {
    const { popup, target } = setup();
    let during: boolean | undefined;
    let inertDuring: boolean | undefined;
    showWithFocus(popup, {
      refused: false,
      autofocus: target,
      show: () => {
        during = target.hasAttribute("autofocus");
        inertDuring = popup.hasAttribute("inert");
      },
    });
    expect(during).toBe(true);
    expect(inertDuring).toBe(false);
    expect(target.hasAttribute("autofocus")).toBe(false);
  });

  it("keeps a consumer's own autofocus", () => {
    const { popup, target } = setup();
    target.setAttribute("autofocus", "");
    showWithFocus(popup, { refused: false, autofocus: target, show: () => {} });
    expect(target.hasAttribute("autofocus")).toBe(true);
  });

  it("makes a refused re-open inert during the show only", () => {
    const { popup } = setup();
    let during: boolean | undefined;
    showWithFocus(popup, {
      refused: true,
      autofocus: null,
      show: () => {
        during = popup.hasAttribute("inert");
      },
    });
    expect(during).toBe(true);
    expect(popup.hasAttribute("inert")).toBe(false);
  });

  it("leaves a consumer's own inert alone", () => {
    const { popup } = setup();
    popup.setAttribute("inert", "");
    showWithFocus(popup, { refused: true, autofocus: null, show: () => {} });
    expect(popup.hasAttribute("inert")).toBe(true);
  });

  it("undoes both attributes when the show throws", () => {
    const { popup, target } = setup();
    expect(() =>
      showWithFocus(popup, {
        refused: true,
        autofocus: target,
        show: () => {
          throw new Error("show failed");
        },
      }),
    ).toThrow("show failed");
    expect(popup.hasAttribute("inert")).toBe(false);
    expect(target.hasAttribute("autofocus")).toBe(false);
  });
});
