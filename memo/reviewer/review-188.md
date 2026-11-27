# Review: #188 direction and locale (branch feat/188-direction-locale, head 811931e7)

Reviewed 2026-11-27 against origin/master, conventions 14, direction-locale.md, otp-field.md 4.4,
progress.md 2.2 and the #188 checklist. CI is green at 811931e7 (all three engines).
The otp-field.md 4.4 sentence is the architect's (review/188) and is out of scope here.

Verdict: **acceptable with minor fixes** (one docs typo to fix; the rest are nits).

## Checked and correct

- `otp-field-root.tsx:262` `dir = "ltr"` is a destructuring default, so `undefined` gets the
  default and any consumer value wins; passed through `props` (not `libraryProps`, 708), so a
  `render` element's own `dir` wins (conventions 1.2), and the function form of `render`
  receives it. In the server HTML. No direction read, no key handler: 14.1 rule 8 holds.
- `progress-root.tsx`, `meter-root.tsx`, `internal/range-value.ts` stay directive-free; no new
  imports.
- `range-value.ts:41` key `JSON.stringify([locale ?? null, options])` matches
  `number-field-format.ts:318`; string and list cannot collide; list order is part of the key;
  readonly list copied before `Intl`. Only callers are the two Roots.
- Browser rows: computed `ltr` on Root and Input, label outside stays `rtl`, Slot order, both
  charsets, ArrowLeft/Right/Home/End, a real click on Slot 1 then typing, and the `dir="rtl"`
  row asserting the probe table per engine. Expected arrays match the CHANGELOG table for every
  engine. `browserName` is the right switch here: native caret movement has no feature probe.
- Docs page facts checked against code: Combobox defaults (`"No results"`, `"N removed"`),
  Toast `"Notifications (F8)"`, NumberField `"Increase"` / `"Decrease"`, NumberField's `lang`
  warning, Progress parts, every in-site anchor (`#props`, `#keyboard-and-aria`,
  `#right-to-left-pages`). Mirroring table matches direction-locale.md 2.1. Built-in strings
  match the five of 2.2.

## Must fix

1. `packages/docs/src/pages/OTPFieldPage.tsx:248` the `owned` text reads "unless your style
   sets it `dir` is `"ltr"` unless you pass one." Missing sentence break. Also `dir` is not an
   owned key (the consumer wins), so it reads better as its own sentence: "... unless your
   style sets it. `dir` defaults to `"ltr"`; yours wins."

## Nits

2. `packages/docs/src/pages/DirectionLocalesPage.tsx:29` "reads the computed CSS direction of
   its own element": per 14.1 rule 3 it is the element whose inline axis orders the move (the
   List, the popup, the Slider input, the Track), not always the component's own element.
   "of the relevant element (the table below)" is exact.
3. `DirectionLocalesPage.tsx:88-91` the Menu row omits the open key of a Trigger in a vertical
   Toolbar and the wheel hand-off of a horizontal scroller (2.1 rows). Optional.
4. `DirectionLocalesPage.tsx:31-35` the first code block mixes an unclosed `<html>` tag with a
   JSX comment; either plain HTML with an HTML comment or a JSX fragment.
5. `OTPFieldPage.tsx:227` documents `dir` as `"ltr" | "rtl" | "auto"`; the declaration
   (`otp-field-root.tsx:165`) is React's `string`. Fine as documentation of valid values, but
   the props tables are meant to mirror the declarations.
6. `packages/ui/src/internal/range-value.test.ts:88` the title says "copied, not handed to
   Intl", but the assertions cannot observe the copy (`Intl` never mutates its argument). Name
   it for what it shows: a frozen readonly list formats.
7. `range-value.test.ts:104` `["de"]` and `"de"` being different cache entries is asserted as
   behaviour; it is an implementation detail (one extra formatter). Harmless; could be dropped.
