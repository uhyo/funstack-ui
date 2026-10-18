# Architect notes: Progress and Meter (#68, wave 6), 2026-10-18

Working notes behind `design/components/progress.md`. Not a spec.

## Inputs

- `docs/research/wave6.md` §3 (binding: ARIA roles on divs, `Track` / `Indicator`, a CSS custom
  property for the fill, `aria-valuetext` always, Meter regions as a pure function, no
  `<ViewTransition>`), product-owner decision on research question (d): native `<progress>` /
  `<meter>` are not the styled element.
- Conventions 7.1 (per-file directive; the "directive-free file rendering a client-created
  context provider" exception, unused so far), 7.3 (JS-free is about behaviour), 3.5 (the
  "consumer-owned, mirrored" kind names "a future Progress `value`"), 11 (built-in strings).
- Slider (`--slider-value`, `getAriaValueText(value, index)`, `Value` as `span` not `<output>`,
  no `transition` prop), Field (one state object for every part, always-referenced description
  id, "no form control registered" dev warning in `field-root.tsx`).

## Prior art read for this design

- Base UI 1.9 `Progress`: Root (`value: number | null` → indeterminate, `min` 0, `max` 100,
  `format: Intl.NumberFormatOptions`, `locale`, `getAriaValueText(formattedValue, value)`),
  Track, Indicator, Label (registers its id with `setLabelId`), Value (`aria-hidden`, shows
  `formattedValue`). `status: "indeterminate" | "progressing" | "complete"`. Default
  `aria-valuetext` while indeterminate: the English string `"indeterminate progress"`. With
  `format` given it formats the raw value, else the fraction as percent.
- Base UI 1.9 `Meter`: same shape, `value` required, **no** `low` / `high` / `optimum`.
- React Aria `useProgressBar` / `useMeter`: `value`, `minValue` 0, `maxValue` 100,
  `formatOptions` default `{ style: "percent" }`; **percent style formats the fraction, any
  other style formats the value**; `isIndeterminate` omits `aria-valuenow` and `aria-valuetext`
  but keeps `aria-valuemin` / `max`; the label is a `<span>` (not `<label>`: a progressbar is
  not labelable).
- Radix `Progress`: Root (`value`, `max`, `getValueLabel`), Indicator; `data-state`, `data-value`,
  `data-max`.
- Ark UI `Progress`: Root, Label, ValueText, Track, Range, Circle / CircleTrack / CircleRange,
  View; `translations.value`.

Borrowed: `format` + `locale` (Base UI; serialisable, so a Server Component can pass them),
the fraction-vs-value formatting rule (React Aria), `null` = indeterminate (Base UI), the
`aria-hidden` Value (Base UI), `Label` as a `span` (React Aria), `Track` / `Indicator` /
`Label` / `Value` (Base UI, our Slider). Rejected: the English `"indeterminate progress"`
default (conventions 11: no English string unless its absence is an accessibility gap, and an
unvalued progressbar is announced as busy / indeterminate by AT already), `data-state` enums
(booleans by presence), `data-value` / `data-max` (the ARIA attributes carry them; typed
`attr()` later), Circle parts (a `conic-gradient` recipe does it in CSS), a label registration
through state (would make the Root a client module, see below).

## The one real design question: can the Root be a Server Component?

Progress and Meter have no state, no event, no DOM access. The only client-only API a compound
component normally needs is **context** (the parts find their Root). Facts checked:

- `react@19.3.1` under the `react-server` condition (`react.react-server.js`) exports `use`,
  `useId`, `useCallback`, `useMemo`, `useDebugValue`, `cache`, `cacheSignal`. So `useId` in
  the Root is fine on the server, and `useMemo` would be too (conventions 7.1's "hooks other
  than `use` / `useId`" is stricter than React; proposed as a note).
- `createContext` is **not** in the server build; the context module must be `"use client"`.
  A directive-free module may *render* `<ProgressContext value>` imported from it (conventions
  7.1, second exception; the element type is a client reference and the value is serialisable).
  No existing component uses the exception; this is the first. The docs site (RSC through
  `@funstack/static`) is the integration proof: a Server Component example that renders
  `Progress.Root` either builds or does not.
- `useRender` (`internal/use-render.tsx`) is `"use client"` only because of a `useMemo` around
  the merged ref. A Root with no library ref does not need the memo. Two ways out: split a
  pure `renderElement()` into a directive-free module, or drop the directive from
  `use-render.tsx` on the strength of the `react-server` export list. Left to the implementer,
  with the conventions proposal recording the fact.
- `useDevWarning` is an effect → client. The Root warns with a module-level warn-once
  (`console.error` in development), which is what a Server Component can do.

Consequence: `Progress.Root` / `Meter.Root` are directive-free; `Track`, `Indicator`, `Label`,
`Value` read the context and are client modules. When a Server Component renders the whole
anatomy, the Root (and `Intl.NumberFormat`, `getAriaValueText`, `children(state)`) runs on the
server only, so there is no locale mismatch at hydration and function props may be passed from
a Server Component; the client gets the context module and the part modules it used.

Cost accepted for the directive-free Root: the Label cannot register (no state in the Root),
so the Root **always** renders `aria-labelledby="<id>-label"` and the reference dangles when no
Label is rendered. accname skips an IDREF that resolves to nothing and falls through to
`aria-label` (Field.Description and Dialog.Description already rely on the "dangling reference
is skipped" rule for `aria-describedby`); the browser test plan has a CDP row for the name with
a dangling token plus `aria-label`. No "unnamed progressbar" dev warning is possible from the
Root for the same reason.

## The async angle, worked through

There is no interaction, so no action, no pending, no optimistic state, no transition types.
The Async React content is on the **consumer's** side and it is a lane rule, the mirror image
of the library's usual advice:

- A value that reports on an in-flight action must be written with a **plain `setState`**
  (after an `await` inside the action it is urgent anyway, conventions 2.3 item 4). Wrapping it
  in `startTransition` holds the update until the action settles (2.3 item 5): the bar sits at
  0 and jumps to 100. Same reason the Toast queue is urgent by design (2.6).
- `{pending && <Progress.Root />}` mounts in the sync `isPending` render of `useTransition`, so
  an indeterminate bar appears at once; no boundary, so no view transition cost.
- `useOptimistic` has nothing to do here: there is no committed value to be ahead of.
- No `useFormStatus` coupling inside the component: `Form.Root`'s `children(state)` already
  exposes `pending`, and a Progress that silently read the form channel would be hidden
  coupling (the research's "busy region" note is for the consumer).

## Meter regions

Chromium `HTMLMeterElement::GetGaugeRegion` (main, read 2026-10-18), with `value`, `low`,
`high`, `optimum` already clamped (`low` to `[min, max]`, `high` to `[low, max]`, `optimum`
to `[min, max]`, defaults `min`, `max`, `(min + max) / 2`):

```
if (optimum < low)        { value <= low → optimum; value <= high → suboptimum; else even-less-good }
else if (high < optimum)  { high <= value → optimum; low <= value → suboptimum; else even-less-good }
else                      { low <= value && value <= high → optimum; else suboptimum }
```

The HTML spec's prose has the same three cases; Chromium's operators settle the boundaries.
Firefox exposes the region as pseudo-classes on the element (`:-moz-meter-optimum`,
`:-moz-meter-sub-optimum`, `:-moz-meter-sub-sub-optimum`), which gives a browser-test oracle
for Gecko; Chromium's `::-webkit-meter-*-value` pseudo-element is swapped per region.

## Decisions I went back and forth on

- **`value` optional with `null` default (indeterminate)** vs required `number | null`. Native
  `<progress>` without `value` is indeterminate and Base UI defaults to `null`; the spinner call
  site `<Progress.Root aria-label="Loading" />` reads right. `undefined` never means
  "uncontrolled" here because nothing is controllable.
- **`max` default 100** (every prior-art library) vs the platform's 1. Consumers port from
  Radix / Base UI / React Aria with `value={40}`; a default of 1 would clamp that to 100 %.
  Product-owner item.
- **`getAriaValueText(value, state)`** rather than Slider's `(value, index)` or Base UI's
  `(formattedValue, value)`: Meter needs `state.region` for "64%, high"; Combobox's
  `announce(count, state)` is the shape.
- **Two text fields in the state**: `formattedValue` (what `Progress.Value` shows) and
  `valueText` (what `aria-valuetext` carries, after `getAriaValueText`), so the spoken text can
  say more than the visible number.
- **Indicator element `span`** (library vocabulary, Tabs and Slider) rather than Base UI's
  `div`; absolute positioning blockifies it anyway.
- **No Field registration.** A Field's control is a form control; `Field.Root` warns today when
  nothing registers. A Meter next to a `Field.Control` inside a Field is a sibling with its own
  name. The "labelled read-only value" layout is a `Meter.Label`, not a Field.
