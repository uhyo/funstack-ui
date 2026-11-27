# Direction and locale

Status: **accepted** (#172, part of #162; decided by the user on 2026-11-27). The rules are
`design/conventions.md` section 14; this document keeps the audit they rest on, the options
that were rejected and the prior art. Where the two disagree, the conventions win. The audit
(section 2) describes 0.1.0-alpha.21, before the follow-up work of section 6, and is not
updated: G2's "expected result" was written before the probe, which found the boxes mirrored
in every engine and the arrow keys moving against them in Firefox and WebKit only
(`design/components/otp-field.md` 4.4).

Inputs: `docs/vision.md`, `design/conventions.md` (1.5, 7.1, 7.3, 8, 11), `design/placement.md`
(13.1, 13.3, 13.4), the component designs named below, an audit of `packages/ui/src` on
2026-11-27 (0.1.0-alpha.21), prior art (Radix, React Aria, Base UI, Ark UI, Headless UI,
Ariakit). Notes in `memo/architect/direction-locale-172.md`.

The question: four of the six libraries we compare with ship a direction or locale provider.
Does `@funstack/ui` need one, a `dir` prop, or neither? And is a `locale` prop per component
enough for NumberField and for date components later? The answer: neither a provider nor a
library `dir` prop; a `locale` prop per Root.

## 1. Summary

- **Direction: CSS `direction` is the only source. No provider, no `dir` prop.** The library
  reads the computed `direction` of the relevant element at the event, in every component that
  needs it. The audit found no component that mirrors its arrow keys wrongly for lack of a
  provider. The gaps that exist (section 2.3) are engine differences and one component that
  had no rule, and a provider would fix none of them.
- **Locale: a `locale` prop on the Root. No provider.** A provider is a context, and
  `Progress.Root` and `Meter.Root` are deliberately directive-free so a Server Component can
  render them; they could not read it. The first date component reopens the question.

## 2. Current state

### 2.1 Direction: where it is read

Every read is `getComputedStyle(element).direction`, at the event, never at render.

| Component | What follows direction | Element read | When | File |
| --- | --- | --- | --- | --- |
| Tabs | ArrowLeft / ArrowRight between tabs (horizontal only) | the List | each `keydown` | `tabs/tabs-list.tsx` |
| ToggleGroup, Toolbar | the same, through roving focus (horizontal only) | the Root | each `keydown` | `internal/use-roving-focus.ts`, `internal/arrow-keys.ts` |
| Toolbar with `experimental_focusgroup` | the same | (the browser) | native | `internal/use-native-focusgroup.ts` |
| Slider | ArrowLeft / ArrowRight change the value; pointer position to value | the input (keys), the Track (pointer) | each `keydown`; each press | `slider/slider-root.tsx` |
| Menu | the key that opens and closes a submenu; the open key of a Trigger in a vertical Toolbar | the popup; the parent popup; the Trigger | each `keydown` | `menu/use-menu-keyboard.ts`, `menu/menu-submenu-trigger.tsx`, `menu/menu-trigger.tsx` |
| Menu at a point (ContextTrigger) | which edge of the menu sits at the pointer | the popup | once per open or move | `menu/menu-root.tsx`, `menu/menu-point.ts` |
| Menu | wheel hand-off of a horizontal scroller | the scroller | each wheel event | `menu/menu-outside.ts` |
| Combobox `multiple` | inline-start arrow from the input to the chips; arrows between chips | the input; the chip | each `keydown` | `combobox/combobox-keyboard.ts`, `combobox/combobox-root.tsx` |
| Drawer | the swipe direction of an `inline-start` / `inline-end` drawer | the dialog | each press | `drawer/drawer-swipe.ts` |
| Tooltip, Popover, HoverCard, Menu, Select, Combobox, MultiSelect | placement (`inline-start` / `inline-end` sides, `start` / `end` align) | none in JS: `self-*` keywords of CSS Anchor Positioning | CSS | `internal/overlay/anchor-position.ts` |
| the same popups | `data-side` / `data-align` (the resolved placement) | the popup and the root, to parse the computed `position-area` | while shown | `internal/overlay/use-resolved-placement.ts` |
| RadioGroup | arrows between radios | (the browser) | native | none |
| Accordion | nothing: vertical only | | | `accordion/accordion-root.tsx` |
| NumberField | nothing: ArrowUp / ArrowDown only | | | |
| OTPField | caret movement in the one input | (the browser) | native | none |

So the library is already "option A" everywhere, without a written rule. Two facts follow:

- **A direction island works.** A `dir="rtl"` subtree in an LTR page (or the reverse) is
  handled per component, because each reads its own element. A provider with one value per
  tree gets this wrong unless the consumer nests providers to match the markup.
- **A per-component `dir` already exists.** `dir` is a native attribute and every part passes
  native props through (conventions 1.5): `<Tabs.List dir="rtl">` sets the computed direction
  the library reads. Option B needs no new prop.

RTL rows exist in the tests of Tabs, ToggleGroup, Toolbar, Slider, Menu, Combobox (chips),
Drawer, RadioGroup, Popover, Tooltip, Progress and the placement parser. OTPField has none.

### 2.2 Locale: where it is read

| Component | Prop | Type | Default | Notes |
| --- | --- | --- | --- | --- |
| `NumberField.Root` | `locale`, `format` | `string \| readonly string[]` | the runtime's locale | Formatter and parser from `Intl.NumberFormat` (`number-field/number-field-format.ts`). A development warning when `<html lang>` disagrees and no `locale` is given. |
| `Progress.Root`, `Meter.Root` | `locale`, `format` | `string` | the runtime's locale | `aria-valuetext` and the `Value` part (`internal/range-value.ts`). Directive-free: rendered by a Server Component they format once, on the server. No warning (no effect to run it from). |
| Slider | none | | | `aria-valuetext` is the consumer's function. |
| Menu, MultiSelect typeahead | none | | | `toLowerCase()` on both sides, no locale (`internal/typeahead.ts`). |
| Combobox | none | | | Filtering is the consumer's. |

Built-in strings are English with a function or `aria-label` override, and conventions 11
already says the library ships no locale mechanism for them. There are five: Combobox's count
and removal announcements, Toast's region name, NumberField's two button labels.

The library never reads `navigator.language` and never reads `lang` except for NumberField's
warning.

### 2.3 Gaps

None of these is a wrong read of direction by library code. They are listed by how much they
matter.

| # | Gap | Kind | A provider fixes it? |
| --- | --- | --- | --- |
| G1 | **RadioGroup in WebKit does not mirror ArrowLeft / ArrowRight under RTL** (and does not wrap). Deliberate (`design/components/radio-group.md` 8: the keys are native and the library installs no handler), but **inconsistent with Slider**, where the same WebKit difference is normalised in JS. | engine difference, policy | no |
| G2 | **OTPField under RTL is not designed or probed.** The Slots are consumer markup in DOM order, so an RTL container lays slot 0 at the right, while the code in the one input is a left-to-right run and the native caret keys move in that run. Expected result (not probed): the boxes read right to left and ArrowLeft moves the active box to the right. A one-time code is read left to right in RTL locales too. | design gap | no |
| G3 | **A hydration mismatch when `locale` is left out** and the server's locale differs from the browser's: NumberField's visible text, and `aria-valuetext` / `Value` of a Progress or Meter inside a client tree. Documented per component; only NumberField warns. | default | partly (section 3.2) |
| G4 | `locale` is `string \| readonly string[]` on NumberField and `string` on Progress and Meter. | inconsistency | no |
| G5 | Firefox misplaces an anchored popup whose parent's direction differs from the root's (`design/placement.md` 13.3, Mozilla 2019601). Known, tested as degraded. | engine bug | no |
| G6 | No rule says which element's direction a component reads, or when. Each component chose well, but the next one has no rule to follow. | missing convention | no |
| G7 | The docs site has no page on RTL and locales; the facts are spread over component pages. | docs | no |
| G8 | Toast's reserved `swipeDirection` (`design/components/toast.md` 9.2) is physical only, while Drawer's `side` has `inline-start` / `inline-end`. Not built yet. | future API | no |
| G9 | Horizontal arrow keys ignore `writing-mode` (a horizontal Tabs list in a vertical writing mode). No library handles it; no request. | out of scope | no |

## 3. Options

### 3.1 Direction

**A. CSS `direction`, read from the element (today).** No API.

- For: one source of truth, the one the browser uses for layout, logical properties, `:dir()`
  and anchor positioning, so keys and layout cannot disagree. Islands work. Nothing is needed
  at render, so Server Components and pre-hydration markup are unaffected. Zero bytes of API.
  It is the vision's "where the platform can do the job, prefer it".
- Against: a style read at each `keydown` (it can force a style recalculation; at one read per
  key press this has never shown up). Direction is not known during render, so nothing in the
  rendered markup can depend on it. Today nothing does: placement is CSS, and `data-side` is
  observed after layout.

**B. A `dir` prop per component.** Radix and Ark have it next to their provider.

- Already there as the native attribute (2.1). A library-level prop of the same name would
  have to either shadow the attribute or mean something different from it.

**C. A `DirectionProvider`.**

- For: familiar (Radix, Base UI, Ark; shadcn/ui wraps it). The value is known at render.
- Against: it is a second source of truth next to `dir`. Radix and Base UI both state that the
  provider does not set `dir` and that the consumer must set both; forget one and keys and
  layout disagree. That class of bug cannot happen under A. Their default is `"ltr"`, so a
  page with `<html dir="rtl">` and no provider has wrong arrow keys, which under A is right
  with no setup. A context cannot be read by a directive-free part. And no component needs
  the value at render.

**A + C (provider as an override).** Read CSS unless a provider is present. The worst of both:
two sources, and every read site must check both.

### 3.2 Locale

Direction can be read from the DOM at the event. Locale cannot: it is needed **at render**, on
the server as well, because it decides visible text.

**L1. A `locale` prop on the Root (today).** In a compound component only the Root takes it;
the parts get the formatter from the component's own context.

- For: plain data, so a Server Component passes it, and directive-free Roots (Progress, Meter)
  use it. Explicit at the call site. A consumer with an i18n library writes
  `locale={useLocale()}` once, in their own wrapper around the Root, which is how a headless
  library is consumed anyway.
- Against: one prop per Root. Forgetting it gives the runtime's locale and, under SSR, G3.

**L2. A `LocaleProvider` that supplies the default of every `locale` prop.**

- For: set once. React Aria (`I18nProvider`) and Ark (`LocaleProvider`) work this way.
- Against: **a directive-free Root cannot read context when a Server Component renders it**,
  so Progress and Meter would either ignore the provider (two classes of component, a trap) or
  become client components (giving up their server rendering, conventions 7.1 and
  `design/components/progress.md` 8.1, and server function props such as `getAriaValueText`). Apps that localise already have a locale provider from
  their i18n library; ours would be a second one to keep in step, the same duplication as C.
  It also invites the next step, a strings provider, which conventions 11 rejected.

**L3. Derive the default from `lang` in the DOM.** Rejected in `design/components/number-field.md`
5.1 and still wrong: the server cannot read the DOM, so the server and client renders differ.

**L4. L1 now, decide again with the first date component.** A calendar takes much more from
the locale than a number does (calendar system, first day of the week, month and weekday
names, hour cycle, numbering system), all of it visible and server-rendered. That is the
strongest case for L2, and also the point where the real cost can be measured: date and time
is P3 and outside #162.

## 4. Direction: what was chosen

**Option A**, as conventions 14.1. Trade-off accepted: a consumer coming from Radix or Base UI
looks for a `DirectionProvider` and finds none; the docs say in one line that `dir` is enough.

## 5. Locale: what was chosen

**L4**, as conventions 14.2: the prop on the Root with one type, no provider, reopened by the
first date or time component. Trade-off accepted: an app with several formatted components
repeats one prop, or wraps the Roots once.

## 6. Follow-up work

| # | Work | Closes |
| --- | --- | --- |
| F1 | The rules are conventions 14. Done with the acceptance. | G6 |
| F2 | Done (#188). `locale` on `Progress.Root` and `Meter.Root` accepts `string \| readonly string[]` (`design/components/progress.md`). Additive. | G4 |
| F3 | Done (#188). `OTPField.Root` renders `dir="ltr"` by default (`design/components/otp-field.md` 4.4), with a three-engine probe of the field in an RTL container: the boxes mirror in every engine, the caret keys differ by engine. | G2 |
| F4 | Done (#188). A docs page "Direction and locales": `dir` is the only switch; which keys mirror; the engine differences (G1, G5); `locale` and SSR; the wrapper recipe for an i18n library. | G3, G7 |

G1 stays as it is (decision 2). G8 is covered by conventions 14.1 rule 6 when Toast's swipe is
built. G5 waits for Firefox. G9 is out of scope.

## 7. Decisions

Decided by the user on 2026-11-27; the options not taken are in the changelog entry of that
date.

1. **Direction source**: CSS `direction` only, written as a convention. No provider, no library
   `dir` prop.
2. **RadioGroup arrows under RTL in WebKit (G1)**: left native. A FUNSTACK radio group behaves
   like every native radio group in Safari; Slider stays the exception.
3. **OTPField under RTL (G2)**: `OTPField.Root` renders `dir="ltr"` by default; a consumer's
   own `dir` wins.
4. **Locale input**: a `locale` prop per Root with one type, no provider; reopened at the first
   date component.

## 8. Prior art

From the libraries' documentation; details not re-verified for this proposal are marked.

| Library | Direction | Locale |
| --- | --- | --- |
| Radix | `DirectionProvider` and a `dir` prop per component; default `"ltr"`; does not read the DOM. | none |
| Base UI | `DirectionProvider` / `useDirection`, default `"ltr"`; its docs say the provider does not affect HTML or CSS and `dir` must be set as well. | `locale` prop on NumberField (as ours) |
| React Aria | `I18nProvider` / `useLocale` gives `{ locale, direction }`; direction derived from the locale's script; default from the browser's language, so SSR needs the provider. | the same provider, used by number, date and collation hooks |
| Ark UI | `LocaleProvider` gives locale and `dir`; components also take `dir` and `locale` (not re-verified). | the same provider |
| Headless UI | no provider (how it treats RTL keys: not verified) | none |
| Ariakit | no provider; an `rtl` option on its composite store (not re-verified) | none |

What we borrow: Base UI's NumberField `locale` + `format` shape (already done), and from all
of them the list of keys that mirror. What we do not: a second source of truth for direction.
