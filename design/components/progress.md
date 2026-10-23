# Progress and Meter

Status: **accepted** (2026-10-18, wave 6, GitHub issue #68; research issue #65,
`docs/research/wave6.md` §3; the product owner accepted all twelve items of "For the product
owner" as recommended, see the end of this document; the conventions proposals were applied in
f3ab2e4, conventions resolved question 32). Implemented in 6fef197; the review
(`memo/reviewer/progress-meter.md`) and its fixes (ab22773) are folded in on 2026-10-18, see
"Review corrections (#68)" at the end. The code under `packages/ui/src/progress/`,
`packages/ui/src/meter/` and the `internal/` helpers it names is the ground truth where this
document is silent. Follows `design/conventions.md` (accepted); where this document and the
conventions disagree, the conventions win. Open human checks: the Next.js provider pattern and
the screen-reader pass (#73); the docs build's silence on an RSC render error (#72).

Inputs: `docs/vision.md`, `design/conventions.md`, `docs/research/wave6.md` §3 (binding: `div
role="progressbar"` / `div role="meter"` with ARIA values, not native `<progress>` / `<meter>`,
because the native elements render no children and their fill is a vendor pseudo-element that
Firefox cannot transition; `Track` / `Indicator` parts; a CSS custom property for the fill;
`aria-valuetext` always, because screen readers otherwise compute their own percentage; the
HTML `low` / `high` / `optimum` region algorithm as a pure function; no `<ViewTransition>`), the
product owner's decision on research question (d), the accepted Slider design (`--slider-value`,
`getAriaValueText`, `Value` as a `span`, no `transition` prop) and Field design (one state object
for every part, an always-referenced id, labelling), the WAI-ARIA 1.2 `progressbar` and `meter`
roles, HTML-AAM, the HTML `<meter>` rendering section and Chromium's `HTMLMeterElement`, prior art
(Base UI, React Aria, Radix, Ark UI), and the working notes in
`memo/architect/progress-meter-notes.md`.

Progress and Meter are the library's first **output-only** components: nothing is pressed,
typed or dragged, so there is no action, no pending state and no optimistic state. What the
vision asks of them is the other half of Async React: **a Progress is the display of someone
else's action**, and the design's job is to make that display correct in every lane (a value
reported from inside a pending action must not be held by that action), to make it work with no
JavaScript at all (a `Progress.Root` can be a Server Component), and to give assistive
technology the same text the eye gets (`aria-valuetext` from `Intl.NumberFormat`, in the page's
locale, overridable per state).

## Decisions at a glance

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Anatomy | `Progress.Root` (`div[role=progressbar]`), `Progress.Track` (`div`), `Progress.Indicator` (`span`, the fill), `Progress.Label` (`span[id]`), `Progress.Value` (`span[aria-hidden]`). `Meter.Root` (`div[role=meter]`) with the same four parts. Native `<progress>` / `<meter>` are not rendered (research §3.2, product-owner decision); the roles map to the same platform APIs (HTML-AAM). |
| 2 | Value | `Progress.Root value?: number \| null`, `null` (the default) is **indeterminate**: no `aria-valuenow`, no `aria-valuetext`, `data-indeterminate`, no `--progress-value`. `min` 0, `max` 100; the value is clamped like the platform clamps it. `Meter.Root value: number` is required (a meter is never indeterminate). `complete` when the clamped value reaches `max`. |
| 3 | Text | `aria-valuetext` is always set when a value exists: `Intl.NumberFormat(locale, format ?? { style: "percent" })` of the **fraction** when the style is `percent`, of the **value** otherwise (React Aria's rule). `format` and `locale` are serialisable, so a Server Component can pass them; `getAriaValueText(value, state)` is the function override (conventions 11), receives `null` while indeterminate, returns `null` for no attribute. No English default string anywhere: the default is the platform's localised number, like Field's `validationMessage`. |
| 4 | Regions | `Meter.Root low` / `high` / `optimum` with HTML's defaults and clamping; the region is computed by a pure function with Chromium's operators (2.4) and exposed as `data-region="optimum" \| "suboptimum" \| "even-less-good"` on every Meter part and as `state.region`. Nothing in the default `aria-valuetext` names the region (the words are the consumer's: "low battery"); the docs show the `getAriaValueText` recipe. |
| 5 | Fill | Custom properties on the Root, inherited: `--progress-value` (a percentage, absent while indeterminate); `--meter-value`, `--meter-low`, `--meter-high`, `--meter-optimum`. The library positions nothing; the consumer's CSS sizes the Indicator from the variable (`inline-size`, `scale`, `conic-gradient`). A registered `@property` lets the variable itself transition, in every engine, which the native fill cannot do in Firefox. |
| 6 | Async | **No action props, no `pending`, no `useOptimistic`, no transition types.** The component is the display of a value the consumer owns. The one Async React rule is the consumer's and it is the mirror image of the library's usual advice: a value that reports on an in-flight action is written with a plain `setState` (urgent), never inside `startTransition`, because a transition update inside a pending action is held until the action settles (conventions 2.3 item 5). Section 4. |
| 7 | ViewTransition | No `transition` prop on any part and no boundary (Slider, Select, Toast precedent): values update often and in the consumer's lane, the fill animates with a CSS transition on the registered custom property, and a boundary that mounts with `{pending && <Progress.Root />}` would pay the page cross-fade (`docs/research/view-transition-mount-cost.md`). |
| 8 | Labelling | `Progress.Label` / `Meter.Label` is a `span` whose id the Root **always** references through `aria-labelledby` (token-merged with the consumer's; a dangling reference is skipped by accname, the `Field.Description` rule), or the consumer's `aria-label`. **Host requirement (#94, resolved):** the id comes from a server `useId`, which restarts per Flight render, so a host rendering several Flight payloads into one page must give each its own `identifierPrefix` or a Root inside one payload shares its `${id}-label` with one outside it; FUNSTACK Static's `defer()` does so from `@funstack/static` 1.3.4 (uhyo/funstack-static#198, verified in `docs/research/zero-js-variants.md`), which is the minimum for a Server-rendered Root inside `defer()`. No library-side id override was added (conventions 7.3). `Progress.Value` is `aria-hidden` by default (the same text is in `aria-valuetext`). **Not a Field control**: a Progress or Meter inside a `Field.Root` is a sibling of the Field's control and carries its own name (section 6). |
| 9 | Directives | `Progress.Root` and `Meter.Root` are **directive-free** (only `useId`, pure arithmetic, `Intl`; they render a context provider imported from a `"use client"` module, conventions 7.1's second exception, first used here). `Track`, `Indicator`, `Label`, `Value` read the context and are client modules. A Server Component that renders the anatomy runs the Root on the server only: `getAriaValueText`, `children(state)` and `render` functions may be passed from it, and `Intl` runs where the data is (section 8). |
| 10 | Not in v1 | Circular parts, `Progress.View`, Field registration, a `valueLabel` string prop, `data-value` / typed `attr()`, `aria-busy` automation, a native `<progress>` rendering mode, exit animation of a completed bar (section 11). |

---

## 1. Anatomy

```tsx
import { Progress } from "@funstack/ui/progress";
import { Meter } from "@funstack/ui/meter";

// An upload. `uploaded` is a number while uploading, null before the size is known.
<Progress.Root value={uploaded} max={file.size} format={{ style: "unit", unit: "megabyte", maximumFractionDigits: 1 }}>
  <Progress.Label>Uploading {file.name}</Progress.Label>
  <Progress.Value />                        {/* "3.2 MB"; aria-hidden */}
  <Progress.Track className="track">
    <Progress.Indicator className="fill" />
  </Progress.Track>
</Progress.Root>

// A spinner: indeterminate, named by aria-label, no parts needed.
<Progress.Root aria-label="Loading messages" className="spinner" />

// Storage quota with regions.
<Meter.Root value={used} max={quota} low={quota * 0.7} high={quota * 0.9} optimum={0}
            format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}>
  <Meter.Label>Storage</Meter.Label>
  <Meter.Value>{({ formattedValue, max }) => `${formattedValue} of ${max} GB`}</Meter.Value>
  <Meter.Track className="track">
    <Meter.Indicator className="fill" />
  </Meter.Track>
</Meter.Root>
```

Rendered HTML for the upload (`uploaded` is 3 355 443 of 8 388 608; ids from one `useId` in the
Root, `_S_…` on the server, prefixed per `defer()` payload by FUNSTACK Static 1.3.4 and later,
#94; the locale is the server's or the `locale` prop):

```html
<div role="progressbar" aria-labelledby="_r_1_-label" aria-valuemin="0" aria-valuemax="8388608"
     aria-valuenow="3355443" aria-valuetext="3.2 MB" style="--progress-value: 40%">
  <span id="_r_1_-label">Uploading report.pdf</span>
  <span aria-hidden="true">3.2 MB</span>
  <div class="track">
    <span class="fill"></span>
  </div>
</div>
```

And the meter (`used` 4.6 of 5, so `data-region="even-less-good"` with `optimum={0}`):

```html
<div role="meter" aria-labelledby="_r_2_-label" aria-valuemin="0" aria-valuemax="5"
     aria-valuenow="4.6" aria-valuetext="4.6 GB" data-region="even-less-good"
     style="--meter-value: 92%; --meter-low: 70%; --meter-high: 90%; --meter-optimum: 0%">
  <span id="_r_2_-label" data-region="even-less-good">Storage</span>
  <span aria-hidden="true" data-region="even-less-good">4.6 GB of 5 GB</span>
  <div class="track" data-region="even-less-good">
    <span class="fill" data-region="even-less-good"></span>
  </div>
</div>
```

| Part | Element | Role | Renders from | Notes |
| --- | --- | --- | --- | --- |
| `Progress.Root` | `div` | `progressbar` | `value`, `min`, `max`, `format`, `locale`, `getAriaValueText` | Owns `useId`, the arithmetic and the text. `aria-valuemin` / `aria-valuemax` always; `aria-valuenow` / `aria-valuetext` when a value exists; `aria-labelledby` → `${id}-label` (token-merged with the consumer's, always present); `data-indeterminate`, `data-complete`; `--progress-value` in `style` (the consumer's `style` wins per property). Renders the context provider around `children`. |
| `Meter.Root` | `div` | `meter` | the above plus `low`, `high`, `optimum` | Same, with `aria-valuenow` / `aria-valuetext` always, `data-region`, and `--meter-value` / `--meter-low` / `--meter-high` / `--meter-optimum`. |
| `Track` | `div` | none | the state's data attributes | The rail. Nothing else: no inline size, no role. |
| `Indicator` | `span` | none | the state's data attributes | The fill. Renders **no inline size**; the consumer's CSS sizes it from the inherited custom property (section 7), as `Slider.Indicator` is placed from `--slider-start` / `--slider-end`. |
| `Label` | `span` | none | the state's data attributes | `id` = `${id}-label`, which the Root always references. A `span`, not a `<label>`: a `div[role=progressbar]` is not a labelable element, so `for` would do nothing (React Aria's choice). |
| `Value` | `span` | none | `formattedValue` | Default content `state.formattedValue` (nothing while indeterminate); `children(state)` for anything else. `aria-hidden="true"` by **default, not owned**: the same text is in the Root's `aria-valuetext`, so reading both would announce the value twice; a consumer who renders something `aria-valuetext` does not say passes `aria-hidden={false}`. |

Why this shape:

- **ARIA divs, not the native elements** (research §3.2, product-owner decision). `<progress>`
  and `<meter>` never render their children, so a `Track` / `Indicator` anatomy cannot exist
  inside them; the fill is two vendor pseudo-element families, Firefox does not transition it,
  and indeterminate rendering differs per engine. HTML-AAM maps both native elements to the same
  roles a `div` gets, so nothing is lost for assistive technology; what is lost is the
  zero-markup default rendering, which a headless library does not ship anyway. A consumer who
  wants the native element renders it themselves (section 11).
- **One Root per component, no shared `Range` base.** Progress and Meter are two namespaces and
  two subpaths because they differ where it matters to a call site: `value` optional with an
  indeterminate state against `value` required with regions; a `complete` state against
  `low` / `high` / `optimum`. They share the arithmetic and the formatting internally
  (`internal/range-value.ts`).
- **`Track` and `Indicator` are parts, not consumer `div`s**, so the data attributes land on the
  element the consumer styles (`.fill[data-complete]`, `.fill[data-region="even-less-good"]`)
  without ancestor selectors, and so a function `className` can read the state there. They
  carry no inline geometry: as in Slider, the library publishes a percentage and the consumer's
  CSS decides whether the fill is a width, a `scale`, a `conic-gradient` or a stroke.
- **`Label` is a part** because a progressbar needs a name from an element with an id and the
  consumer should not wire `aria-labelledby` by hand; see section 6 for why the Root references
  it unconditionally.
- **`Value` is a part** so the visible text and the spoken text come from one formatter: the
  same `format` / `locale` produce `aria-valuetext` and `Progress.Value`'s content, and
  `getAriaValueText` can add words the eye does not need ("40%, 2 minutes left").
- **No `Progress.Circle` / `CircleTrack` / `CircleRange`** (Ark): a circular progress is CSS
  (`conic-gradient` from the same variable, section 7.3); SVG consumers use `render`.

Element constraints for `render`: none. Every part may be any element; the library-controlled
attributes (`role`, the ARIA values, `aria-labelledby` tokens, ids, `data-*`, the custom
properties) land on whichever element renders (owned keys, conventions 1.2). A `Label` rendered
as `<label>` works but gains nothing.

A part rendered outside its Root throws in development ("`Progress.Track` must be inside
`Progress.Root`"), as the other compound components do.

---

## 2. Values, text and regions

### 2.1 Arithmetic

Pure functions in `internal/range-value.ts` (directive-free, unit-tested), shared by both Roots:

- `clamp(value, min, max)`: the platform's rule (`<progress>` 150 of 100 is 100; `<meter>` 2 of
  1 is 1; research §3.1). The clamped value is what `aria-valuenow`, `state.value` and the
  percentage use.
- `percentage = (clamped - min) / (max - min) * 100`, a number 0–100 (`state.percentage`), and
  the custom property is `${percentage}%`.
- **Degenerate range** (`max <= min`): a development warning naming the part; the percentage is
  `0`, `complete` is `false`, `aria-valuemin` / `aria-valuemax` render what was given, and the
  same `clamp` yields `min`, so `aria-valuenow` renders `min` (with `min > max` that exceeds
  `aria-valuemax`, invalid ARIA; accepted, it only happens with a call-site bug that already
  warns, review N7). Native `<progress>` substitutes `max = 1` and `<meter>` `max = min`; the
  library does neither silently, because a zero range is a bug at the call site (an empty upload
  should pass `null`).
- **Non-finite `value`** (`NaN`, `±Infinity`): a development warning; treated as `null`
  (indeterminate) by Progress and as `min` by Meter (Chromium's parse fallback, then clamped).
  A **non-finite `low` / `high` / `optimum`** on Meter counts as **absent** (the default applies,
  no warning), as the platform's attribute parser treats an unparsable attribute (developer
  deviation, accepted; `meter-region.test.ts`).
- **`complete`**: `clamped >= max` with a non-degenerate range. `state.complete` and
  `data-complete` on every Progress part.

### 2.2 `aria-valuetext`: `format`, `locale`, `getAriaValueText`

Two strings exist in the state, so the visible number and the spoken text can differ:

| Field | Source | Used by |
| --- | --- | --- |
| `formattedValue` | `new Intl.NumberFormat(locale, format ?? { style: "percent" })` applied to the **fraction** `(clamped - min) / (max - min)` when the resolved style is `percent`, to the **clamped value** otherwise (React Aria's rule: `{ style: "percent", maximumFractionDigits: 1 }` still means "the percentage, to one decimal"). `null` while indeterminate. | `Progress.Value` default content; `state.formattedValue` |
| `valueText` | `getAriaValueText(value, state)` when given (the state passed has `valueText` equal to `formattedValue`, so the override can decorate the default), else `formattedValue`. | `aria-valuetext`; `state.valueText` in every part |

Rules:

- **No built-in English string** (conventions 11). The default `aria-valuetext` is `Intl`'s
  output in the resolved locale, a platform string, as `Field.Error`'s default is the browser's
  `validationMessage`. Base UI's `"indeterminate progress"` default is not adopted: an
  indeterminate progressbar with no `aria-valuenow` is already announced as busy / indeterminate
  by screen readers, and a consumer who wants words passes
  `getAriaValueText={(v) => v === null ? "Uploading" : null}`.
- **`format` and `locale` are plain data**, so a Server Component can pass them; `getAriaValueText`
  is a function and needs a client component **unless the Root itself runs on the server**
  (section 8), which is the common RSC case.
- **`locale` defaults to the runtime's locale** (`undefined` to `Intl.NumberFormat`). Under SSR of
  a client tree the server's and the browser's locales can differ and the attribute would
  mismatch at hydration (a development warning from react-dom, no visual effect; the server's
  string stays until the next render). The docs say: pass `locale` when the page is
  server-rendered as a client tree; under RSC the Root runs once, on the server, and there is
  nothing to mismatch.
- The `Intl.NumberFormat` instance is cached per `locale` + `format` (JSON key, module-level
  `Map`, bounded) so a 60 Hz upload loop does not construct one per render.
- `getAriaValueText` returning `null` or `undefined` omits the attribute.

### 2.3 Indeterminate (Progress only)

`value` absent or `null`. The Root renders no `aria-valuenow`, no `aria-valuetext` (unless
`getAriaValueText` returns one), `data-indeterminate=""`, and no `--progress-value` (so a
registered `@property` falls back to its `initial-value`, `0%`). Chromium then exposes no value
in the accessibility tree (research §3.1, probed). `state.value`, `state.percentage` and
`state.formattedValue` are `null`; `state.indeterminate` is `true`. The visual (a sliding bar, a
spinner) is a consumer `@keyframes` on `[data-indeterminate]`, gated on `prefers-reduced-motion`
in the docs recipe (section 7.4).

Switching between indeterminate and determinate is an ordinary re-render: no remount, no
warning. The common sequence "spinner until the total is known, then a bar" is
`value={total === null ? null : done}`.

### 2.4 Meter regions

`Meter.Root` takes `low`, `high`, `optimum` with HTML's defaults and clamping (in this order,
each step using the previous results):

| | Default | Clamped to |
| --- | --- | --- |
| `value` | required | `[min, max]` |
| `low` | `min` | `[min, max]` |
| `high` | `max` | `[low, max]` |
| `optimum` | `(min + max) / 2` | `[min, max]` |

The region is `meterRegion(value, low, high, optimum)` in `meter/meter-region.ts`
(directive-free, pure, unit-tested against the table below), with Chromium's comparison
operators (`HTMLMeterElement::GetGaugeRegion`, main, read 2026-10-18; the HTML spec's prose has
the same three cases and leaves the boundaries to the implementation):

| Where `optimum` is | `value` | Region |
| --- | --- | --- |
| `optimum < low` (lower is better) | `value <= low` | `optimum` |
| | `low < value <= high` | `suboptimum` |
| | `high < value` | `even-less-good` |
| `high < optimum` (higher is better) | `high <= value` | `optimum` |
| | `low <= value < high` | `suboptimum` |
| | `value < low` | `even-less-good` |
| `low <= optimum <= high` (middle is best) | `low <= value <= high` | `optimum` |
| | otherwise | `suboptimum` (never `even-less-good`) |

The names are the platform's (Chromium's `::-webkit-meter-optimum-value`,
`-suboptimum-value`, `-even-less-good-value`; Firefox's `:-moz-meter-optimum`,
`-sub-optimum`, `-sub-sub-optimum` pseudo-classes). `state.region` and `data-region` carry the
value on every Meter part.

**Engines differ at the boundaries** (found by the browser oracle row, `memo/developer/cross-engine.md`):
Chromium puts a value exactly at `low` (when `optimum < low`) or exactly at `high` (when
`high < optimum`) in `optimum`; Firefox puts it in `suboptimum` (its operators are `value < low`
and `value > high` for the optimum part). HTML leaves the boundaries to the implementation, so
this is not a browser bug. The library follows Chromium, as the table says; the Firefox branch
of the oracle row asserts Gecko's operators for the native element and the library's region
everywhere. The clamped `low` / `high` / `optimum` are also published as
percentages (`--meter-low`, `--meter-high`, `--meter-optimum`) so the consumer's CSS can draw
the zones (section 7.2).

Why the region is computed and not left to CSS: it is a function of four numbers with
boundaries the platform fixed, it must agree with what a native `<meter>` would show, it
belongs in `aria-valuetext` when the consumer decides it does, and it is the state a function
`className` wants:

```tsx
<Meter.Root value={used} max={quota} low={quota * 0.7} high={quota * 0.9} optimum={0}
  getAriaValueText={(v, { formattedValue, region }) =>
    region === "even-less-good" ? `${formattedValue}, almost full` : formattedValue}
/>
```

---

## 3. Props and types

Shared types come from `packages/ui/src/internal/types.ts`. Every part of a component receives
the **same state object** (`ProgressState` / `MeterState`; the Field precedent, conventions 9.4).

### 3.1 `Progress.Root`

```ts
export interface ProgressState {
  /** The value clamped to `[min, max]`, or `null` while indeterminate. */
  readonly value: number | null;
  readonly min: number;
  readonly max: number;
  /** `(value - min) / (max - min) * 100`, a number 0–100; `null` while indeterminate. */
  readonly percentage: number | null;
  /** The `Intl.NumberFormat` text of the value (or of the fraction, for the percent style): what `Progress.Value` shows. `null` while indeterminate. */
  readonly formattedValue: string | null;
  /** What `aria-valuetext` carries: `getAriaValueText`'s result, else `formattedValue`. */
  readonly valueText: string | null;
  /** `value` is `null`. */
  readonly indeterminate: boolean;
  /** The clamped value has reached `max`. */
  readonly complete: boolean;
}

export interface ProgressRootProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    | "role" | "aria-valuemin" | "aria-valuemax" | "aria-valuenow" | "aria-valuetext"
    | "defaultValue" | "defaultChecked"   // react-dom drops them on a div: a silent no-op that reads like the uncontrolled spelling (review S3)
    | "className" | "style" | "children"
  > {
  /** The current value. Absent or `null`: indeterminate. Clamped to `[min, max]`. */
  value?: number | null;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /**
   * `Intl.NumberFormat` options for `aria-valuetext` and `Progress.Value`. Default `{ style: "percent" }`.
   * A `percent` style formats the fraction of the range; any other style formats the value.
   * Serialisable: a Server Component may pass it.
   */
  format?: Intl.NumberFormatOptions;
  /** BCP 47 tag for `Intl.NumberFormat`; default: the runtime's locale. Pass it when a client tree is server-rendered. */
  locale?: string;
  /**
   * The `aria-valuetext` to render instead of `formattedValue`. Called with the clamped value
   * (`null` while indeterminate) and the state as it would be without this prop. Return `null`
   * to render no `aria-valuetext`. A function: from a Server Component it works when this Root
   * is rendered by that Server Component (the Root runs on the server), not when the Root is
   * rendered by a client component.
   */
  getAriaValueText?: (value: number | null, state: ProgressState) => string | null | undefined;
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ProgressState>;
}
```

Owned keys: `role`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`,
`aria-labelledby` (token-merged: the consumer's tokens first, then `${id}-label`),
`data-indeterminate`, `data-complete`, and the `--progress-value` entry of `style` (merged; a
consumer `style` entry of the same name wins, as Slider's custom properties do). Everything else
passes through (`id`, `aria-label`, `aria-describedby`, `hidden`, `className`, …).

### 3.2 `Progress.Track`, `Progress.Indicator`, `Progress.Label`, `Progress.Value`

```ts
export interface ProgressTrackProps
  extends Omit<ComponentPropsWithRef<"div">, "className" | "style" | "children"> {
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, ProgressState>;
}

export interface ProgressIndicatorProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> { /* the same four */ }

export interface ProgressLabelProps
  extends Omit<ComponentPropsWithRef<"span">, "id" | "className" | "style" | "children"> { /* the same four */ }

export interface ProgressValueProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> {
  className?: StateValue<string | undefined, ProgressState>;
  style?: StateValue<CSSProperties | undefined, ProgressState>;
  /** Default: `state.formattedValue` (nothing while indeterminate). */
  children?: StateValue<ReactNode, ProgressState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, ProgressState>;
}
```

Owned keys: `Track`, `Indicator`: `data-indeterminate`, `data-complete`. `Label`: `id`, the two
`data-*`. `Value`: the two `data-*`; `aria-hidden="true"` is a **default** the consumer's prop
overrides (section 1), not an owned key. None of the parts has a `role`.

### 3.3 `Meter.Root`

```ts
export type MeterRegion = "optimum" | "suboptimum" | "even-less-good";

export interface MeterState {
  /** Clamped to `[min, max]`. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** After HTML's defaults and clamping (2.4). */
  readonly low: number;
  readonly high: number;
  readonly optimum: number;
  /** A number 0–100. */
  readonly percentage: number;
  readonly formattedValue: string;
  readonly valueText: string | null;
  readonly region: MeterRegion;
}

export interface MeterRootProps
  extends Omit<
    ComponentPropsWithRef<"div">,
    | "role" | "aria-valuemin" | "aria-valuemax" | "aria-valuenow" | "aria-valuetext"
    | "defaultValue" | "defaultChecked"   // as on Progress.Root
    | "className" | "style" | "children"
  > {
  /** Required: a meter always has a value. Clamped to `[min, max]`. */
  value: number;
  /** @default 0 */
  min?: number;
  /** @default 100 */
  max?: number;
  /** Upper bound of the "low" part of the range. Default `min`. */
  low?: number;
  /** Lower bound of the "high" part of the range. Default `max`. */
  high?: number;
  /** The best value. Default the midpoint. Decides which part of the range is `optimum`. */
  optimum?: number;
  format?: Intl.NumberFormatOptions;
  locale?: string;
  getAriaValueText?: (value: number, state: MeterState) => string | null | undefined;
  className?: StateValue<string | undefined, MeterState>;
  style?: StateValue<CSSProperties | undefined, MeterState>;
  children?: StateValue<ReactNode, MeterState>;
  render?: RenderProp<ComponentPropsWithRef<"div">, MeterState>;
}
```

Owned keys: as `Progress.Root` (with `aria-valuenow` / `aria-valuetext` always present) plus
`data-region` and the four `--meter-*` entries of `style`; never `data-indeterminate` or
`data-complete`.

### 3.4 `Meter.Track`, `Meter.Indicator`, `Meter.Label`, `Meter.Value`

The Progress shapes with `MeterState`; owned keys `data-region` (plus `id` on `Label`).

### 3.5 Namespaces

```ts
export const Progress = {
  Root: ProgressRoot, Track: ProgressTrack, Indicator: ProgressIndicator, Label: ProgressLabel, Value: ProgressValue,
} as const;
export const Meter = {
  Root: MeterRoot, Track: MeterTrack, Indicator: MeterIndicator, Label: MeterLabel, Value: MeterValue,
} as const;
```

Exports: every `Progress<Part>Props`, `ProgressState`, every `Meter<Part>Props`, `MeterState`,
`MeterRegion`; from `@funstack/ui/progress`, `@funstack/ui/meter` and the root entry.

---

## 4. The async angle: a display of someone else's action

### 4.1 What the component does not have, and why

| Vision item | Progress / Meter | Why |
| --- | --- | --- |
| Action props | none | Nothing is pressed, typed or dragged. A progressbar is not interactive (WAI-ARIA: no keyboard interaction, not focusable). |
| `pending` / `data-pending` | none | `pending` means "an action dispatched through this component is in flight" (conventions 4.1). None can be. The *displayed* action is pending elsewhere, and that is the consumer's `useTransition` / `useFormStatus` / `Toast` state, already exposed where it lives. |
| `useOptimistic` | none | Optimistic state is a guess ahead of a committed value that an action will confirm. A progress value is a fact the consumer reports; there is nothing to be ahead of and nothing to roll back. |
| Controlled / uncontrolled | controlled only, no `defaultValue`, no `valueChangeAction` | The value has one source, the consumer. Conventions 3.5 called this kind "consumer-owned, mirrored" with Progress as the future example; with a `div` there is no DOM property to mirror, so it is simply a prop (see Conventions proposals). |
| Transition types | none | No dispatch, no commit that ends one (5.3). |

### 4.2 The lane rule for the value

This is the one Async React rule the design adds, and it is the consumer's. The library's usual
advice is "wrap your `setState` in `startTransition`" (conventions 2.3 item 4, repeated in every
component's docs). For a progress value the advice is the opposite:

**A value that reports on an in-flight action is written with a plain `setState`, never inside
`startTransition`.** React holds every transition-lane update made while an async action is
pending until that action settles (conventions 2.3 item 5, verified on 19.3.1). A progress
update wrapped in a transition is therefore held by the very action it reports on: the bar sits
at `0%` and jumps to `100%` when the upload finishes. The same reason makes the Toast queue
urgent by design (conventions 2.6). A `setState` **after an `await` inside the action** is
urgent already (it is outside the transition's synchronous scope), so the natural code is the
right code:

```tsx
"use client";
function Uploader({ file }: { file: File }) {
  const [uploaded, setUploaded] = useState<number | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button action={() => start(async () => {
        setUploaded(0);                                            // sync prefix: a transition update, held (see below)
        for await (const sent of upload(file)) setUploaded(sent);  // after an await: urgent, renders at once
      })}>Upload</Button>
      {pending && (
        <Progress.Root value={uploaded} max={file.size} aria-label={`Uploading ${file.name}`}>
          <Progress.Track><Progress.Indicator /></Progress.Track>
        </Progress.Root>
      )}
    </>
  );
}
```

What each line renders in:

- `{pending && …}` mounts the Progress in the **sync** render in which `useTransition` flips
  `isPending` to `true`, so the bar appears immediately, indeterminate until the first chunk.
- `setUploaded(0)` in the synchronous prefix is a transition update and is **held until the
  action settles**; harmless here because the first `setUploaded(sent)` after the first `await`
  is urgent and overtakes it, but a consumer who sets a *meaningful* initial value in the prefix
  (say, a resumed upload's offset) must write it with `startTransition`-free code before calling
  the action, or accept that it lands with the first chunk. The docs say this plainly.
- Every `setUploaded(sent)` after an `await` is urgent and renders before the action ends.
- `Progress.Root` re-renders in whatever lane its parent renders; it has no lane of its own.

The pitfall the docs show next to the pattern, because every other page tells consumers to do
exactly this:

```tsx
for await (const sent of upload(file)) startTransition(() => setUploaded(sent)); // held until the upload ends: 0% … 100%
```

`useOptimistic` is not a workaround either: an optimistic update also lands only while its
transition is pending and reverts when it settles, and the value is not optimistic.

### 4.3 Patterns

| Situation | Shape | Lane |
| --- | --- | --- |
| Busy while an action runs | `{pending && <Progress.Root aria-label="Saving" />}` or `<Progress.Root hidden={!pending} …>` from `useTransition` | mount in the sync `isPending` render |
| Determinate from an action's progress | plain `setState` after each `await` (4.2) | urgent |
| Busy while a form submits | `<Form.Root action={save}>{({ pending }) => (<>…{pending && <Progress.Root aria-label="Saving" />}</>)}</Form.Root>` (`Form.Root`'s `children(state)`), or `useFormStatus` in the consumer's own component | the form channel (conventions 2.7) |
| Progress of a long-running job, server-rendered | `<Progress.Root value={job.done} max={job.total} format={…} />` from a Server Component, refreshed by the router (`router.refresh()`, polling, or a stream) | the router's transition; a refresh that is held by a pending action is the router's concern, not Progress's |
| Progress inside a toast | `toast.promise` reports pending / settled; a determinate bar inside `Toast.Root` reads a value the consumer updates with `toast.update(id, { data })` (the urgent queue) | urgent by design (Toast) |
| Fill animation | CSS `transition` on the registered `--progress-value` (section 7) | compositor; independent of React's lanes |

### 4.4 What the library deliberately does not do

- **No `useFormStatus` inside Progress.** A part with no action of its own *may* expose the form
  channel's pending (conventions 2.7: `Field.Root`, `Form.Submit`), and a `Progress.Root` that
  showed itself while the enclosing form submits is a tempting one-liner. Rejected: it would be
  hidden coupling to a form the consumer may not intend (a Meter in a settings form is not
  "pending" while the form saves), and `Form.Root`'s `children(state)` already gives the
  consumer the flag at the right place.
- **No `pending` prop** ("render as busy when true"). It would be `value={pending ? null : v}`
  with a second name.
- **No `aria-busy` on anything.** The APG's advice is for the *region being loaded* to carry
  `aria-busy="true"` and `aria-describedby` → the progressbar; that region is the consumer's
  (research §3.2). The docs show it.

---

## 5. Accessibility

### 5.1 ARIA

| Element | Attributes |
| --- | --- |
| `Progress.Root` | `role="progressbar"`; `aria-valuemin`, `aria-valuemax` always; `aria-valuenow` (clamped) and `aria-valuetext` (2.2) when a value exists, both omitted while indeterminate (Chromium then exposes no value, research §3.1); `aria-labelledby` → `${id}-label` (merged with the consumer's tokens); the consumer's `aria-label` / `aria-describedby` pass through |
| `Meter.Root` | `role="meter"`; `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` always (research §3.3: Meter support in screen readers is old and uneven, so the text is never left to the AT's own computation); `aria-labelledby` as above |
| `Label` | `id` only; no role |
| `Value` | `aria-hidden="true"` by default; no role |
| `Track`, `Indicator` | nothing; presentational `div` / `span` |

Both roles **require an accessible name** (WAI-ARIA 1.2: name from author required). The name
comes from `Progress.Label` / `Meter.Label` or from `aria-label` / `aria-labelledby` on the Root.
The Root cannot warn about a missing name (a directive-free Root has no registration to know
whether a Label is rendered, section 8); the docs page says it in the first example and the
props table, and the test plan has a CDP row for both naming paths.

`aria-valuetext` on a `progressbar` makes screen readers say the text instead of computing a
percentage from `aria-valuenow`; with the default percent format the two agree, and with a unit
format ("3.2 MB") the text is what the user needs. Both attributes are set, so an AT that
ignores `aria-valuetext` still has a number.

### 5.2 Keyboard and focus

None. Neither role is interactive; the Root renders no `tabindex`. A consumer who wants the bar
reachable by a screen reader's browse mode needs nothing: it is in the tree with its name and
value.

### 5.3 What assistive technology hears

1. The upload of section 1 at 40 %: "Uploading report.pdf, progress bar, 3.2 MB" (NVDA reads
   the name, the role and `aria-valuetext`; the `aria-hidden` Value is not read a second time).
2. Indeterminate: "Loading messages, progress bar, busy" / "indeterminate" (the AT's own word for
   a progressbar with no `aria-valuenow`); with
   `getAriaValueText={(v) => v === null ? "Connecting" : null}`: "…, progress bar, Connecting".
3. The storage meter at 92 % with the recipe of 2.4: "Storage, meter, 4.6 GB, almost full".
4. Updates are **not announced** as they happen: neither role is a live region, and a progress
   that announced every percent would be unusable. A consumer who wants an announcement at the
   end makes the completion a live-region message or a toast (`toast()` from the action's last
   line), which is the FUNSTACK way to report a settled action.

Screen-reader pass (research §3.3): NVDA, JAWS and VoiceOver announce the name and
`aria-valuetext` for both roles; JAWS's historic ignoring of named meters is re-checked with a
current version. A human task, tracked in **#73**.

---

## 6. Labelling, inside and outside a Field

### 6.1 Outside a Field (the normal case)

```tsx
<Progress.Root value={v}>
  <Progress.Label>Uploading</Progress.Label>   {/* span[id]; the Root references it */}
  …
</Progress.Root>

<Progress.Root value={v} aria-label="Uploading" />                  {/* no Label part */}
<Progress.Root value={v} aria-labelledby="heading-id" />           {/* an element elsewhere */}
```

The Root **always** renders `aria-labelledby="<consumer tokens> ${id}-label"`. When no Label is
rendered the last token resolves to nothing; the accessible-name computation skips IDREFs that
match no element and falls through to `aria-label` (accname step 2B requires "at least one
valid IDREF"), the rule `Field.Description` and `Dialog.Description` already rely on for
`aria-describedby`. The alternative, a Label that registers its id with the Root, needs state
in the Root and would make it a client module (section 8); the dangling token is the price of a
Root that is a Server Component, and it is invisible to users (validators flag it, as they flag
Field's). Product-owner item 4.

`Progress.Label` is a `span`: the Root is not labelable, so `<label for>` would associate
nothing and a click on it would focus nothing. Its id is `${id}-label`; a consumer who needs a
`<label>` element for layout reasons passes `render={<label />}` and loses nothing.

Where the Label sits does not matter: inside the Root (the common case; a descendant may name
its ancestor through `aria-labelledby`), or outside it with `aria-labelledby` written by hand.

### 6.2 Inside a `Field.Root`

A Progress or Meter is **not a form control** and does not register with a Field
(`useFieldControl` is not called): it has no `name`, no validity, no `required`, and a Field's
machinery (the validity element, `:user-invalid`, the custom-validity slot, the first-invalid
focus) assumes a control. Two layouts are supported and one is not:

| Layout | Supported | What names what |
| --- | --- | --- |
| A Meter next to the Field's control (password strength under a password field; upload progress under a file input) | yes | `Field.Label` names the control; the Meter has its own `Meter.Label` or `aria-label` ("Password strength"). To make the control *described* by the meter's value, the consumer gives `Meter.Value` an `id` (pass-through) and adds it to the control's `aria-describedby` (token-merged by every control part); an `aria-hidden` element referenced by `aria-describedby` still contributes its text (accname 2A). |
| A Progress for the enclosing form's submission | yes | Its own name ("Saving"); see 4.3 for the form channel |
| A `Field.Root` whose only content is a `Field.Label` and a Meter (a "read-only field": "Storage: [meter]") | **no** (v1) | `Field.Root` warns in development today ("no form control registered"), and `Field.Label` keeps a `for` that targets nothing. Write it as `<Meter.Root><Meter.Label>Storage</Meter.Label>…</Meter.Root>` in a plain `div` with the form's field styling. Registering the Meter as a Field control with `labelable: false` (so `Field.Label` would name it through `aria-labelledby`, as it names a `RadioGroup`) is possible later if a demo wants it; it would need the Field's validity reads to tolerate a registered element that is not a form control. Product-owner item 5. |

---

## 7. Data attributes and CSS

### 7.1 Attributes

| Attribute | Progress parts | Meter parts | Meaning |
| --- | --- | --- | --- |
| `data-indeterminate` | all | | `value` is `null` (2.3) |
| `data-complete` | all | | the clamped value has reached `max` |
| `data-region` | | all | `optimum` / `suboptimum` / `even-less-good` (2.4) |

Booleans by presence (conventions 4.1); "in progress" is `:not([data-indeterminate]):not([data-complete])`.
The attributes are on every part so `.fill[data-complete]` works without an ancestor selector;
`.root[data-complete] .fill` works too. No `data-value` / `data-max`: `aria-valuenow` /
`aria-valuemax` are on the Root for a selector that needs them, and typed `attr()` can read them
once it ships in all engines (research §3.2: not yet).

Platform pseudo-classes: none apply (the parts are generic elements). A consumer who renders a
native `<progress>` through `render` gets `:indeterminate` (section 11).

### 7.2 Custom properties

| Property | On | Value |
| --- | --- | --- |
| `--progress-value` | `Progress.Root` (inherited) | the percentage, `0%` to `100%`; **absent while indeterminate** |
| `--meter-value` | `Meter.Root` (inherited) | the percentage |
| `--meter-low`, `--meter-high`, `--meter-optimum` | `Meter.Root` (inherited) | the clamped boundaries as percentages, for drawing zones |

Only the Root carries them: custom properties inherit, so the Indicator (or any descendant, an
SVG stroke included) reads the Root's value, and a registered `@property` must say
`inherits: true` (the docs recipe does). The library ships no CSS; the `@property` registrations
below are the consumer's, as Slider's are.

### 7.3 Recipes (the docs' `progress.css` / `meter.css`)

```css
/* Linear */
.track { position: relative; block-size: 8px; background: var(--rail); border-radius: 4px; overflow: hidden; }
.fill  { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: var(--progress-value, 0%); background: var(--accent); }

/* Animate value changes: register the property so the variable itself transitions (every engine). */
@property --progress-value { syntax: "<percentage>"; inherits: true; initial-value: 0%; }
[role="progressbar"] { transition: --progress-value 200ms ease-out; }

/* Complete */
.fill[data-complete] { background: var(--success); }

/* Indeterminate: a sliding segment. */
.fill[data-indeterminate] { inset-inline-start: auto; inline-size: 30%; animation: slide 1.2s ease-in-out infinite; }
@keyframes slide { from { translate: -100% 0; } to { translate: 400% 0; } }

/* Circular: the same variable, no SVG. */
.ring { inline-size: 48px; aspect-ratio: 1; border-radius: 50%;
        background: conic-gradient(var(--accent) var(--progress-value), var(--rail) 0);
        mask: radial-gradient(farthest-side, transparent calc(100% - 6px), black calc(100% - 6px)); }
/* Indeterminate ring: a fixed arc in its own rule. A registered property with an initial-value is
   never guaranteed-invalid, so a `var(--progress-value, 25%)` fallback would never be used and the
   ring would draw 0% (review S1). */
.ring[data-indeterminate] { background: conic-gradient(var(--accent) 25%, var(--rail) 0); animation: spin 1s linear infinite; }
@keyframes spin { to { rotate: 1turn; } }

/* Meter zones from the boundaries, fill coloured by region. */
.meter-track { position: relative; block-size: 8px; border-radius: 4px; overflow: hidden;
  background: linear-gradient(to right, var(--zone-low) var(--meter-low), var(--zone-mid) var(--meter-low) var(--meter-high), var(--zone-high) var(--meter-high)); }
.meter-fill { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: var(--meter-value); }
.meter-fill[data-region="optimum"] { background: var(--success); }
.meter-fill[data-region="suboptimum"] { background: var(--warning); }
.meter-fill[data-region="even-less-good"] { background: var(--danger); }

@media (prefers-reduced-motion: reduce) {
  [role="progressbar"] { transition: none; }
  .fill[data-indeterminate] { animation: none; inset-inline-start: 0; inline-size: 100%; opacity: .5; }
}
```

Logical insets make the same CSS mirror under `dir="rtl"`, and `writing-mode: vertical-lr` on
the Track gives a vertical bar with the same rules (the research probed the native elements for
both; the div anatomy inherits the behaviour from the consumer's CSS).

Why a CSS transition and not the native fill: Firefox does not transition
`::-moz-progress-bar`'s size (research §3.1, a human-reported issue candidate), while an inline
custom property changes on every render and transitions everywhere once registered.

### 7.4 Reduced motion

The library ships no animation; the recipes above carry the `prefers-reduced-motion` block
(conventions 5.4), including a static indeterminate rendering (a half-opacity full bar) so the
"busy" state is still visible without motion.

---

## 8. Server Components, directives, and before hydration

### 8.1 Files and directives

```
src/progress/
  index.ts                 # no directive: namespace, type re-exports
  progress-context.ts      # "use client": createContext<ProgressContextValue>, use()
  progress-root.tsx        # NO directive: useId, arithmetic, Intl; renders <ProgressContext value={…}>
  progress-track.tsx       # "use client": reads the context
  progress-indicator.tsx   # "use client"
  progress-label.tsx       # "use client"
  progress-value.tsx       # "use client"
  progress.test.tsx, progress.browser.test.tsx
src/meter/
  index.ts, meter-context.ts ("use client"), meter-root.tsx (NO directive), meter-track.tsx,
  meter-indicator.tsx, meter-label.tsx, meter-value.tsx ("use client"),
  meter-region.ts          # no directive: meterRegion(), the clamping of 2.4
  meter.test.tsx, meter.browser.test.tsx
src/internal/
  range-value.ts           # no directive: clamp, isDegenerate, fraction, percentage, getNumberFormat (the cache) and formatRangeValue (2.1, 2.2)
  render-element.ts        # no directive: the pure half of use-render: resolveStateValue, rendersButton, mergeRenderRef, renderElement (14.1)
  dev-warn.ts              # no directive: warnOnce(key, message) with console.error in development; resetWarnOnce() for tests
```

As built (6fef197): `use-render.tsx` keeps its `"use client"` and re-exports `resolveStateValue`,
`rendersButton` and `DataAttributes` from `render-element.ts`, so no other part changed;
`useRender` memoises the ref merge and calls `renderElement`. `progress.types.test.tsx` holds
the type rows. The directive lists in `src/__tests__/directives.test.ts` name every file above.

**`Progress.Root` and `Meter.Root` are directive-free.** Everything they do is allowed in a
Server Component: `useId` (in React's `react-server` build), arithmetic, `Intl.NumberFormat`,
resolving `render` / `className` / `style` / `children` against the state (a pure function), and
rendering `<ProgressContext value={state}>` imported from the `"use client"` context module,
which is conventions 7.1's second exception ("a directive-free file *rendering* a context
provider imported from a client module … because Server Components may render client-created
contexts"), stated there as allowed and **used here for the first time**. The provider's `value`
is the state object, plain serialisable data, plus the id. The server `useId` has one host
requirement, #94: separately rendered Flight payloads restart the counter, so two Roots in
different payloads get the same id and the label link breaks unless the host sets a distinct
`identifierPrefix` per payload. FUNSTACK Static's `defer()` does from 1.3.4
(uhyo/funstack-static#198; re-verified, `docs/research/zero-js-variants.md` "#94 re-check"), so
the requirement is `@funstack/static >= 1.3.4`; other multi-payload hosts must do the same.

The four parts read the context with `use(ProgressContext)` and therefore are client modules
(a Server Component cannot read a client context, conventions 7.3). This is the same split the
Accordion has for a different reason, and the same consequence: a Server Component may render
every part.

What a Server Component gets from the split:

| Rendered from a Server Component | Where it runs | Consequence |
| --- | --- | --- |
| `Progress.Root` (props, `getAriaValueText`, `children(state)`, `render`) | the server, once (RSC) | Function props are allowed (server → server, no serialisation); `Intl` formats in the server's locale with no hydration mismatch, because the Root is not re-run on the client; the arithmetic and formatting code is not in the client bundle |
| `<ProgressContext value>` | the client, as a provider around server-rendered children | the context module is in the client bundle (small); the id and state cross the boundary as data |
| `Track`, `Indicator`, `Label`, `Value` | the client (hydrated) | the parts' code is only loaded where they are used (whether unused part modules reach the browser depends on how the RSC bundler emits the client references reachable from the namespace object; not verified, review N4) |

**Function props from a Server Component reach the Root only** (developer finding, 6fef197).
The parts are client components, so `<Meter.Value>{(state) => …}</Meter.Value>` rendered by a
Server Component fails with React's "Functions cannot be passed directly to Client Components";
the rule holds for `children`, `className`, `style` and `render` functions on every part. Format
part content in the Root's `children(state)` instead, which runs on the server with the Root
(`MeterStorage.tsx` does; section 13). The `@funstack/static` docs build **still exits 0** on
that error and emits a nearly empty page, with the message only in the build log: **#72** asks
for a guard. The design's first section 13 wrote the MeterStorage row with
`Meter.Value children(state)`; corrected below.

Rendered from a **client** component, the Root is an ordinary component (a directive-free module
bundled with its importer): nothing changes at the call site, and `getAriaValueText` is a plain
function prop. Under SSR of that client tree the Root runs on both sides, which is where the
`locale` prop matters (2.2).

**Verification.** The pattern (a server module rendering a client-created context's provider) is
the one thing in this design that no existing component exercised. **Confirmed with
`@funstack/static`** (6fef197): the docs build prerenders the ARIA values from the Server
Component examples (`ProgressJobs.tsx`, `MeterStorage.tsx`) and the pages hydrate without console
errors (checked with a Playwright script against a static server). The **Next.js** scratch-app
check (a different client-reference proxy) was not done and is tracked in **#73**. If a framework
rejects the element, the fallback is one line: `"use client"` at the top of `progress-root.tsx`,
which keeps everything in this document except the "runs on the server once" row.

**Development warnings** (degenerate range, non-finite value, a part outside its Root) use a
directive-free `warnOnce` (a module-level `Set` and `console.error`), not `useDevWarning`,
which is an effect.

### 8.2 Before hydration

There is no behaviour, so there is nothing to wait for: the server HTML carries the role, the
values, the text, the data attributes and the custom property, and the consumer's CSS draws the
bar and runs the indeterminate animation from the first paint. The **JS-free Progress** is the
whole anatomy from a Server Component (section 8.1), not a reduced variant; it is the first
component for which "JS-free" (conventions 7.3) and "a Server Component" coincide at the Root,
which is what `docs/vision.md` principle 5 asks for ("a primitive that needs no JS can even be a
Server Component").

---

## 9. ViewTransition

No part has a `transition` prop and none renders a `<ViewTransition>`. Three reasons, each
sufficient:

- The value changes in the **consumer's** lane, usually urgently (4.2); an urgent commit never
  starts a view transition (conventions 5.1, the Toast category), so a boundary would animate
  nothing in the common case.
- Where the value does change in a transition (a router refresh of a server-rendered job
  page), a document view transition per update would freeze the page at the update cadence
  (research §3.2, `docs/research/view-transition-mount-cost.md`); the fill's own CSS transition
  on the registered property (7.3) is the right animation and runs in every lane.
- The common mount is `{pending && <Progress.Root />}`; a boundary there would pay the page
  cross-fade on every appearance (conventions 5.1).

No transition types either (nothing is dispatched, 5.3). A consumer who wants a view transition
when a completed bar is replaced by a result wraps the **swap** in their own `<ViewTransition>`
around the conditional, which is the Suspense-page pattern already in the docs.

---

## 10. Suspense

Nothing in the anatomy suspends and no part reads a promise. Consumers own boundaries
(conventions 6). Two notes for the docs:

- A `Progress.Root` rendered **as a Suspense fallback** (`<Suspense fallback={<Progress.Root aria-label="Loading" />}>`)
  is the indeterminate case and works before hydration (streamed HTML shows it until the
  boundary resolves).
- A Progress rendered **inside** content that suspends is replaced with the rest of that content
  by the boundary above; it has no special standing.

---

## 11. Not in v1

- **Circular parts** (`Progress.Circle`, Ark UI): `conic-gradient` from the same variable (7.3);
  SVG through `render`. Revisit if a demo cannot be done in CSS.
- **`Progress.View` / multi-step views**, `Progress.Range` as a second name for `Indicator`.
- **Field registration** (6.2, product-owner item 5).
- **A `valueLabel` string prop** (React Aria): `getAriaValueText` and `Progress.Value children`
  cover it, and a serialisable override is `format` + `locale`; a bare string prop would be a
  second spelling of `aria-valuetext`, which is owned.
- **`data-value` / `data-max`** (Radix): the ARIA attributes carry them; typed `attr()` when it
  reaches all engines.
- **`aria-busy` on a region** the Progress describes: consumer markup (4.4), shown in the docs.
- **A native rendering mode** (`<progress>` through `render={<progress />}`): a consumer may do
  it, and the Root then renders `role="progressbar"` and ARIA values on a native element that
  already has them (ARIA in HTML allows `aria-valuetext` on `<progress>`, discourages
  `aria-valuemax`); it is neither documented nor warned about in v1. If the product owner wants
  the "native where viable" wording of #68 honoured with a supported variant, it is a `Progress.Root`
  option that renders `<progress value max>` and no parts (research §3.3) — product-owner item 6.
- **Exit animation** of a bar that unmounts on completion (`useExitAnimation`): the consumer's
  conditional, their boundary (section 9).
- **Localisation of the region** words: the consumer's `getAriaValueText` (2.4).
- **`aria-valuetext` while indeterminate by default**: none (2.2).

---

## 12. Test plan

`packages/ui/src/progress/progress.test.tsx`, `packages/ui/src/meter/meter.test.tsx` (jsdom),
`progress.browser.test.tsx`, `meter.browser.test.tsx` (Chromium, Firefox, WebKit), and unit
tests next to the pure modules (`range-value.test.ts`, `meter-region.test.ts`). Top-of-file
comment (conventions 10.1): "Progress / Meter: no action props and no library-owned state; the
sync / async / rejection / overlap / superseded-rejection / suspending-content / controlled-parity /
post-await / platform-path / urgent-action rows are N/A." The design replaces them with the rows
marked ★.

### 12.1 jsdom

| Area | Tests |
| --- | --- |
| Roles and ARIA | The section 1 HTML for both components: `role`, `aria-valuemin` / `max` / `now` / `text`, `aria-labelledby` = consumer tokens + `${id}-label` (present without a Label too), `Label`'s `id` matches, `Value` has `aria-hidden="true"` by default and not with `aria-hidden={false}`; `aria-valuenow` / `aria-valuetext` absent while indeterminate, `aria-valuemin` / `max` still present; a consumer `role` / `aria-valuenow` / `aria-valuetext` prop or `render` element does not land (owned keys). |
| Arithmetic (unit) | `clamp` (150 of 100 → 100; −5 → `min`), percentage (0, 50, 100, fractional), degenerate range (`max <= min`: warning, `0`, not complete), non-finite (warning; Progress → indeterminate, Meter → `min`), `complete` at exactly `max` and above, not below. |
| Text | Default `{ style: "percent" }` of the fraction (`40` of `100` → "40%", `2` of `8` → "25%"); a percent `format` with `maximumFractionDigits` formats the fraction; a unit `format` formats the value ("3.2 MB"); `locale="de"` ("40 %"); `getAriaValueText(value, state)` receives the clamped value and a state whose `valueText` is the default, its result lands in `aria-valuetext` and `state.valueText` while `Progress.Value` still shows `formattedValue`; returning `null` omits the attribute; while indeterminate it is called with `null` and can set a text; the `NumberFormat` cache returns the same instance for equal inputs (unit). |
| Regions (unit) ★ | Every row of the 2.4 table at and beside each boundary (`value` equal to `low` / `high` in each of the three cases), the defaults (`low` = `min`, `high` = `max`, `optimum` = midpoint → `optimum` for any value in range), the clamping order (`high < low` → `high = low`; `optimum` outside the range), and `low <= optimum <= high` never yielding `even-less-good`. |
| Data attributes | `data-indeterminate` / `data-complete` on all five Progress parts and `data-region` on all five Meter parts, agreeing with the state passed to each part's function props; never the other component's attributes. |
| Custom properties | `--progress-value: 40%` on the Root's `style`, absent while indeterminate; `--meter-value` / `-low` / `-high` / `-optimum` with the clamped values; a consumer `style={{ "--progress-value": "1%" }}` wins (per-property merge); the Indicator renders no inline size. |
| Function props / `render` | Every part: `className` / `style` / `children` functions receive the documented state; `render` element form merges `className` / `style` and forwards `ref`; function form receives `(props, state)`; `Value` default children and `children(state)`; `Label` as `render={<label />}` keeps the `id`. |
| Lanes ★ | A parent runs `startTransition(async () => { setValue(50); await deferred.promise; setValue(80); })` through `useTransition`'s `start` (no `Button` exists in the library; the same React rule is exercised, review N6): before resolve `aria-valuenow` is `"80"` (the post-await write is urgent) while the sync-prefix `setValue(50)` was **held** (never observable as `aria-valuenow`), and the Progress is mounted from `{pending && …}` in the same tick as the click; the counter-example `startTransition(() => setValue(80))` after the await leaves `aria-valuenow` unchanged until the deferred resolves (guards the documented pitfall of 4.2, so the docs claim stays true across React versions). Each step runs inside `await act(async …)`. |
| Dev warnings | Degenerate range, non-finite value, a part outside its Root (throws), **no** warning for a missing name (documented limitation); each once per element / key. |
| Server render ★ | `renderToString` of both anatomies equals the client's markup attribute for attribute (a pure function of props); the HTML contains `--progress-value`, `aria-valuetext` and the data attributes before any script; `renderToString` with `locale` fixed produces the same string on both sides. |
| Directive | `progress-root.tsx`, `meter-root.tsx`, `meter-region.ts`, `internal/range-value.ts`, `internal/render-element.ts`, `internal/dev-warn.ts` and both `index.ts` start **without** `"use client"`; every other file under `src/progress/` and `src/meter/` starts with it (the directive script over `dist`). Also: the Root modules import nothing from a `"use client"` module except the context (`directives.test.ts` walks the Roots' runtime imports over the sources, ignoring `import type` / `export type`, and asserts the context is the only client module reached, so a refactor cannot quietly pull `useRender` into the Root). |
| Types | `value` optional on `Progress.Root`, required on `Meter.Root`; `transition`, `defaultValue`, `valueChangeAction` are not props (type test); `MeterRegion` exported; `getAriaValueText`'s state parameter is `ProgressState` / `MeterState`. |

### 12.2 Browser mode

| Row | Assertion | Engine branches |
| --- | --- | --- |
| Accessibility tree (Chromium, CDP) | `role` progressbar / meter; `valuemin` / `valuemax` / `valuenow`; **no** `valuenow` while indeterminate; the **name** from `Progress.Label` through `aria-labelledby`, and, with no Label and an `aria-label`, the name is the `aria-label` although a dangling `aria-labelledby` token is present (the load-bearing accname assumption of 6.1); a consumer `aria-labelledby` token plus the Label both contribute, in order. **`valuetext` cannot be read from CDP**: `Accessibility.getFullAXTree` reports `valuetext: ""` for `aria-valuetext` on every role (progressbar, meter, slider, native `<progress>`; only `input type=range` reports its own value), so `aria-valuetext` is asserted on the attribute (`memo/developer/cross-engine.md`). Shared helper `src/__tests__/ax-tree.ts`. | `browserName === "chromium"`; others assert the attributes |
| Native meter oracle ★ | For each row of the 2.4 table: a native `<meter>` with the same `min` / `max` / `low` / `high` / `optimum` / `value` agrees with `meterRegion()`. **Firefox**: `meter.matches(":-moz-meter-optimum" \| ":-moz-meter-sub-optimum" \| ":-moz-meter-sub-sub-optimum")`, compared with **Gecko's** operators (`geckoRegion` in the test: boundaries fall in `suboptimum`, 2.4) while the library's region is asserted as designed. **Chromium**: `getComputedStyle(meter, "::-webkit-meter-*-value")` reports the same width for all three pseudo-elements (useless as an oracle), so the row styles the three value pseudo-elements with distinct colours under `appearance: none`, screenshots the native meter and reads one pixel. | `browserName` branches; **WebKit**: attributes only (no oracle exposed to script; the screenshot oracle could be tried later, since WebKit has the same pseudo-elements), the row asserts the library's region and records the gap |
| Fill transition | With the 7.3 CSS, changing `value` fires exactly one `transitionstart` for `--progress-value` on the Root (registered property) and the Indicator's `inline-size` animates (its box width between the two values mid-transition: the row waits 300 ms into a 1 s linear transition and asserts a wide band); with `prefers-reduced-motion: reduce` emulated through the custom `emulateReducedMotion` browser command (Playwright `page.emulateMedia`, registered in `vitest.config.ts`; `withReducedMotion()` in `src/__tests__/browser-commands.ts` restores it in `finally`; each Vitest session has its own page, so the emulation does not leak into concurrent files), no `transitionstart`. | none expected; `@property` is in all three engines (research table) |
| Indeterminate animation | `[data-indeterminate]` has a running animation (`getAnimations()` on the Indicator non-empty), none after `value` becomes a number; the reduced-motion rendering has none. | none |
| No `startViewTransition` | Spy before mounting from `{pending && …}` in a transition, before a value change in a transition, before unmount: zero calls (no boundary exists). | none |
| RTL and vertical | Under `dir="rtl"` the Indicator's box starts at the inline end; with `writing-mode: vertical-lr` on the Track the fill grows along the block axis (the recipe's logical insets). | none |

---

## 13. Docs pages

Two pages, both Server Components in `packages/docs/src/pages/`, listed in `navigation.ts` after
Field & Form and routed in `App.tsx`:

**`/components/progress` — `ProgressPage.tsx`.** Intro (output-only; the display of someone
else's action; works with no JS). Examples (`src/examples/`, each shown with its source):

| Example | Directive | Shows |
| --- | --- | --- |
| `ProgressUpload.tsx` | `"use client"` | A fake upload action (`fake-api.ts`) driven by `useTransition`: indeterminate until the size is known, then determinate, `Progress.Value` with a unit `format`, `data-complete` styling, the **lane callout** (plain `setState` after each `await`; the `startTransition` pitfall shown as a non-example). The click handler resets `size` / `sent` **urgently before** starting the action (review S2: otherwise a second upload shows the previous run's complete bar for the 600 ms before the first chunk, the sync-prefix rule of 4.2 in action). |
| `ProgressForm.tsx` | `"use client"` | An indeterminate bar while a `Form.Root` submits, from `Form.Root`'s `children(state)`; the `aria-busy` / `aria-describedby` region recipe around the content being replaced. |
| `ProgressJobs.tsx` | **none (Server Component)** | A list of server-side jobs rendered from "server data" with `format`, `locale` and a `getAriaValueText` function passed from the Server Component, plus a `Progress.Root aria-label` spinner with no parts (the indeterminate ring, a fixed arc, review S1). The page says this file has no `"use client"` and that the Root ran on the server; this example is the RSC proof of 8.1. |
| `progress.css` | | The 7.3 recipes: linear, circular, indeterminate, complete, reduced motion. |

Then: props tables (Root, Track, Indicator, Label, Value), the `ProgressState` table, data
attributes, custom properties, the `format` rule (percent → fraction, else value), labelling
(Label / `aria-label`; the dangling token note), inside a Field (6.2), "What AT hears", "Server
Components" (which files are client modules; `locale` under SSR), "Not in v1", and the
reduced-motion block.

**`/components/meter` — `MeterPage.tsx`.** Shorter, linking to Progress for the shared parts.

| Example | Directive | Shows |
| --- | --- | --- |
| `MeterStorage.tsx` | **none (Server Component)** | Storage quota with `low` / `high` / `optimum={0}` (lower is better), zones from `--meter-low` / `--meter-high`, the fill coloured by `data-region`, the visible text ("4.6 GB of 5 GB") formatted in the **Root's `children(state)`** and passed to `Meter.Value` as a string (a `Meter.Value children` function cannot be passed from a Server Component, 8.1; the first draft of this row said otherwise), `getAriaValueText` naming the region ("almost full"). |
| `MeterStrength.tsx` | `"use client"` | A password-strength meter under a `Field.Control` inside a `Field.Root` (the supported sibling layout of 6.2): `optimum={max}` (higher is better), the control's `aria-describedby` → `Meter.Value id`, the meter's own `Meter.Label`. |
| `meter.css` | | The zone and region recipes. |

Then: props tables, `MeterState`, the region table of 2.4 with the defaults and clamping (and
the Firefox boundary note), data attributes, custom properties, the AT note from research §3.3
(support is uneven; always a name and a text: `aria-valuemin` / `max` / `now` always,
`aria-valuetext` unless `getAriaValueText` returns `null`, review N1), the `max <= min` warning
and the non-finite boundaries (N3), and the "format part content in the Root's `children(state)`"
sentence next to the Server Component example (N2).

Also: `RoadmapPage` / changelog entry; the Server Components concept page gains Progress and
Meter as the first components whose Root is itself a Server Component (a row in its table next
to the JS-free Accordion); `packages/ui/src/index.ts` and `tsdown.config.ts` gain the two
entries; the playground (`packages/example/src/progress-meter-demo.tsx`) has a demo of both.

---

## 14. Implementation notes

1. **The directive-free Root and `useRender`.** `internal/use-render.tsx` is `"use client"` for
   one `useMemo` (the merged callback ref's identity). A Root with no library ref does not need
   it. **Taken (6fef197): the split.** `internal/render-element.ts` (directive-free) holds
   `resolveStateValue`, `rendersButton`, `renderElement(options)` taking an already-merged `ref`,
   and `mergeRenderRef(consumerRef, render)`, which merges the consumer's and a `render`
   element's ref unmemoised only when both exist (`mergeRefs` from `merge-props.ts`, which is
   directive-free) and passes a single ref through untouched; a fresh identity per render is
   correct because every merged callback returns a cleanup (it re-attaches, harmless for a node
   with no library ref). `useRender` memoises the merge and calls `renderElement`; it keeps its
   directive and re-exports, so no other part changed. The conventions (f3ab2e4, 7.1) also
   allow the alternative, dropping the directive from `use-render.tsx` on the strength of
   React's `react-server` export list; it was not needed. The Roots pass `ref` into
   `mergeRenderRef` during render, which oxlint's `react/refs` rule flags; both call sites carry
   `// oxlint-disable-next-line react/refs` with the reason (the value is only forwarded to the
   element, never read). Either way the Root must not import from any other `"use client"`
   module than its context (the import-graph test row).
2. **The context provider from the Root.** `<ProgressContext value={{ id, state }}>` with the
   React 19 provider syntax; never `ProgressContext.Provider` (a property access on a client
   reference is not portable across frameworks' proxies). The value is a fresh object per render;
   the parts are cheap and re-render with the Root anyway, so no memoisation (and `useMemo` in
   the Root would raise the directive question again).
3. **`warnOnce`** (`internal/dev-warn.ts`): `isDev && !seen.has(key)` → `console.error`; keys
   include the part name, the condition and the values, not the element (a Server Component has
   no element identity); called during render, so a discarded render may warn. `resetWarnOnce()`
   exists for tests. Existing client parts keep `useDevWarning`.
4. **Formatting cache**: `Map<string, Intl.NumberFormat>` keyed by `locale ?? ""` +
   `JSON.stringify(format ?? PERCENT)`, capped (drop the oldest past 32 entries); the fraction
   rule reads `format.style` (`undefined` means `"percent"` only when `format` is absent; a
   `format` without `style` is `"decimal"` per `Intl` and formats the value).
5. **Attribute values**: `aria-valuenow` renders the clamped number as React stringifies it
   (`String(n)`), not rounded; `--progress-value` is `${percentage}%` with the full float
   (CSS does not care), so `scale` and `inline-size` consumers get the exact fraction.
6. **Owned-key merge** as everywhere (`mergeProps(partProps, elementProps, controlled)`): the
   custom properties go into the part's `style` *before* the consumer's resolved `style` so the
   consumer wins per property (Slider's rule); `aria-labelledby` through the token-merge path.
7. **Tests for the lane row** use the existing `deferred()` helper and `useTransition`'s `start`
   from a plain button (there is no `Button` in the library; the React rule is the same, review
   N6); the assertion between dispatch and resolve runs inside `await act(async …)` (the Slider
   review's L4 rule for anything that may suspend or settle later).

---

## Conventions proposals (applied to `design/conventions.md` 2026-10-18, f3ab2e4)

All nine items below were applied by the wave's conventions owner (resolved question 32); the
list is kept as the record of what changed and why. For item 6(a) the conventions chose to relax
the 7.1 hook list to React's `react-server` exports; the implementation still took the
`render-element.ts` split (14.1), which the relaxed rule also allows.

1. **1.1 part vocabulary.** Widen `Track` ("the rail of a Progress / Meter; no interaction"),
   `Indicator` ("the fill of a Progress / Meter, sized by the consumer's CSS from the Root's
   `--progress-value` / `--meter-value`"), `Label` ("for an output role that is not labelable
   (Progress, Meter) it renders `span[id]` and the Root references the id through
   `aria-labelledby` unconditionally"), `Value` ("Progress / Meter: a `span`, `aria-hidden` by
   default, showing `formattedValue`").
2. **3.5 "consumer-owned, mirrored".** The row names "a future Progress `value`" as a mirrored
   prop. With a `div` there is no DOM property to mirror: Progress's `value` is a plain prop
   rendered as attributes. Drop Progress from the examples (Checkbox `indeterminate` and Dialog
   `returnValue` remain).
3. **4.1 vocabulary.** Add `complete` (Progress, every part: the clamped value reached `max`)
   and `region` (Meter, every part, enum `optimum` / `suboptimum` / `even-less-good`, the
   platform's words); widen `indeterminate` with "Progress (every part): `value` is `null`;
   derived, not a DOM property, never suspended".
4. **5.1 no-`transition` categories.** Progress and Meter join Slider / Select / Toast / Field:
   "a part that displays a consumer-owned value with no library state or dispatch, whose
   changes arrive in the consumer's lane (usually urgent, 2.6) and animate through a CSS
   transition on a registered custom property". 5.3: `Progress`, `Meter`: none.
5. **2.6 / 2.3 item 5, the consumer's side.** Add one sentence after the Toast paragraph: "The
   same rule holds for **consumer state that reports on a pending action** (a progress value): it
   is written with a plain `setState`, which after an `await` inside the action is urgent
   anyway; wrapping it in `startTransition` holds it until the action settles. Component docs
   that display such a value (Progress) say so." It is the one place the library's "wrap it in
   `startTransition`" advice inverts, and it belongs in the conventions so the next output-only
   component inherits it.
6. **7.1 directives.** Two facts to record: (a) React 19.3.1's `react-server` build exports
   `use`, `useId`, `useCallback`, `useMemo`, `useDebugValue`, `cache`, `cacheSignal`
   (`react.react-server.js`), so the rule "hooks other than `use` / `useId`" is stricter than
   React; the architect may relax it to that list (which would let `use-render.tsx` lose its
   directive) or keep it and accept the `render-element.ts` split (implementation note 14.1).
   (b) The second exception (a directive-free file rendering a client-created context provider)
   is now **used** by `Progress.Root` / `Meter.Root`; the sentence "No initial component needs
   the second exception; a component that does says so in its design doc" gets its first
   reference. Also in 7.3: Progress / Meter are the first components whose Root is itself a
   Server Component, next to the JS-free Accordion whose parts are all client modules.
7. **9.4 public types.** `ProgressState` / `MeterState` shared by every part (the `FieldState`
   rule); `MeterRegion` exported.
8. **10.1 test rows.** Add "**Lanes (consumer)**: for a component that displays a value a
   pending action reports, a post-`await` urgent write renders before the action settles and a
   `startTransition`-wrapped one does not" (Progress), and "**Server render**: for a
   directive-free Root, `renderToString` equals the client markup and the Root module's import
   graph reaches no `"use client"` module but its context". The Directive row already covers
   "exactly as the design doc records"; note that a design may record a **directive-free** Root.
9. **11 built-in strings.** Progress and Meter add **no** string: the default `aria-valuetext`
   is `Intl.NumberFormat`'s localised output (a platform string, like Field's
   `validationMessage`), there is no default text while indeterminate, and the override is
   `getAriaValueText(value, state)` (function of state) with `format` / `locale` as the
   serialisable path. Record it next to the Field line.

---

## For the product owner

Genuine product decisions, with recommendations; none blocks implementation.

1. **`value` optional on `Progress.Root`, `null` by default, meaning indeterminate** (2.3), so a
   spinner is `<Progress.Root aria-label="Loading" />`; the alternative is a required
   `value: number | null` (an omitted value is a type error, nothing is ever indeterminate by
   accident). **Recommendation: optional with `null` default**: it is what native `<progress>`
   does without `value`, and what Base UI does; `undefined` cannot mean "uncontrolled" here
   because nothing is controllable.
2. **`max` defaults to 100** on both Roots (3.1, 3.3), not the platform's 1. Every prior-art
   library uses 100, and a consumer porting `value={40}` from any of them would otherwise see a
   full bar. **Recommendation: 100**, with the platform's default noted in the docs.
3. **The Root is directive-free and renders the client context provider itself** (section 8),
   the first use of conventions 7.1's second exception; the alternative is `"use client"` on the
   Root like every other component (loses "runs once on the server", function props from a
   Server Component, and the locale guarantee). **Recommendation: directive-free**, with the
   docs site's Server Component example as the proof and the one-line fallback recorded.
4. **`aria-labelledby` always references the Label id, dangling when no Label is rendered**
   (6.1). The alternative, a registering Label, requires state in the Root and therefore
   `"use client"` (item 3). **Recommendation: always-referenced**, the `Field.Description`
   precedent, with the CDP row that proves `aria-label` still names the bar.
5. **No Field registration in v1** (6.2): a Progress or Meter inside a Field is a sibling of the
   control with its own name; a Field whose only content is a Meter keeps today's "no form
   control registered" warning. Alternative: register with `labelable: false` so `Field.Label`
   names it. **Recommendation: none in v1**; revisit if a settings-form demo wants the read-only
   field layout.
6. **No supported native `<progress>` / `<meter>` variant** (section 11), honouring the
   research's verdict over the "where viable" wording of #68; a consumer may still
   `render={<progress />}`. **Recommendation: none in v1.**
7. **No English `aria-valuetext` while indeterminate** (2.2; Base UI says "indeterminate
   progress"). Conventions 11 allows an English default only for an accessibility gap, and
   screen readers already announce an unvalued progressbar as busy. **Recommendation: none**;
   `getAriaValueText` covers consumers who want words.
8. **`getAriaValueText(value, state)`** rather than Slider's `(value, index)` or Base UI's
   `(formattedValue, value)` (2.2): Meter's region and the default text are in `state`.
   **Recommendation: as designed** (the Combobox `announce(count, state)` shape).
9. **`Progress.Value` is `aria-hidden` by default** (section 1), overridable by the consumer's
   `aria-hidden={false}`. **Recommendation: as designed** (the text is already in
   `aria-valuetext`).
10. **No `transition` prop on any part, no transition types, no `useFormStatus` coupling, no
    `pending` prop** (sections 4.4, 9). **Recommendation: as designed.**
11. **Two docs pages** (Progress, Meter) and two subpaths (`@funstack/ui/progress`,
    `@funstack/ui/meter`) rather than one "Progress & Meter" page / namespace (section 13).
    **Recommendation: two**; Field & Form share a page because they are used together, Progress
    and Meter are not.
12. **Conventions proposals 1 to 9** to hand to the conventions owner on acceptance.

**Accepted by the product owner (2026-10-18):** recommendations 1-12 are accepted as written.
- Item 2, `max` defaults to 100: accepted.
- Item 3, a directive-free Root that renders the client context provider: accepted as the pattern for future presentational components.
- Item 12, the conventions proposals: they go to the wave's conventions owner (the ToggleGroup/Toolbar architect).

---

## Review corrections (#68, 2026-10-18)

The review (`memo/reviewer/progress-meter.md`, of 6fef197; verdict: acceptable with minor fixes)
found the library code matching the design: ARIA semantics, owned keys, the directive-free Root
with the client context provider, the lane rule, the region algorithm and the formatting. Its
fixes landed in ab22773 and are folded into the sections above. Nothing was must-fix.

| Item | Change | Sections |
| --- | --- | --- |
| S1 | The docs' indeterminate ring was invisible: a registered property with an `initial-value` is never guaranteed-invalid, so a `var(--progress-value, 25%)` fallback was never used and the `conic-gradient` drew 0 %. The ring now draws a fixed arc in its own `[data-indeterminate]` rule; the 7.3 recipe says why. | 7.3, 13 |
| S2 | `ProgressUpload` showed the previous run's complete bar for the 600 ms before a second upload's first chunk: `size` / `sent` are now reset urgently in the click handler before the action starts, which is the sync-prefix rule of 4.2 demonstrated instead of tripped over. | 4.2, 13 |
| S3 | `defaultValue` type-checked on both Roots and was a silent no-op (react-dom drops it on a `div`, so `<Progress.Root defaultValue={40} />`, the spelling every value component teaches, rendered an indeterminate bar with no warning). `defaultValue` and `defaultChecked` are omitted from both props types; the type test asserts it with `@ts-expect-error`. | 3.1, 3.3 |
| N1–N3 | Meter page wording: `aria-valuetext` is absent when `getAriaValueText` returns `null`; the Server Component example formats part content in the Root's `children(state)`; the `max <= min` warning and the non-finite boundaries are documented. | 13 |
| N4 | "A Root with no parts ships only the context module" was unverified (it depends on how the RSC bundler emits client references reachable from the namespace object); softened to "the parts' code is only loaded where they are used". | 8.1 |
| N5 | `emulateReducedMotion` moved above `selectBrowsers`'s doc comment in `vitest.config.ts`. | 12.2 |
| N6 | The lane row uses `useTransition`'s `start` from a plain button; the design said "a `Button` with an `action`", which does not exist. Wording fixed. | 12.1, 14.7 |
| N7 | A degenerate range clamps `aria-valuenow` to `min`, which can exceed `aria-valuemax` when `min > max`; accepted (the call site already warns) and documented. | 2.1 |

Developer deviations (`memo/developer/progress-meter.md`) and the review's verdicts:

| Deviation | Verdict | Sections |
| --- | --- | --- |
| `use-render` split into `internal/render-element.ts` (`mergeRenderRef` unmemoised) | Acceptable, the design's preferred option | 8.1, 14.1 |
| A Server Component may pass function props to the Root only; a function on a part fails with "Functions cannot be passed directly to Client Components" and the docs build still exits 0 | Acceptable, inherent (the parts are client modules); the design's MeterStorage row was wrong and is corrected; the silent build is #72 | 8.1, 13 |
| Firefox `<meter>` puts a value exactly at `low` / `high` in `suboptimum` where Chromium says `optimum` | Acceptable: HTML leaves the boundaries to the implementation; the library follows Chromium as designed, the Firefox oracle asserts Gecko's operators | 2.4, 12.2 |
| Non-finite `low` / `high` / `optimum` count as absent | Acceptable: matches the platform's attribute parser, unit-tested | 2.1 |
| `aria-valuenow` clamped (to `min`) for a degenerate range | Acceptable (N7) | 2.1 |
| `defaultValue` passes through to the div | **Not acceptable**: fixed in ab22773 (S3) | 3.1, 3.3 |
| `// oxlint-disable-next-line react/refs` on `mergeRenderRef(ref, render)` in both Roots | Acceptable: the ref is only forwarded to the element, never read during render; the comment says so | 14.1 |

Other facts recorded by the implementation: the CDP accessibility tree reports `valuetext: ""`
for `aria-valuetext` on every role, so the browser rows assert the attribute (12.2); the
Chromium meter oracle is a screenshot pixel, because the three `::-webkit-meter-*-value`
pseudo-elements report the same computed width (12.2); the provider-from-server pattern is
confirmed with `@funstack/static`, the Next.js check and the screen-reader pass are human tasks
in #73 (5.3, 8.1).
