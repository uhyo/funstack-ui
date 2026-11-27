// The Escape rule of conventions 15: isEscapeRequest, isComposingKey, consumeEscape and
// decideEscapeLast (rule 4, #194).
import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeEscape, decideEscapeLast, isComposingKey, isEscapeRequest } from "./escape-key.js";

function keydown(init: KeyboardEventInit, prevent = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  if (prevent) event.preventDefault();
  return event;
}

describe("isEscapeRequest", () => {
  it("is true for a plain Escape", () => {
    expect(isEscapeRequest(keydown({ key: "Escape" }))).toBe(true);
  });

  it.each([
    ["another key", keydown({ key: "Enter" })],
    ["an Escape with isComposing", keydown({ key: "Escape", isComposing: true })],
    ["an Escape with keyCode 229 (WebKit)", keydown({ key: "Escape", keyCode: 229 })],
    ["the IME's Process key", keydown({ key: "Process", keyCode: 229 })],
    ["a prevented Escape", keydown({ key: "Escape" }, true)],
  ])("is false for %s", (_, event) => {
    expect(isEscapeRequest(event)).toBe(false);
  });

  it("is false for an Escape a layer consumed", () => {
    const event = keydown({ key: "Escape" });
    consumeEscape(event);
    expect(isEscapeRequest(event)).toBe(false);
  });
});

describe("isComposingKey", () => {
  it("reads isComposing and keyCode 229", () => {
    expect(isComposingKey(keydown({ key: "a" }))).toBe(false);
    expect(isComposingKey(keydown({ key: "a", isComposing: true }))).toBe(true);
    expect(isComposingKey(keydown({ key: "Enter", keyCode: 229 }))).toBe(true);
  });
});

// #194, conventions 15 rule 4: record in capture, decide last, one Escape closes one layer.
describe("decideEscapeLast", () => {
  const cleanups: (() => void)[] = [];
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
  });

  /** `outer > middle > inner`, in the document. */
  function tree() {
    const outer = document.createElement("div");
    const middle = document.createElement("div");
    const inner = document.createElement("button");
    middle.append(inner);
    outer.append(middle);
    document.body.append(outer);
    cleanups.push(() => outer.remove());
    return { outer, middle, inner };
  }

  function on(target: EventTarget, listener: (event: KeyboardEvent) => void, capture: boolean) {
    const wrapped = (event: Event) => listener(event as KeyboardEvent);
    target.addEventListener("keydown", wrapped, capture);
    cleanups.push(() => target.removeEventListener("keydown", wrapped, capture));
  }

  /** A layer that records in capture on `target` and logs `name` when it decides. */
  function layer(
    target: EventTarget,
    name: string,
    log: string[],
    { global = false, consume = false, cancel = false } = {},
  ) {
    on(
      target,
      (event) => {
        if (!isEscapeRequest(event)) return;
        decideEscapeLast(
          event,
          () => {
            log.push(name);
            if (consume) consumeEscape(event);
          },
          { global, cancel },
        );
      },
      true,
    );
  }

  function escape(target: EventTarget): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    target.dispatchEvent(event);
    return event;
  }

  const ORDER = ["g1", "g2", "inner", "middle", "outer"];

  /** Two global layers on the window and three nested element layers. */
  function fiveLayers(options: { consume?: string } = {}) {
    const log: string[] = [];
    const { outer, middle, inner } = tree();
    const opts = (name: string) => ({ consume: options.consume === name });
    layer(window, "g1", log, { global: true, ...opts("g1") });
    layer(window, "g2", log, { global: true, ...opts("g2") });
    layer(outer, "outer", log, opts("outer"));
    layer(middle, "middle", log, opts("middle"));
    layer(inner, "inner", log, opts("inner"));
    return { log, outer, middle, inner };
  }

  it("decides the global layers in record order, then the element layers innermost first", () => {
    const { log, inner } = fiveLayers();
    escape(inner);
    expect(log).toEqual(ORDER);
  });

  it("decides at the window, after the bubble listeners of the elements and the document", () => {
    const log: string[] = [];
    const { outer, inner } = tree();
    layer(outer, "outer", log);
    on(inner, () => log.push("inner bubble"), false);
    on(document, () => log.push("document bubble"), false);
    escape(inner);
    expect(log).toEqual(["inner bubble", "document bubble", "outer"]);
  });

  it.each(["g1", "inner", "middle"])("a layer that consumes (%s) stops the rest", (name) => {
    const { log, inner } = fiveLayers({ consume: name });
    const event = escape(inner);
    expect(log).toEqual(ORDER.slice(0, ORDER.indexOf(name) + 1));
    expect(event.defaultPrevented).toBe(true);
    expect(isEscapeRequest(event)).toBe(false);
  });

  it.each([
    ["a document", () => document],
    ["a window", () => window],
  ])("preventDefault() from %s bubble listener stops all", (_, target) => {
    const { log, inner } = fiveLayers();
    on(target(), (event) => event.preventDefault(), false);
    escape(inner);
    expect(log).toEqual([]);
  });

  it("stopPropagation() at the target still decides, after the dispatch, in the same order", async () => {
    const { log, inner } = fiveLayers();
    on(inner, (event) => event.stopPropagation(), false);
    const event = escape(inner);
    expect(log).toEqual([]);
    await Promise.resolve();
    expect(log).toEqual(ORDER);
    // Nothing consumed it: the event is left alone.
    expect(event.defaultPrevented).toBe(false);
  });

  it("stopPropagation() at the target: consumeEscape still stops the rest", async () => {
    const { log, inner } = fiveLayers({ consume: "g2" });
    on(inner, (event) => event.stopPropagation(), false);
    const event = escape(inner);
    await Promise.resolve();
    expect(log).toEqual(["g1", "g2"]);
    // The dispatch is over: the mark carries the result, the event stays as the page left it.
    expect(event.defaultPrevented).toBe(false);
    expect(isEscapeRequest(event)).toBe(false);
  });

  it("a cancel ({ cancel: true }) decides first, and runs although a global layer consumes", () => {
    const log: string[] = [];
    const { outer, inner } = tree();
    layer(window, "g1", log, { global: true, consume: true });
    layer(outer, "outer", log);
    layer(inner, "cancel", log, { cancel: true });
    escape(inner);
    expect(log).toEqual(["cancel", "g1"]);
  });

  it("a cancel runs on the late path too, before the global layer that consumes", async () => {
    const log: string[] = [];
    const { inner } = tree();
    layer(window, "g1", log, { global: true, consume: true });
    layer(inner, "cancel", log, { cancel: true });
    on(inner, (event) => event.stopPropagation(), false);
    escape(inner);
    await Promise.resolve();
    expect(log).toEqual(["cancel", "g1"]);
  });

  it("a page preventDefault() stops a cancel too", () => {
    const log: string[] = [];
    const { inner } = tree();
    layer(window, "g1", log, { global: true });
    layer(inner, "cancel", log, { cancel: true });
    on(inner, (event) => event.preventDefault(), false);
    escape(inner);
    expect(log).toEqual([]);
  });

  it("a cancelled layer does not decide; the others still do", () => {
    const log: string[] = [];
    const { outer, inner } = tree();
    layer(outer, "outer", log);
    on(
      inner,
      (event) => {
        const cancel = decideEscapeLast(event, () => log.push("inner"));
        cancel();
      },
      true,
    );
    escape(inner);
    expect(log).toEqual(["outer"]);
  });

  it("the same decider recorded twice for one event decides once", () => {
    const log: string[] = [];
    const { inner } = tree();
    const decide = () => log.push("once");
    on(inner, (event) => decideEscapeLast(event, decide), true);
    on(inner, (event) => decideEscapeLast(event, decide), false);
    escape(inner);
    expect(log).toEqual(["once"]);
  });

  describe("window listeners", () => {
    function watch() {
      const add = vi.spyOn(document.defaultView!, "addEventListener");
      const remove = vi.spyOn(document.defaultView!, "removeEventListener");
      cleanups.push(() => {
        add.mockRestore();
        remove.mockRestore();
      });
      const count = (spy: typeof add) =>
        spy.mock.calls.filter(([type, , capture]) => type === "keydown" && !capture).length;
      return { added: () => count(add), removed: () => count(remove) };
    }

    it("adds one per event however many layers recorded it, and none is left after it", () => {
      const { log, inner } = fiveLayers();
      const spy = watch();
      escape(inner);
      expect(log).toHaveLength(5);
      expect(spy.added()).toBe(1);
      expect(spy.removed()).toBe(1);
    });

    it("on the late path too", async () => {
      const { inner } = fiveLayers();
      on(inner, (event) => event.stopPropagation(), false);
      const spy = watch();
      escape(inner);
      expect(spy.added()).toBe(1);
      expect(spy.removed()).toBe(0);
      await Promise.resolve();
      expect(spy.removed()).toBe(1);
    });

    it("cancelling every layer removes it at once, and nothing decides", async () => {
      const log: string[] = [];
      const { inner } = tree();
      const spy = watch();
      on(
        inner,
        (event) => {
          const cancelA = decideEscapeLast(event, () => log.push("a"));
          const cancelB = decideEscapeLast(event, () => log.push("b"));
          cancelA();
          expect(spy.removed()).toBe(0);
          cancelB();
          expect(spy.removed()).toBe(1);
          event.stopPropagation();
        },
        true,
      );
      escape(inner);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(log).toEqual([]);
      expect(spy.added()).toBe(1);
    });
  });
});
