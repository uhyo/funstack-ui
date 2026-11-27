# Direction and locale

Status: **proposed** (#172, part of #162). Nothing here binds until the user decides the list in
section 7. If accepted, sections 4 and 5 become a section of `design/conventions.md` and this
document keeps the audit and the reasoning. No library code changes with this proposal.

Inputs: `docs/vision.md`, `design/conventions.md` (1.5, 7.1, 7.3, 8, 11), `design/placement.md`
(13.1, 13.3, 13.4), the component designs named below, an audit of `packages/ui/src` on
2026-11-27 (0.1.0-alpha.21), prior art (Radix, React Aria, Base UI, Ark UI, Headless UI,
Ariakit). Notes in `memo/architect/direction-locale-172.md`.

The question: four of the six libraries we compare with ship a direction or locale provider.
Does `@funstack/ui` need one, a `dir` prop, or neither? And is a `locale` prop per component
enough for NumberField and for date components later?

## 1. Summary

- **Direction: keep CSS `direction` as the only source. No provider, no `dir` prop.** The
  library already reads the computed `direction` of the relevant element at the event, in every
  component that needs it. The audit found no component that mirrors its arrow keys wrongly for
  lack of a provider. The gaps that exist (section 2.3) are engine differences and one unprobed
  component, and a provider would fix none of them.
- **Locale: keep the `locale` prop on the Root. No provider now.** A provider is a context, and
  `Progress.Root` and `Meter.Root` are deliberately directive-free so a Server Component can
  render them; they could not read it. Revisit when the first date component is designed.
- Write both down as conventions, and close four small gaps (section 6).

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

## 4. Recommendation: direction

**Option A, written down.** Proposed rules (a new conventions section if accepted):

1. **One source.** Direction is the computed CSS `direction` of an element. The library has no
   direction provider, no `dir` prop of its own and no default. A consumer sets direction the
   way the platform does (`dir` on `<html>`, on a container, or on a part through the native
   pass-through) and the library follows.
2. **Read at the event.** `getComputedStyle(element).direction` is read in the handler of the
   event it affects: each `keydown`, each press of a gesture (once per gesture), each open of a
   point-placed popup. Never during render, never stored between events. The direction may
   come from any ancestor and change at any time.
3. **Which element.** The element whose inline axis orders what the key moves: the container
   for a move between items (Tabs List, ToggleGroup / Toolbar Root, a menu popup), the control
   for a move of a value (the Slider input), the surface for a gesture (the Slider Track, the
   Drawer dialog). They differ only when a consumer sets direction on a part, and then the
   part's own direction is the right one.
4. **Only the inline axis mirrors.** ArrowLeft / ArrowRight swap under `rtl` for a horizontal
   orientation. ArrowUp / ArrowDown, Home / End, and vertical orientations do not.
   `internal/arrow-keys.ts` is the one mapping for item navigation.
5. **Placement is CSS.** Direction-following placement uses `self-*` keywords and logical
   properties, never a JS read to pick a physical side (`design/placement.md` 13.1; the
   point-placed menu of 13.4 is the one exception, because it has no anchor).
6. **API names.** A prop that names a side offers `inline-start` / `inline-end` next to the
   physical values (Popover `side`, Drawer `side`), so a consumer writes RTL-safe code without
   knowing the direction. This covers G8 when Toast's swipe is built.
7. **Native keys and engine differences.** Where the browser handles the keys of a native
   control and engines disagree under RTL, the component's design records the difference and
   the tests assert it per engine. Whether the library then normalises it is decision 2 of
   section 7.

Trade-off accepted: a consumer coming from Radix or Base UI looks for a `DirectionProvider`
and finds none. The docs page (section 6) says in one line that `dir` is enough.

## 5. Recommendation: locale

**L4: keep the prop, no provider now, decide again at the first date component.** Proposed
rules:

1. **`locale` is a prop of the Root** of a component that formats or parses:
   `locale?: string | readonly string[]` (what `Intl` constructors take), default the
   runtime's locale. Plain data, so it crosses the server boundary. Parts read the formatter
   from the component's context, never the locale from a library-wide one.
2. **No locale provider, no `lang` detection, no `navigator.language`.** Extends the rule
   conventions 11 has for built-in strings to formatting.
3. **The default is for client-only rendering.** The docs of every such component say: pass
   `locale` when the page is server-rendered. A client Root warns in development when
   `<html lang>` disagrees with the resolved locale and no `locale` was given (NumberField's
   warning, shared); a directive-free Root cannot.
4. **Locale does not set direction.** React Aria and Ark derive direction from the locale's
   script. Here they are independent: direction is CSS (section 4).
5. **Revisit trigger.** The design of the first date or time component must reopen this
   section, with the count of Roots taking `locale` and the cost of making Progress and Meter
   read a provider.

Trade-off accepted: an app with several formatted components repeats one prop, or wraps the
Roots once.

## 6. Follow-up work if accepted

None of this is done by the proposal.

| # | Work | Closes |
| --- | --- | --- |
| F1 | Move sections 4 and 5 into `design/conventions.md` as a new section; changelog entry. | G6 |
| F2 | `locale` on `Progress.Root` and `Meter.Root` accepts `string \| readonly string[]`. Additive. | G4 |
| F3 | Probe OTPField in an RTL container in three engines, then apply decision 3. | G2 |
| F4 | A docs page "Direction and locales": `dir` is the only switch; which keys mirror; the engine differences (G1, G5); `locale` and SSR; the wrapper recipe for an i18n library. | G3, G7 |
| F5 | Apply decision 2 to RadioGroup. | G1 |

## 7. Decisions for the user

Recommended option first.

1. **Direction source.**
   - (a) CSS `direction` only, written as a convention (section 4). No provider, no `dir` prop.
   - (b) (a) plus a `DirectionProvider` that overrides the CSS read, for familiarity.
   - (c) A `DirectionProvider` as the source, as Radix and Base UI do.
2. **RadioGroup arrows under RTL in WebKit (G1).**
   - (a) Leave native: a FUNSTACK radio group behaves like every native radio group in Safari.
     Slider stays the exception because there the value moved against the drawn track.
   - (b) Normalise in JS as Slider does: under RTL, handle ArrowLeft / ArrowRight in every
     engine (focus and click the neighbour). Costs a key handler on a component that has none
     today, and a choice about wrapping in WebKit.
3. **OTPField under RTL (G2), after the probe of F3.**
   - (a) `OTPField.Root` renders `dir="ltr"` by default (a code is read left to right in every
     locale); a consumer's own `dir` wins.
   - (b) Docs recipe only: tell consumers to pass `dir="ltr"`.
   - (c) Follow the container: mirror the boxes and make the keys match in JS.
4. **Locale input.**
   - (a) `locale` prop per Root, no provider; unify the type (F2); reopen at the first date
     component (section 5).
   - (b) Add a `LocaleProvider` now for client components; Progress and Meter keep the prop
     only.
   - (c) Add a `LocaleProvider` now and make Progress and Meter client components so every
     component follows it.

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
