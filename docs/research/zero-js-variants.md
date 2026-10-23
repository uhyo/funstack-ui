# Zero-JS (directive-free) variants of platform-native parts

Date: 2026-10-23. GitHub issue #19 (wave 13). Probes: `memo/platform-researcher/probes/19-zero-js/`
(sources, build logs and `results.txt`), run against React / react-dom 19.3.1, FUNSTACK Static 1.3.3
(`ssr: true`), `@vitejs/plugin-rsc` 0.5.38, Vite 8.3.4, tsdown 0.23.1 and `@funstack/ui`
0.1.0-alpha.10. Support data: BCD 8.1.7 (timestamp 2026-10-22); current stable is Chrome 156,
Firefox 158, Safari 27.

## Summary and verdict

**Not yet: do not build a second, directive-free anatomy now.** Keep one anatomy. Describe the
current guarantee as "no behaviour JS on the native path; works before and without hydration".
Do not promise "no client bundle".

The measurements behind this:

1. **On FUNSTACK Static, a page with no client components still ships about 76 KB gzip of JS.**
   A page that renders only plain `<details name>` markup from a Server Component still loads
   React, react-dom and the RSC client: `import("/assets/index-….js")`, 244,997 B raw / 76,116 B
   gzip. It also fetches the RSC payload and hydrates the whole document. FUNSTACK Static has no
   "no client references, no runtime" mode.
2. **The library parts add 2 to 5 KB gzip per component family on top of that runtime.** Each
   variant renders the same markup from a Server Component with no interactive props. Extra JS
   compared with the plain page:
   - Accordion: +5.1 KB
   - Tooltip: +5.0 KB
   - Switch: +3.8 KB
   - Progress: +1.9 KB (its Root is already directive-free)
   - All four together: +10.3 KB, because internals are shared

   That is 2.5 to 13.5 % of the baseline. A directive-free variant would remove only this part
   (plus hydrating those few components). It cannot reach "no client bundle" on this stack.
3. **Where a page really can ship zero JS, the current parts already work.** That means plain
   SSR or static prerender without hydration: `react-dom/static` `prerender`, an Astro island
   without `client:*`, email HTML. `"use client"` means nothing there, client hooks run during
   SSR, and nothing hydrates. Probe `static-markup.mjs` renders today's Accordion, Tooltip and
   Switch to complete, working HTML this way. The directive only matters in an RSC tree, and every
   RSC host measured or known boots a client runtime anyway.

The second anatomy would need explicit `name` / `id` props, no Field integration, no action props
and no data attributes that track state. That cost is real. The gain is a few KB on a page that
already pays about 76 KB. Revisit if a target RSC host learns to skip the runtime for pages with no
client references, or if users ask.

If the product owner still wants the zero-JS claim, the smallest honest step is **one** component:
a directive-free Accordion (Disclosure) on its own subpath (section 5, option B). Every other
candidate either loses behaviour in some engine (Tooltip) or adds almost nothing over plain HTML
(Switch, Checkbox, Radio, Slider, NumberField).

Findings that matter beyond this issue:

- **Server Component `useId` ids collide across separately rendered Flight payloads.** This
  includes FUNSTACK Static's `defer()`. The main payload and a deferred payload both start at
  `_S_1_`, so the document ends up with two `id="_S_1_"` (probe `app-defer.tsx`). Flight has an
  `identifierPrefix` option, but `defer()` does not set one. **`Progress.Root` and `Meter.Root`
  are affected today**: they derive the Label id from a server `useId`. A Progress inside a
  `defer()` chunk and another outside it can collide, which breaks `aria-labelledby`. Client
  `useId` (`_R_…`) is unaffected. Filed as #94 here and uhyo/funstack-static#198 upstream (set a
  distinct `identifierPrefix` per deferred payload).
- **A `React.cache()`-scoped mutable "server context" is unsafe.** It works only while rendering
  stays synchronous and depth-first. An async child resumes after a sibling Root has overwritten
  the shared value. In the probe, item `1b` of group `g1` rendered `name="g2"`. Reject it as a way
  for a Root to pass data to its parts.
- **Directive-free variants are not server-only.** A directive-free module imported from a client
  component runs on the client as an ordinary component, so a second anatomy would work in both
  kinds of tree. They also allow function props (`className(state)`, `render`, `children(state)`)
  from a Server Component, because the part runs on the server. Today only `Progress.Root` and
  `Meter.Root` allow this (conventions 7.3).

## 1. What a `"use client"` part costs when a Server Component renders it

Setup: one page per variant, built with FUNSTACK Static (`ssr: true`, a minimal Root). Each page
renders only the named component from the App Server Component, with serialisable props and no
actions. Byte counts are the sum of all emitted JS assets (`gzip -9`). Each variant has one page,
and every asset is preloaded or imported by that page.

| Variant (Server Component renders) | JS chunks | Raw B | Gzip B | Over plain |
| --- | --- | --- | --- | --- |
| `plain`: hand-written `<details name>` (no client reference) | runtime `index` (React + react-dom + RSC client + FUNSTACK client), `rsc`, `rolldown-runtime` | 244,997 | 76,116 | — |
| `accordion`: `Accordion.Root exclusive` + 2 Items (JS-free mode) | + `entries` (parts + internals), `jsx-runtime` split out | 257,063 | 81,254 | +5,138 |
| `tooltip`: 2 Tooltips (one `experimental_interestFor` + `experimental_hint`) | + `entries`, `react-dom` split out | 256,664 | 81,119 | +5,003 |
| `progress`: `Progress.Root value={40}` + Label, Track, Indicator | + `entries`, `react` split out | 248,904 | 78,043 | +1,927 |
| `switch`: `<Switch name defaultChecked>` in a form | + `entries`, `jsx-runtime` | 253,490 | 79,929 | +3,813 |
| `combined`: all four above | + `entries` | 273,614 | 86,417 | +10,301 |

How a client part travels (from the payloads and HTML in `results.txt`):

- **The RSC payload refers to the parts as client references** (`I["<id>",[],"AccordionRoot",1]`)
  with the serialisable props. The HTML adds a `modulepreload` for each chunk. The plain page
  preloads none, but its inline bootstrap still runs `import("/assets/index-….js")`.
- **The module is shipped and hydrated whatever its props.** Flight cannot tell that a client
  component "would do nothing", and react-dom hydrates every client reference: hooks run and
  effects mount. Example: JS-free Accordion runs no handler on toggle, but its parts still execute
  their hooks once.
- **On the docs site** (`packages/docs`, same stack), the Accordion page preloads
  `accordion-item` (269 B), `accordion-trigger` (7.7 KB raw / 3.1 KB gzip), `use-render`,
  `use-controllable-action`, `action-details`, `transition-boundary`, `use-dev-warning` and
  `use-latest`, about 6 KB gzip together. These load next to the 76 KB `index` runtime that every
  page needs for the router. The Tooltip page adds `tooltip-trigger` (2.3 KB gzip) and
  `use-resolved-placement` (2.1 KB gzip). Without those chunks the pages would not get any closer
  to zero JS.
- **Other RSC hosts were not measured.** Next.js App Router and Waku boot a client router runtime
  on every page by design, so the same arithmetic is expected to hold. Treat that as unverified
  until someone measures it.

Conclusion for item 1: a directive-free variant saves the part's own code and its hydration work,
about 2 to 5 KB gzip per component family. It does not save the React runtime.

## 2. What Server Components can use (React 19.3.1)

`react.react-server` exports (React 19.3.1, listed with `node --conditions=react-server`):
`Activity Children Fragment Profiler StrictMode Suspense ViewTransition cache cacheSignal
captureOwnerStack cloneElement createElement createRef forwardRef isValidElement lazy memo use
useCallback useDebugValue useId useMemo`. There is no `createContext`, `useContext`, `useState`,
`useRef`, effects or `startTransition`.

| Capability | Status | Evidence |
| --- | --- | --- |
| Render a context provider created in a `"use client"` module | **Yes, new in 19.3** | React CHANGELOG 19.3.0, "Allow Server Components to render context providers from client modules" (#35675). The library already uses it in `Progress.Root` (conventions 7.1). |
| Read a context (`use(Ctx)`) | **No** | Probe `app-ctxread.tsx`: the production build fails with "Cannot use() an already resolved Client Reference". The dev build fails with "Cannot read a Client Context from a Server Component" (the string exists in the vendored `react-server-dom-webpack` 19.3.1). The context object is a client reference on the server. |
| `useId` | **Yes, with a caveat** | Ids are `_S_1_`, `_S_2_`, … per Flight render, so they never collide with client `_R_…` ids. They **do** collide between two Flight renders shown in one document (`defer()` probe above). |
| `cache()` | Yes, per request | `perRequest()` returned the same value twice in one render (`1,1`). FUNSTACK Static's prerender gives each entry its own request scope. |
| `cache()` as mutable "server context" | **Unsafe** | Root writes `scope().name`, parts read it. Synchronous siblings read the right value. An async part resumed after the next Root had run and read `g2` (`async-item:1b:g2`). |
| Children-function / render-prop Root | **Yes** | A directive-free Root that calls `children({ trigger, popup })` with ids derived from `useId` produced `<button id="_S_3_t" aria-describedby="_S_3_p" interestfor="_S_3_p">` and `<div id="_S_3_p" popover="hint">`. The Root must itself be directive-free: a function cannot be passed from a Server Component to a client Root. |
| `Children.map` / `cloneElement` on `children` | Available, **not recommended** | A server Root could inject `name` into direct `Item` children. It would miss Items inside fragments or wrapper components (`<FaqItem>`, a mapped Server Component), and React discourages `cloneElement`. |
| Server Functions as props to client parts | Yes | Conventions 7.1 / `server-function-action-props.md`. They do not apply to directive-free parts, which have no actions. |

Patterns that remain for linking ids and grouping without context, in order of preference for a
directive-free anatomy:

1. **Explicit props.** A per-Item `name` (Accordion, RadioGroup) or an explicit `id` / `for`
   (Tooltip, Popover, Dialog). This is honest and stable, but the consumer owns uniqueness. It is
   what the issue proposed.
2. **Children-function Root.** Root calls `useId` and hands ids to the consumer, who spreads them
   onto directive-free parts. It removes the uniqueness burden but inherits the `defer()` collision
   above, and the API is clumsy.
3. **Do not use** a `cache()`-scoped store (unsafe with async children) or `cloneElement`
   injection (fragile).

## 3. Packaging

| Option | How | Verdict |
| --- | --- | --- |
| A. Separate subpath, separate namespace | `src/<component>/native.ts` (directive-free) added to tsdown `entry`. With `exports: true` this generates `@funstack/ui/<component>/native` with no extra config. Alternatively a top-level folder, `@funstack/ui/native/<component>`. Export a distinct name (`NativeAccordion`, or `Accordion` from a distinct path). | **Use this if a variant is built.** One type surface per path, and a reader can see which anatomy is in use. Avoid the word `static`: it collides with "FUNSTACK Static". |
| B. Same import path, `react-server` export condition | Add `"react-server": "./dist/accordion/index.server.mjs"` through tsdown `exports.customExports`, the hook that tsdown 0.23.1 provides. `@vitejs/plugin-rsc` resolves `react-server` in the RSC environment (`conditions: ["react-server", ...]`). Prior art: `next-intl` 4.14.9, `swr` 2.5.1, `@apollo/client` 4.3.5. | **Reject for UI parts.** TypeScript resolves one `types` entry for both graphs (next-intl's `"."` points `types` at the client build only), so both anatomies would need one signature. Ours differ: explicit `name` / `id`, no actions, no Field. Moving JSX between a server and a client file would silently change its behaviour, and non-RSC SSR would never see the server build. It suits APIs whose server and client signatures are identical; ours are not. |
| C. No library variant: documented native recipes | Docs pages show the plain HTML (`<details name>`, `<input type=checkbox role=switch>`, `<input type=range>`) styled with the same CSS as the component. | Lowest cost; this is what the Slider and NumberField design docs already say. |

How other headless libraries do it: Radix (`@radix-ui/react-accordion` 1.3.1), Base UI
(`@base-ui/react` 1.9.0, including `ProgressRoot`), React Aria Components 1.22.1, Ark UI 5.39.3,
Headless UI 2.2.10 and Mantine 9.7.3 have **no** `react-server` condition. Radix and Base UI mark
every part `'use client'`. No headless library was found that ships RSC-only parts.
FUNSTACK UI's directive-free `Progress.Root` / `Meter.Root` are already ahead of all of them.

Build implications (tsdown 0.23.1, `unbundle: true`):

- A directive-free file emits as a directive-free `.mjs`. Nothing changes in the build.
- The existing directive test (conventions 10.1, Server render row) must also assert the import
  graph: a native entry imports no `"use client"` module. Exceptions are the type-only
  `platform-attributes` side-effect import, which has no runtime import, and directive-free
  internals (`data-attr`, `anchor-position`, `merge-props`).
- Shared internals are already split where it matters. `use-render.tsx` is a client module, but
  its pure half, `internal/render-element.ts`, is directive-free and is what `Progress.Root` uses
  (#68). A native part would use it the same way. `transition-boundary` and the action hooks are
  client modules, so a native part must not import them.

## 4. Per-component candidates

"Native path" means what the browser does with the markup alone. Support comes from BCD 8.1.7,
WebKit `standards-positions` `summary.json` and Bugzilla, checked on 2026-10-23.

| Component | Native mechanism | Chrome | Firefox | Safari | What a directive-free variant loses | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Accordion** | `<details name>` exclusive groups; find-in-page opens (`search_match_opens`) | 120; 97 | 130; 148 | 17.2; 26.2 (partial) | Auto `name` (consumer passes `name` per Item); `disabled` (JS `preventDefault` today); `valueChangeAction`, controlled mode, `data-open` / `data-pending` (use `[open]` / `:open`: 133 / 136 / 26.5); `transition`. | **Only real candidate.** No behaviour loss on the native path in any engine; saves about 5 KB gzip. |
| **Tooltip** | `interestfor` + `popover="hint"`; implicit anchor; `interest-delay` | 142; hint 151 | none; hint 153 | none; hint none (Technology Preview only) | The JS path. **No visible tooltip at all in Firefox and Safari** (the `aria-describedby` / `aria-labelledby` text remains). Also loses auto ids, `data-instant` warm opens (#93; the CSS `--fsui-tooltip-warm` skip-delay remains), resolved `data-side` after flips (only the requested side) and the dismissal fallbacks. Firefox bug 1984699 UNCONFIRMED (changed 2026-10-07); WebKit bug 297786 NEW; WebKit position #464 has no position; Mozilla #1181 neutral. | **Not yet.** It would be a whole component whose only behaviour is Chromium-only. |
| **Popover** | `commandfor` + `toggle-popover`; implicit anchor; `popover="auto"` | 135; anchor 135 | 144; anchor 147 | 26.2; 26.2 | Auto ids (explicit `id`); `openChangeAction`, `keepMounted` / `<Activity>`, `transition`; resolved `data-side`. **`aria-expanded`**: Chromium maps invoker expanded state natively, Gecko and WebKit are unverified (`popover-menu.md`). A static part could not keep a server-rendered `aria-expanded` current, so it must omit it, and Gecko/WebKit users may get no expanded state. | Possible, but the a11y gap must be closed first. |
| **Dialog** (modal) | `commandfor` + `show-modal` / `request-close`; `<form method="dialog">` | 135 | 144 | 26.2 | Auto ids for trigger, title and description (explicit ids); `openChangeAction`, unmount, `transition`; `modal={false}` (needs JS); `closedby` light dismiss (Safari: Technology Preview only). | Possible: full behaviour in all engines for the modal case. Value is low: Dialog pages usually have other client code. |
| **Switch / Checkbox** | `<input type=checkbox role=switch>` / native checkbox | all | all | all (`switch` attribute is Safari-only) | `checkedChangeAction`, optimistic `data-checked` (use `:checked`), **Field integration** (`Field` context gives id, description, invalid, required), `indeterminate` (a DOM property only; there is no HTML attribute, so a static Checkbox cannot be mixed). | **Recipe, not variant.** The part would add nothing over the native input. |
| **RadioGroup** | `<fieldset role=radiogroup>` + same-`name` radios; native arrows | all | all | all | Shared `name` from Root (per-Item `name`), Field, `valueChangeAction`, `data-checked`. | Recipe. |
| **CheckboxGroup** | — | | | | The parent "select all" needs JS. | Excluded. |
| **Select** | Real `<select>` + customizable select (`appearance: base-select`, `<selectedcontent>`) | 135 | flag only (native fallback) | 27 | Action, pending, Field, Suspense options. Server Component output is still hydrated by react-dom, so `Select.Value` would still need the `suppressHydrationWarning` workaround (conventions 7.4). | Recipe. The value of the library Select is the parts it adds on top. |
| **Slider** | `<input type=range>` | all | all | all | Every stylable part (Thumb, Track, Range), multi-thumb, pointer code (`slider.md` §4: a native range is styled only through vendor pseudo-elements, which needs a stylesheet). | Recipe (already the design doc's position). |
| **NumberField** | `<input type=number>` | all | all | all | Formatting and localisation, which are the reason for the component. | Recipe (already the design doc's position). |
| **Progress / Meter** | `role=progressbar` / `meter` divs, `--progress-value` | all | all | all | The Root is already directive-free. Track / Indicator read context only for `data-indeterminate` / `data-complete`. Label needs the id; Value needs the formatted text. | Not worth a variant (+1.9 KB). Fix the `useId` collision instead (summary). |
| Toggle, ToggleGroup, Toolbar, Tabs, Menu, Combobox, Toast, ContextMenu, Button, Field / Form | — | | | | No JS-free behaviour (Tabs, Toggle and Menu need JS), or an action-less part is just the native element (Button). | Excluded. |

## 5. The "second anatomy" trade-off: options

| | A. Status quo + wording (recommended) | B. One native component | C. Native family |
| --- | --- | --- | --- |
| What ships | Nothing new. Docs say "no behaviour JS, works without hydration". Native recipes on the Switch, Checkbox, RadioGroup, Slider and NumberField pages. | `@funstack/ui/accordion/native` (Root `div`, Item `details` with required `name`, Trigger `summary`, Panel `div`). Usable from Server and Client Components, function props allowed. | B plus Popover / Dialog with explicit ids, and Tooltip behind a flag. |
| Saves | 0 | About 5 KB gzip on Accordion-only pages | About 5 KB per component used |
| Cost | None | A second props surface, docs page and test matrix for one component. Two Accordions to explain. | Repeats B per component, and the Popover `aria-expanded` gap must be solved first. Tooltip offers nothing visible in 2 of 3 engines. |
| API impact | None | None on the existing Accordion | Explicit-id parts across three components |

Recommendation: **A now**, and record B as a ready plan. Track the `useId` collision as its own
issue regardless of the option chosen.

## Filed

1. `Progress.Root` / `Meter.Root` server `useId` ids collide across `defer()` payloads: **#94**.
   Reproduction: `memo/platform-researcher/probes/19-zero-js/src/app-defer.tsx`. Upstream:
   **uhyo/funstack-static#198** (give each deferred Flight render a distinct `identifierPrefix`).

## References

- React CHANGELOG 19.3.0 (#35675, Server Components render client context providers): https://github.com/facebook/react/blob/main/CHANGELOG.md
- FUNSTACK Static `defer()`: `node_modules/@funstack/static/dist/docs/api/Defer.md` (1.3.3); https://static.funstack.work/
- MDN BCD 8.1.7: https://unpkg.com/@mdn/browser-compat-data@8.1.7/data.json (`html.elements.details.name`, `html.elements.button.interestfor`, `html.global_attributes.popover.hint`, `html.elements.button.commandfor.implicit_anchor_reference`, `html.elements.dialog.closedby`, `css.properties.appearance.base-select`, `html.elements.details.search_match_opens`)
- WebKit standards position #464 (`interestfor`): https://github.com/WebKit/standards-positions/issues/464
- Mozilla standards position #1181 (`interestfor`, neutral): https://github.com/mozilla/standards-positions/issues/1181
- Firefox bug 1984699: https://bugzilla.mozilla.org/show_bug.cgi?id=1984699 ; WebKit bug 297786: https://bugs.webkit.org/show_bug.cgi?id=297786
- `react-server` condition prior art: https://unpkg.com/next-intl@4.14.9/package.json, https://unpkg.com/swr@2.5.1/package.json
- tsdown `exports.customExports`: tsdown 0.23.1 `ExportsOptions` type declarations
- Related research: `popover-anchor-tooltip.md`, `popover-menu.md` (invoker `aria-expanded`), `form-controls.md` §8 item 7, `slider.md` §4, `server-function-action-props.md`
