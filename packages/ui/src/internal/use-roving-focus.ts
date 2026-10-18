"use client";
import { useEffect, useInsertionEffect, useLayoutEffect, useState } from "react";
import type { FocusEvent, KeyboardEvent, PointerEvent, RefObject } from "react";

// The roving-focus engine shared by `Toolbar.Root` and a standalone `ToggleGroup.Root`
// (design/components/toggle-group.md section 6, conventions 3.2 and 7.4). Items are the focusable
// descendants of the container, found in the DOM; which one is the Tab stop is urgent library
// state kept outside React and written to the items as `tabindex` through the DOM.

export type RovingOrientation = "horizontal" | "vertical";

export interface RovingFocusOptions {
  /** `false`: the engine writes nothing and handles nothing (a ToggleGroup inside a Toolbar). Default `true`. */
  readonly enabled?: boolean;
  readonly orientation: RovingOrientation;
  readonly loop: boolean;
  /** The native `focusgroup` path is active: write no `tabindex`, handle no navigation key. */
  readonly native: boolean;
  /** Which item is the Tab stop when there is no usable memory. */
  readonly entry: (items: readonly HTMLElement[]) => HTMLElement | undefined;
  /**
   * `true`: the last focused item stays the Tab stop after focus leaves (Toolbar). `false`: while
   * focus is inside, the focused item is the stop (so Tab and Shift+Tab leave the container);
   * once it leaves, the stop is re-derived from `entry` (ToggleGroup: the pressed Item).
   */
  readonly memory: boolean;
}

export interface RovingFocusHandlers {
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
}

const FOCUSABLE = [
  "button",
  "a[href]",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  "[tabindex]",
].join(",");

function isVisible(el: HTMLElement): boolean {
  // jsdom has no `checkVisibility`; `hidden` is the part of it a test can observe there.
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  return el.closest("[hidden]") === null;
}

/**
 * Whether `el` or an ancestor below `root` takes it out of `root`'s sequence: a nested toolbar
 * (its own sequence), a popover or a dialog rendered inside the container (a `Menu.Popup`'s items
 * are the menu's).
 */
function isNestedOut(el: HTMLElement, root: HTMLElement): boolean {
  for (let node: Element | null = el; node !== null && node !== root; node = node.parentElement) {
    if (
      node.getAttribute("role") === "toolbar" ||
      node.hasAttribute("popover") ||
      node.tagName === "DIALOG"
    ) {
      return true;
    }
  }
  return false;
}

function isRadio(el: Element): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === "radio";
}

/** The items of a container, with native radio groups collapsed into units (design 17.2). */
export interface RovingItems {
  /** The toolbar's own destinations in DOM order; a radio unit appears as its representative. */
  readonly items: HTMLElement[];
  /**
   * Every native radio among the candidates → the radios of its unit (same `name` under the
   * container, DOM order). A radio without a `name` is a unit of one.
   */
  readonly units: Map<HTMLElement, readonly HTMLInputElement[]>;
}

/** The unit's representative: its checked radio, else its first (design 17.2 item 2). */
function representative(unit: readonly HTMLInputElement[]): HTMLInputElement {
  return unit.find((radio) => radio.checked) ?? unit[0]!;
}

/**
 * The items of `root` (design 6.2 and 17.2): its focusable descendants minus `:disabled`,
 * `inert`, invisible, nested-toolbar / popover / dialog content, and elements whose own
 * `tabindex="-1"` was not written by this engine (`managed`). `aria-disabled` elements are items.
 * Native radios that share a `name` form one unit, represented in `items` by its checked radio
 * (else its first), at the position of the unit's first radio.
 */
export function collectItems(
  root: HTMLElement,
  managed: { has(el: Element): boolean },
): RovingItems {
  const candidates: HTMLElement[] = [];
  const byName = new Map<string, HTMLInputElement[]>();
  const units = new Map<HTMLElement, readonly HTMLInputElement[]>();
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (el.matches(":disabled")) continue;
    if (el.closest("[inert]") !== null) continue;
    if (el.getAttribute("tabindex") === "-1" && !managed.has(el)) continue;
    if (isNestedOut(el, root)) continue;
    if (!isVisible(el)) continue;
    if (isRadio(el)) {
      // Same form owner assumed: a `form=` attribute that splits a `name` is not handled (v1).
      const unit = el.name === "" ? undefined : byName.get(el.name);
      if (unit !== undefined) {
        unit.push(el);
        units.set(el, unit);
        continue;
      }
      const created = [el];
      if (el.name !== "") byName.set(el.name, created);
      units.set(el, created);
    }
    candidates.push(el);
  }
  // `candidates` holds each unit's first radio in its place; swap in the representative.
  const items = candidates.map((el) => {
    const unit = units.get(el);
    return unit === undefined ? el : representative(unit);
  });
  return { items, units };
}

/** {@link collectItems}'s `items`: the container's destinations in DOM order. */
export function itemsOf(root: HTMLElement, managed: { has(el: Element): boolean }): HTMLElement[] {
  return collectItems(root, managed).items;
}

const BUTTON_LIKE_INPUTS = new Set([
  "button",
  "submit",
  "reset",
  "checkbox",
  "image",
  "color",
  "file",
]);
const ARROW_OWNING_ROLES = new Set(["textbox", "combobox", "spinbutton", "slider"]);

/**
 * An item that owns the arrow keys (design 6.3 and 17.2): text-like `input`s, `textarea`,
 * `select`, `[contenteditable]`, `role` `textbox` / `combobox` / `spinbutton` / `slider`, and a
 * native `input[type=radio]` (its group's own arrows check as they move). A custom
 * `[role="radio"]` is an ordinary item, as it is under native `focusgroup`.
 */
export function ownsArrows(el: Element): boolean {
  const role = el.getAttribute("role");
  if (role !== null && ARROW_OWNING_ROLES.has(role)) return true;
  if (el instanceof HTMLInputElement) return !BUTTON_LIKE_INPUTS.has(el.type);
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  const editable = el.getAttribute("contenteditable");
  if (editable !== null && editable !== "false") return true;
  return el instanceof HTMLElement && el.isContentEditable === true;
}

type Move = "next" | "prev" | "first" | "last";

function resolveKey(key: string, orientation: RovingOrientation, rtl: boolean): Move | null {
  switch (key) {
    case "Home":
      return "first";
    case "End":
      return "last";
    case "ArrowRight":
      return orientation === "horizontal" ? (rtl ? "prev" : "next") : null;
    case "ArrowLeft":
      return orientation === "horizontal" ? (rtl ? "next" : "prev") : null;
    case "ArrowDown":
      return orientation === "vertical" ? "next" : null;
    case "ArrowUp":
      return orientation === "vertical" ? "prev" : null;
    default:
      return null;
  }
}

function focusItem(item: HTMLElement): void {
  // Keyboard focus: the ring shows even where the engine's heuristic would not (as Tabs).
  item.focus({ focusVisible: true } as FocusOptions);
}

interface Engine {
  /** The options of the last committed render (written from an insertion effect). */
  readonly setOptions: (options: RovingFocusOptions) => void;
  /**
   * Re-derives the Tab stop of `root` and writes `tabindex`. `focused`: the element focus is on,
   * if any.
   */
  readonly apply: (root: HTMLElement | null, focused: Element | null) => void;
  readonly handlers: RovingFocusHandlers;
}

function createEngine(): Engine {
  let current: HTMLElement | null = null;
  let latestOptions: RovingFocusOptions | null = null;
  /**
   * Elements this engine wrote `tabindex` on, with the attribute value they had before the first
   * write (`null`: none). Restored when the engine lets go of an element (native path, element
   * left the container): React does not re-write a `tabIndex` prop it believes it rendered, so a
   * `[tabindex="0"]` widget would otherwise become unreachable.
   */
  const managed = new Map<HTMLElement, string | null>();

  const restore = (el: HTMLElement) => {
    const original = managed.get(el);
    managed.delete(el);
    if (!el.isConnected || original === undefined) return;
    if (original === null) el.removeAttribute("tabindex");
    else el.setAttribute("tabindex", original);
  };

  const active = (options: RovingFocusOptions | null): options is RovingFocusOptions =>
    options !== null && options.enabled !== false;

  /** Native path: give back every `tabindex` this engine wrote (a hydration render may have). */
  const release = () => {
    for (const el of [...managed.keys()]) restore(el);
    current = null;
  };

  const apply = (root: HTMLElement | null, focused: Element | null) => {
    const options = latestOptions;
    if (root === null || !active(options)) return;
    if (options.native) {
      release();
      return;
    }
    const { items, units } = collectItems(root, managed);
    /** Every element the engine writes: the items and the other radios of their units. */
    const all = new Set<HTMLElement>(items);
    for (const radio of units.keys()) all.add(radio);
    /** The item standing for `el`: its unit's representative for a radio, else itself. */
    const itemOf = (el: HTMLElement): HTMLElement => {
      const unit = units.get(el);
      return unit === undefined ? el : representative(unit);
    };
    if (!options.memory) {
      current =
        focused instanceof HTMLElement && all.has(focused)
          ? focused
          : (options.entry(items) ?? null);
    } else if (current === null || !all.has(current) || !items.includes(itemOf(current))) {
      current = options.entry(items) ?? null;
    }
    // `current` may be any radio of its unit (focus landed on an unchecked one): `0` on it, `-1`
    // on the unit's other radios and on every other element (design 17.2 item 5).
    for (const el of all) {
      if (!managed.has(el)) managed.set(el, el.getAttribute("tabindex"));
      const want = el === current ? "0" : "-1";
      if (el.getAttribute("tabindex") !== want) el.setAttribute("tabindex", want);
    }
    // Elements written before that are no longer items: a stale `0` must not stay a Tab stop
    // (it would be one again when re-enabled); one that left the container gets its own back.
    for (const el of [...managed.keys()]) {
      if (all.has(el)) continue;
      if (!root.contains(el)) {
        restore(el);
      } else if (el.getAttribute("tabindex") !== "-1") {
        el.setAttribute("tabindex", "-1");
      }
    }
  };

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const options = latestOptions;
    if (!active(options) || options.native) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const { items, units } = collectItems(event.currentTarget, managed);
    if (!items.includes(target) && !units.has(target)) return;
    current = target;
    apply(event.currentTarget, target);
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const options = latestOptions;
    if (!active(options) || options.native || options.memory) return;
    // Focus moving to another item is handled by its focus event.
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    apply(event.currentTarget, null);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const options = latestOptions;
    if (!active(options) || options.native) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    const { items, units } = collectItems(event.currentTarget, managed);
    // Safari does not focus a button on click; the pointer still makes it the stop.
    const item = [...items, ...units.keys()].find((el) => el.contains(target));
    if (item === undefined) return;
    current = item;
    apply(
      event.currentTarget,
      options.memory ? item : event.currentTarget.ownerDocument.activeElement,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const options = latestOptions;
    // The browser moves focus itself where `focusgroup` is implemented.
    if (!active(options) || options.native) return;
    const root = event.currentTarget;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const { items, units } = collectItems(root, managed);
    const unit = units.get(target);
    // A radio stands in `items` through its unit's representative.
    const index = items.indexOf(unit === undefined ? target : representative(unit));
    if (index < 0) return;

    if (ownsArrows(target)) {
      // The item keeps its arrows, Home and End; Tab / Shift+Tab move to the next / previous item
      // while one exists, as Chromium's `focusgroup="toolbar"` does (design 6.3, 17.2 item 4).
      if (event.key !== "Tab") return;
      // From an unchecked radio whose sibling is checked: that sibling first (only the checked
      // radio of a group is sequentially focusable natively).
      const checked = unit?.find((radio) => radio.checked);
      if (checked !== undefined && checked !== target) {
        event.preventDefault();
        focusItem(checked);
        return;
      }
      const next = items[index + (event.shiftKey ? -1 : 1)];
      if (next === undefined) return;
      event.preventDefault();
      focusItem(next);
      return;
    }

    const rtl = options.orientation === "horizontal" && getComputedStyle(root).direction === "rtl";
    const move = resolveKey(event.key, options.orientation, rtl);
    if (move === null) return;
    event.preventDefault();
    const last = items.length - 1;
    let nextIndex: number;
    switch (move) {
      case "first":
        nextIndex = 0;
        break;
      case "last":
        nextIndex = last;
        break;
      case "next":
        nextIndex = index >= last ? (options.loop ? 0 : last) : index + 1;
        break;
      case "prev":
        nextIndex = index <= 0 ? (options.loop ? last : 0) : index - 1;
        break;
    }
    const next = items[nextIndex];
    if (next !== undefined && next !== target) focusItem(next);
  };

  return {
    setOptions: (options) => {
      latestOptions = options;
    },
    apply,
    handlers: { onFocus, onBlur, onPointerDown, onKeyDown },
  };
}

/**
 * Roving focus over the focusable descendants of `ref`'s element (design 6.2). Writes `tabindex`
 * (`0` on the Tab stop, `-1` on the other items) from a layout effect after every commit of the
 * calling component, from a `MutationObserver` on the subtree and from focus / pointer events;
 * the items render none. Returns the container's handlers for its library props.
 */
export function useRovingFocus(
  ref: RefObject<HTMLElement | null>,
  options: RovingFocusOptions,
): RovingFocusHandlers {
  const [engine] = useState(createEngine);
  // Before every layout effect of the same commit (as `useLatest`): handlers and the observer
  // read the options of the last committed render.
  useInsertionEffect(() => {
    engine.setOptions(options);
  });
  const enabled = options.enabled !== false;

  // After every commit of the container (a deps-less layout effect).
  useLayoutEffect(() => {
    const root = ref.current;
    engine.apply(root, root?.ownerDocument.activeElement ?? null);
  });

  // Children that change without the container re-rendering.
  useEffect(() => {
    const root = ref.current;
    if (!enabled || root === null) return;
    const observer = new MutationObserver(() => {
      engine.apply(root, root.ownerDocument.activeElement);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "hidden", "inert", "aria-disabled"],
    });
    return () => {
      observer.disconnect();
    };
  }, [engine, enabled, ref]);

  return engine.handlers;
}
