"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext } from "./accordion-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Accordion.Panel`, passed to the function forms of `className`, `style`, `children` and
 * `render`.
 */
export interface AccordionPanelState {
  /** The enclosing Item's `value`. */
  readonly value: string;
  /** Committed open state. `undefined` in JS-free mode. */
  readonly open: boolean | undefined;
  /** The enclosing Item is disabled (by its own prop or by the Root). */
  readonly disabled: boolean;
}

/**
 * Props of `Accordion.Panel`.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export interface AccordionPanelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the panel's
   * `div`; animates content that mounts or changes in the commit that ends an action.
   *
   * Static: setting or unsetting it remounts the element. Any value, `"none"` included, makes a
   * mount or `<Activity>` reveal inside a transition start a document view transition (a ~250 ms
   * page cross-fade that the next transition waits for).
   */
  transition?: ViewTransitionClass;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AccordionPanelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AccordionPanelState>;
  /**
   * Always mounted (closed `<details>` content stays in the DOM, indexable and searchable). The
   * function form receives committed `open`, which is how content is mounted lazily and how
   * suspending content keeps the item closed until it is ready.
   */
  children?: StateValue<ReactNode, AccordionPanelState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionPanelState>;
}

/**
 * The item's content region: a `div` inside the `<details>`, after the Trigger. Its visibility
 * is the parent's `open` attribute (`details:open > .panel`); it renders committed state.
 *
 * @see https://ui.funstack.work/components/accordion
 */
export function AccordionPanel({
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: AccordionPanelProps) {
  // Only the Item's context (memoised per item).
  const item = use(AccordionItemContext);
  if (item === null) {
    throw new Error("Accordion.Panel must be rendered inside an Accordion.Item.");
  }
  const isLibrary = item.library;

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Accordion.Panel: `transition` has no effect in JS-free mode; the browser toggles the item " +
        "outside any React transition.",
  );

  const state: AccordionPanelState = {
    value: item.value,
    open: item.committedOpen,
    disabled: item.disabled,
  };

  const element = useRender<ComponentPropsWithRef<"div">, AccordionPanelState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-disabled": dataAttr(item.disabled),
    },
  });

  return useTransitionBoundary("Accordion.Panel", isLibrary ? transition : undefined, element);
}

AccordionPanel.displayName = "AccordionPanel";
