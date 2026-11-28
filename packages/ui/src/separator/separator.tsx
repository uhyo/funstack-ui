// No "use client": `Separator` reads no context and calls no hook, so a Server Component may
// render it and it runs once, on the server (design/components/separator.md 7). It must not
// import from any "use client" module (checked by src/__tests__/directives.test.ts).
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { dataAttr } from "../internal/data-attr.js";
import { mergeRenderRef, renderElement } from "../internal/render-element.js";
import type { DataAttributes } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";

/** The direction of the line itself. */
export type SeparatorOrientation = "horizontal" | "vertical";

/** State of `Separator`, passed to the function forms of `className`, `style` and `render`. */
export interface SeparatorState {
  /** The `orientation` prop. */
  readonly orientation: SeparatorOrientation;
  /** The `decorative` prop (`data-decorative`). */
  readonly decorative: boolean;
}

/**
 * Props of `Separator`.
 *
 * @see https://ui.funstack.work/components/separator
 */
export interface SeparatorProps extends Omit<
  ComponentPropsWithRef<"hr">,
  "role" | "aria-orientation" | "className" | "style" | "children"
> {
  /**
   * The direction of the line itself. A vertical separator sits between things laid out in a row.
   *
   * @defaultValue `"horizontal"`
   */
  orientation?: SeparatorOrientation;
  /**
   * A visual line with no meaning: `role="none"`, no `aria-orientation`. Leave it `false` when
   * the line marks a real break between sections of content.
   *
   * @defaultValue `false`
   */
  decorative?: boolean;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, SeparatorState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, SeparatorState>;
  /**
   * Replace the `<hr>` (element form) or take over rendering (function form). The part writes
   * the role, so any element is a separator (or, with `decorative`, none).
   */
  render?: RenderProp<ComponentPropsWithRef<"hr">, SeparatorState>;
}

/**
 * A line between two pieces of content: an `<hr role="separator">` with `aria-orientation` and
 * `data-orientation`, or with `decorative` a `role="none"` line with no `aria-orientation`. Not
 * focusable. Directive-free, so a Server Component may render it.
 *
 * Owned keys (conventions 1.5): `role` in both modes (`"separator"`, or `"none"` while
 * `decorative`; either wins over a `render` element's own), `aria-orientation`,
 * `data-orientation`, `data-decorative`.
 *
 * @see https://ui.funstack.work/components/separator
 */
export function Separator({
  orientation = "horizontal",
  decorative = false,
  className,
  style,
  render,
  ref,
  ...rest
}: SeparatorProps) {
  const state: SeparatorState = { orientation, decorative };
  const libraryProps: Partial<ComponentPropsWithRef<"hr">> & DataAttributes = {
    // Rendered, not left to the `<hr>`: a `render` element of another tag is a separator too
    // (design/components/separator.md 3).
    role: decorative ? "none" : "separator",
    "aria-orientation": decorative ? undefined : orientation,
    "data-orientation": orientation,
    // Every boolean of the state is also an attribute (conventions 4.1 rule 2).
    "data-decorative": dataAttr(decorative),
  };

  return renderElement<ComponentPropsWithRef<"hr">, SeparatorState>({
    defaultElement: "hr",
    render,
    state,
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps,
    // Passed through to the element, never read during render.
    // oxlint-disable-next-line react/refs
    ref: mergeRenderRef(ref, render),
  });
}

Separator.displayName = "Separator";
