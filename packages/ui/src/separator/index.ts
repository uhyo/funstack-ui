// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";

/**
 * Separator: a line between two pieces of content. An `<hr>` with `aria-orientation` and
 * `data-orientation`; `decorative` makes it `role="none"` (a visual line, also valid inside a
 * listbox). Directive-free: a Server Component may render it. Inside a Toolbar, Menu or Select use
 * `Toolbar.Separator`, `Menu.Separator` or `Select.Separator`.
 *
 * @see https://ui.funstack.work/components/separator
 */
export { Separator } from "./separator.js";
export type { SeparatorProps, SeparatorState, SeparatorOrientation } from "./separator.js";
