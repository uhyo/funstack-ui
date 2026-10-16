"use client";
import { use, ViewTransition } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import { dataAttr } from "../internal/data-attr.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { AccordionItemContext, AccordionRootContext } from "./accordion-context.js";

export interface AccordionPanelState {
  readonly value: string;
  /** Committed open state. `undefined` in JS-free mode. */
  readonly open: boolean | undefined;
  readonly disabled: boolean;
}

export interface AccordionPanelProps extends Omit<
  ComponentPropsWithRef<"div">,
  "className" | "style" | "children"
> {
  /**
   * Library mode only. Forwarded as `default` to the `<ViewTransition>` around the panel's
   * `div`; animates content that mounts or changes in the commit that ends an action.
   */
  transition?: ViewTransitionClass;
  className?: StateValue<string | undefined, AccordionPanelState>;
  style?: StateValue<CSSProperties | undefined, AccordionPanelState>;
  /**
   * Always mounted (closed `<details>` content stays in the DOM, indexable and searchable). The
   * function form receives committed `open`, which is how content is mounted lazily and how
   * suspending content keeps the item closed until it is ready.
   */
  children?: StateValue<ReactNode, AccordionPanelState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, AccordionPanelState>;
}

/**
 * The item's content region: a `div` inside the `<details>`, after the Trigger. Its visibility
 * is the parent's `open` attribute (`details:open > .panel`); it renders committed state.
 */
export function AccordionPanel({
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: AccordionPanelProps) {
  const root = use(AccordionRootContext);
  const item = use(AccordionItemContext);
  if (item === null) {
    throw new Error("Accordion.Panel must be rendered inside an Accordion.Item.");
  }
  const isLibrary = root?.mode === "library";

  useDevWarning(
    !isLibrary && transition !== undefined,
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
    props: {
      ...rest,
      "data-disabled": dataAttr(item.disabled),
    },
  });

  return (
    <ViewTransition default={isLibrary ? (transition ?? "none") : "none"}>{element}</ViewTransition>
  );
}

AccordionPanel.displayName = "AccordionPanel";
