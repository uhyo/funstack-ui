import type { PropRow } from "../components/Tables.js";

/** The `className` / `style` / `children` rows every rendering part shares. */
export function functionProps(state: string, childrenNote?: string): PropRow[] {
  return [
    {
      name: "className",
      type: `string | ((state: ${state}) => string | undefined)`,
      description: "A class name, or a function of the part's state.",
    },
    {
      name: "style",
      type: `CSSProperties | ((state: ${state}) => CSSProperties | undefined)`,
      description: "Inline style, or a function of the part's state.",
    },
    {
      name: "children",
      type: `ReactNode | ((state: ${state}) => ReactNode)`,
      description: childrenNote ?? "Content, or a function of the part's state.",
    },
  ];
}

/** The `className` / `style` rows of a part that renders a void element (no `children`). */
export function stylingProps(state: string): PropRow[] {
  return functionProps(state).slice(0, 2);
}

/** The `render` row. */
export function renderProp(element: string, state: string): PropRow {
  return {
    name: "render",
    type: `ReactElement | ((props, state: ${state}) => ReactNode)`,
    description: `Replace the default <${element}> (element form) or take over rendering (function form).`,
  };
}
