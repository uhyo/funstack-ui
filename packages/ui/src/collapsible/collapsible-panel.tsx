"use client";
import { use } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode, ViewTransitionClass } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { useTransitionBoundary } from "../internal/transition-boundary.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useDevWarning } from "../internal/use-dev-warning.js";
import { useRender } from "../internal/use-render.js";
import { CollapsibleContext } from "./collapsible-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * State of `Collapsible.Panel`, passed to the function forms of `className`, `style`, `children`
 * and `render`.
 */
export interface CollapsiblePanelState {
  /** Committed open state. `false` in JS-free mode (conventions 4.1 rule 3). */
  readonly open: boolean;
  /** The Root's `disabled` prop. */
  readonly disabled: boolean;
}

/**
 * Props of `Collapsible.Panel`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export interface CollapsiblePanelProps extends Omit<
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
  className?: StateValue<string | undefined, CollapsiblePanelState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, CollapsiblePanelState>;
  /**
   * Always mounted (closed `<details>` content stays in the DOM, indexable and searchable). The
   * function form receives committed `open`, which is how content is mounted lazily and how
   * suspending content keeps the Collapsible closed until it is ready (library mode).
   */
  children?: StateValue<ReactNode, CollapsiblePanelState>;
  /** Replace the default `<div>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"div">, CollapsiblePanelState>;
}

/**
 * The content region: a `div` inside the `<details>`, after the Trigger. Its visibility is the
 * Root's `open` attribute (`details:open > .panel`); it renders committed state.
 *
 * Owned keys (conventions 1.5): `data-disabled`.
 *
 * @see https://ui.funstack.work/components/collapsible
 */
export function CollapsiblePanel({
  transition,
  className,
  style,
  children,
  render,
  ...rest
}: CollapsiblePanelProps) {
  const root = use(CollapsibleContext);
  if (root === null) {
    throw new Error("Collapsible.Panel must be rendered inside a Collapsible.Root.");
  }
  const isLibrary = root.library;

  useDevWarning(
    !isLibrary && transition !== undefined,
    isDev &&
      "Collapsible.Panel: `transition` has no effect in JS-free mode; the browser toggles the " +
        "<details> outside any React transition.",
  );

  const state: CollapsiblePanelState = { open: root.committedOpen, disabled: root.disabled };

  const element = useRender<ComponentPropsWithRef<"div">, CollapsiblePanelState>({
    defaultElement: "div",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps: {
      "data-disabled": dataAttr(root.disabled),
    },
  });

  return useTransitionBoundary("Collapsible.Panel", isLibrary ? transition : undefined, element);
}

CollapsiblePanel.displayName = "CollapsiblePanel";
