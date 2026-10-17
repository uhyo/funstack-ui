"use client";
import { useLayoutEffect } from "react";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { useSelectContext } from "./select-context.js";
import { useSelectPartRef } from "./select-dom.js";
import type { SelectRootState } from "./select-root.js";

const isDev = process.env.NODE_ENV !== "production";

export interface SelectValueProps extends Omit<
  ComponentPropsWithRef<"selectedcontent">,
  "children" | "dangerouslySetInnerHTML" | "className" | "style"
> {
  className?: StateValue<string | undefined, SelectRootState>;
  style?: StateValue<CSSProperties | undefined, SelectRootState>;
  /** Replace the rendered element. Must keep a `<selectedcontent>`. */
  render?: RenderProp<ComponentPropsWithRef<"selectedcontent">, SelectRootState>;
}

/** Where the browser clones options into `<selectedcontent>` (Chromium 135+, Safari 27). */
function supportsSelectedContent(): boolean {
  return typeof globalThis !== "undefined" && "HTMLSelectedContentElement" in globalThis;
}

/**
 * Whether a mutation record changes what `<selectedcontent>` shows: a record inside the selected
 * option. Attribute records on the option element itself are ignored (option attributes are not
 * cloned, and the library writes `data-*` there); records inside `<selectedcontent>` are never
 * inside an option, so the refresh's own clone does not loop.
 */
function touchesSelected(record: MutationRecord, selected: HTMLOptionElement): boolean {
  if (record.type === "attributes" && record.target === selected) return false;
  return selected.contains(record.target);
}

/**
 * `<selectedcontent>`: the browser clones the selected option's content into it (inside
 * `Select.Trigger`). It has no `children`. Rendered with `suppressHydrationWarning` and an empty
 * `dangerouslySetInnerHTML` so that hydration accepts the content the parser cloned before React
 * ran (design/components/select.md 3.3).
 *
 * Also keeps it fresh: the platform re-clones only on selection changes, so when React changes
 * the selected option's content (a label, a state function, a Suspense boundary resolving inside
 * it), a `MutationObserver` re-assigns `select.value = select.value`, which re-clones without
 * events and without touching the selection or an open picker (6.3). The same refresh follows a
 * form reset, which Chromium does not re-clone for. Not installed where
 * `HTMLSelectedContentElement` is undefined (Firefox today, jsdom): nothing is cloned there.
 *
 * Owned keys: `dangerouslySetInnerHTML`, `suppressHydrationWarning`, `children`.
 */
export function SelectValue({ className, style, render, ...rest }: SelectValueProps) {
  const ctx = useSelectContext("Select.Value");
  const { ref, node } = useSelectPartRef<HTMLElement>("Select.Value", "selectedcontent");

  useLayoutEffect(() => {
    const el = node.current;
    if (el === null) return;
    const select = el.closest("select");
    if (select === null) {
      if (isDev) {
        console.error(
          "Select.Value: rendered outside the Select.Root's <select>; put it inside " +
            "Select.Trigger, the select's first child.",
        );
      }
      return;
    }
    if (!supportsSelectedContent()) return;
    const refresh = () => {
      // Nothing selected: assigning the value would select the placeholder (probe case 7).
      if (select.selectedIndex === -1) return;
      // The assignment is the re-clone trigger; it fires no event and keeps the selection.
      const current = select.value;
      select.value = current;
    };
    const observer = new MutationObserver((records) => {
      const selected = select.options[select.selectedIndex];
      if (selected === undefined) return;
      if (records.some((record) => touchesSelected(record, selected))) refresh();
    });
    observer.observe(select, {
      childList: true,
      characterData: true,
      attributes: true,
      subtree: true,
    });
    // A form reset changes the selection without re-cloning (Chromium 156: `form.reset()` leaves
    // the old option's content in <selectedcontent>; memo/developer/select.md). `reset` bubbles
    // and fires before the reset algorithm, so the refresh waits a microtask. Listening on the
    // document follows a changed form owner; React's own reset after a form action is a
    // `form.reset()` too.
    const doc = select.ownerDocument;
    const onReset = (event: Event) => {
      if (event.target !== select.form) return;
      queueMicrotask(() => {
        if (!event.defaultPrevented) refresh();
      });
    };
    doc.addEventListener("reset", onReset);
    return () => {
      observer.disconnect();
      doc.removeEventListener("reset", onReset);
    };
  }, [node]);

  const state: SelectRootState = {
    value: ctx.optimistic,
    pending: ctx.pending,
    disabled: ctx.disabled,
  };
  return useRender<ComponentPropsWithRef<"selectedcontent">, SelectRootState>({
    defaultElement: "selectedcontent",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps: {
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: { __html: "" },
    },
    ref,
  });
}

SelectValue.displayName = "SelectValue";
