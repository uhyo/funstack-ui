// Platform attributes and CSS properties that `@types/react` 19.3 / `csstype` 3.2.3 do not type
// yet (conventions 7.4). This file is the only place a `declare module` appears. Each entry names
// the upstream gap so it can be deleted when DefinitelyTyped catches up. Write these attributes
// lowercase in JSX: react-dom passes unknown lowercase attributes through verbatim on client and
// server.
//
// This is a module rather than a `.d.ts` so that the dts build emits it into `dist`; the root
// entry (`src/index.ts`) imports it for its types, so consumers of `@funstack/ui` get the same
// augmentations as the library's own source.
//
// CSS properties are added to `React.CSSProperties` rather than to `csstype`'s `Properties`
// (which conventions 7.4 names): `csstype` is a dependency of `@types/react`, not of this
// package, so under pnpm's strict layout `declare module "csstype"` cannot resolve from here, in
// the library's own typecheck or in a consumer's `node_modules/@funstack/ui/dist`. Every React
// `style` prop is typed as `React.CSSProperties`, so the effect for consumers is the same.
import type * as React from "react";

declare module "react" {
  interface HTMLAttributes<T> {
    /**
     * `focusgroup` (Chromium 150+): native roving focus. A behaviour token (`tablist`, `toolbar`,
     * ...) plus modifiers (`inline`, `block`, `wrap`, `nowrap`, `nomemory`).
     * Not in `@types/react` 19.3.0 (no DefinitelyTyped issue filed as of 2026-10-16).
     */
    focusgroup?: string | undefined;
    /**
     * `focusgroupstart` (Chromium 150+): marks the item a `focusgroup` enters on when focus
     * arrives from outside (with `nomemory`, always). Boolean attribute: pass `""`.
     * Not in `@types/react` 19.3.0 (no DefinitelyTyped issue filed as of 2026-10-17).
     */
    focusgroupstart?: "" | undefined;
  }

  interface ButtonHTMLAttributes<T> {
    /**
     * `interestfor` (Interest Invokers, Chromium 142+): id of the element, usually a popover,
     * shown when the user shows interest in this button (hover, keyboard focus, long-press).
     * Not in `@types/react` 19.3.0 (DefinitelyTyped #74664).
     */
    interestfor?: string | undefined;
    /**
     * `commandfor` (Invoker Commands): id of the element the button's `command` acts on.
     * Not in `@types/react` 19.3.0 (DefinitelyTyped #74664).
     */
    commandfor?: string | undefined;
    /**
     * `command` (Invoker Commands): a built-in command (`show-popover`, `hide-popover`,
     * `toggle-popover`, `show-modal`, `close`, `request-close`) or a custom `--command`.
     * Not in `@types/react` 19.3.0 (DefinitelyTyped #74664).
     */
    command?:
      | "show-popover"
      | "hide-popover"
      | "toggle-popover"
      | "show-modal"
      | "close"
      | "request-close"
      | `--${string}`
      | undefined;
  }

  interface AnchorHTMLAttributes<T> {
    /** `interestfor` on `<a href>` (Chromium 142+). Not in `@types/react` 19.3.0 (DefinitelyTyped #74664). */
    interestfor?: string | undefined;
  }

  interface AreaHTMLAttributes<T> {
    /** `interestfor` on `<area href>` (Chromium 142+). Not in `@types/react` 19.3.0 (DefinitelyTyped #74664). */
    interestfor?: string | undefined;
  }

  namespace JSX {
    interface IntrinsicElements {
      /**
       * `<selectedcontent>` (customizable select: Chromium 135+, Safari 27): inside a select's
       * `<button>`, the browser clones the selected option's content into it. React renders the
       * unknown lowercase tag verbatim on client and server. `Select.Value` renders it.
       * Not in `@types/react` 19.3.0 (no DefinitelyTyped issue filed as of 2026-10-17).
       */
      selectedcontent: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }

  interface CSSProperties {
    /** `interest-delay` shorthand (Chromium 142+). Not in `csstype` 3.2.3. */
    interestDelay?: string | undefined;
    /** `interest-delay-start` (Chromium 142+; default `0.25s`). Not in `csstype` 3.2.3. */
    interestDelayStart?: string | undefined;
    /** `interest-delay-end` (Chromium 142+; default `0.15s`). Not in `csstype` 3.2.3. */
    interestDelayEnd?: string | undefined;
  }
}
