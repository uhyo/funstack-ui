# Review: Select (#50), 2026-10-17

Commits reviewed: 1114850 (ui), f107022 (example), 4b1c94b (docs), ba1f6e5 (tests + dev memo).
Verdict: **acceptable with fixes** (one H, one M; the architecture and the three React fixes
hold up, no rework). Local runs: jsdom 86/86, browser Chromium + Firefox 23 passed / 7 skipped.
WebKit cannot be launched on this machine either (host libraries), so the WebKit column is
still reasoning only.

## Experiments (temporary files, deleted)

- P1 Playwright, plain HTML, Chromium 156 / Firefox 157: `required` select with the `""`
  placeholder, blocked `requestSubmit()` -> `:user-invalid` true; then `select.value =
  select.value` -> **still `:user-invalid`** in both (spec: the setter does not touch user
  validity; only the reset algorithm clears it, which P1 also saw). The refresh is safe for
  validity styling.
- P1b same harness: `select.value = select.value` **does set the option's dirtiness** in
  Chromium (a `selected`-attribute option, refreshed, then `defaultSelected = false`: stays
  selected; the unrefreshed control moves to the first option). Spec says the same (setter step:
  "set firstMatchingOption's selectedness to true and set its dirtiness to true"). Firefox shows
  no difference. Harmless for the library (React's `updateOptions` dirties the option anyway),
  but design 6.3 says the opposite (L1).
- P2 Chromium 156, form reset after a pick (selectOption / `.value` / `.selected`), three
  ways of establishing the default: `selected` attribute, script `defaultSelected = true`, none.
  With a `selected`/`defaultSelected` option the reset restores the value but leaves
  `<selectedcontent>` on the old option (all 6 rows); with none (selectedness setting
  algorithm) it re-clones. The spec's select reset algorithm ends with "update a select's
  descendant selectedcontent elements" unconditionally, so this is a Chromium bug. Deviation 1
  is real and needed for exactly the library's normal case (uncontrolled `defaultValue` and
  controlled both mirror `defaultSelected`).
- E1 jsdom, neither `value` nor `defaultValue`, disabled `""` placeholder + a, b, in a form:
  client render adopts `""`; a pristine `form.reset()` then dispatches `("a", platform)` and the
  select moves to "a". Same tree SSR + hydrate: Fizz writes `selected` on the placeholder, the
  reset stays on `""`, no dispatch. Enabled placeholder: both stay on `""`. BUG (M1).
- E2 jsdom, neither prop, options `a, b` under a keyed `<Suspense>` with a disabled `""`
  fallback (the SelectCountry "Reload" shape, uncontrolled). Pick "b" (dispatch `activate`),
  remount the boundary, resolve: state and DOM end on **"a"**, no further dispatch. With
  `defaultValue` the same steps keep "b". BUG (H1).

## Findings

H1 internal/use-native-select-value.ts:242-250 (with select-root.tsx:129). Adoption is not
limited to the browser's initial choice: whenever late options mount while the state's option
is absent, adopt mode re-adopts. After a user pick, options that re-suspend (a keyed boundary,
a refetch with `use()`) show the fallback -> the state is adopted to the fallback (`""`) -> the
real options arrive -> adopted to the first enabled option. The user's committed value is
silently replaced; `valueChangeAction` is never told, so a persisted value and the form's
value diverge (E2). Decision 4 / design 5 meant "adopt the browser's default at mount, and
while loading", not "overwrite a pick". Fix: adopt only until the value has been established
by a dispatch (any reason): e.g. a ref `adoptable` cleared in `onPlatformChange`/`dispatch`
paths (or when `optimistic` was ever set by a dispatch); afterwards a late option only gets
the re-apply, as in uncontrolled-with-default. Arguably also do not adopt a *disabled*
fallback (state flips `"" -> a` on every reload even without a pick; cosmetic). Test: E2 as a
jsdom row next to select.test.tsx:667 (pick, reload, expect "b", no dispatch).

M1 internal/use-native-select-value.ts:72-78, select-root.tsx:122 (resetTarget `undefined` in
adopt mode). With a disabled `""` placeholder and no props, the adopted value is `""`
(`implicitDefault` honours react-dom/Fizz picking a disabled `""`) but nothing is mirrored, so
the browser's reset result is the first *enabled* option: a reset of an untouched form changes
the value and dispatches "platform" (also React's automatic reset after a successful
`<form action>`), and only in client-rendered trees; SSR resets to `""` because Fizz wrote
`selected` (E1). The docs' recommended placeholder is the disabled one. Fix: in adopt mode use
the adopted mount value as the reset target when it came from a `""` option (that matches
what Fizz writes), i.e. `resetTarget = implicitDefault === "" option ? "" : undefined`, or
simply the adopted mount value as in controlled mode. Docs SelectPage.tsx:168 ("a reset returns
to the first enabled option") and design 5 / 6.1 need the same correction.

L1 design/components/select.md:550-551 "Setting `.value` does not touch option dirtiness" is
wrong (P1b, spec). No code change; correct the sentence (the dirtying is benign, even helpful:
a refreshed option is not moved by a later `defaultSelected` mirror).
L2 design/components/select.md:583 recipe 1 is one rule with `.select, .select::picker(select)`;
Firefox drops the whole rule. Docs (SelectPage.tsx:101-104), example CSS and the browser test
already use two rules; update the design.
L3 select-value.tsx:340-347. The reset refresh listens on `ownerDocument` and filters on
`event.target === select.form`: a consumer `stopPropagation()` on the form's `reset`, or a
Select inside a shadow root (`reset` is not composed), gets no refresh in Chromium. Listen on
`select.form` (re-read per commit like `useFormReset`, or reuse `useFormReset` on the select).
Niche; fine to defer.
L4 select.browser.test.tsx:117-121 pins `supportsBaseSelect`/`supportsSelectedContent` to true
on WebKit. cross-engine precedent (popover hint) logs WebKit's value instead of pinning. If the
Playwright WebKit build lacks one of them this row fails while every other row branches
correctly. Keep it as a canary only if a failure there is meant to block CI; otherwise assert
Chromium/Firefox and log WebKit.
L5 internal/use-native-select-value.ts:230, 238-259. `lateHandled` is a microtask window, not a
per-commit flag: a second commit in the same task (a sync re-render flushed from a layout
effect, e.g. the adoption's own `setInternal`) that mounts the intended option is not
re-applied. Theoretical with the current parts; a comment or a commit counter would do.
L6 select-option.tsx:62. `state.disabled` / `data-disabled` ignore a disabled `Select.Group`,
while `:disabled` (and the docs table's "pseudo-class equivalent", SelectPage.tsx:331-335)
include it. Document or include (Group could pass `disabled` via context).
L7 use-controllable-action.ts:354-356 `adopt` has no unit test (dev memo says so); add one in
the hook's tests (uncontrolled writes without calling the action; controlled no-op).
L8 Hydrated Options re-render once more after hydration (the uSES server/client snapshot
difference). For long lists (countries) that is one extra sync pass over N options; acceptable,
worth a sentence in design 6.2.
L9 Missing browser row: a refresh while `:user-invalid` (P1 shows it is kept). Optional.

## Checklist notes (no finding)

- Async React: picks dispatch in the Root's transition with `fsui-select`; `value={optimistic}`
  survives react-dom's restore (browser row, Chromium+Firefox); rejection rolls DOM and the
  clone back via `updateOptions`; superseded rejections reach the boundary. Pending on Root,
  Trigger and target Option.
- Mount order in `useNativeSelectValue`: adoption -> adapter reconciliation -> re-apply ->
  `rootMounted`; StrictMode re-runs keep Option reports in the Root's mount ignored. The
  `adopted` ref is cleared before the adapter's late microtask, after the sync adoption render
  has updated `latest`, so a late hydrated pick is compared against the adopted value. Correct.
- Hydration tell: Option's mount layout effect reads the hydration render (server snapshot);
  correct for boundaries hydrating after the Root and for client-rendered fallbacks.
- `defaultSelected` mirror then re-apply in one synchronous step; first match only. Correct.
- MutationObserver filter: attribute records on the option skipped, `<selectedcontent>` records
  never inside an option (no loop), `selectedIndex` guard. Correct.
- Value hydration: `dangerouslySetInnerHTML={{__html: ""}}` is compared by string on updates, so
  React never wipes the browser's clone after mount.
- Accessibility: no ARIA written by any part; `aria-*` pass through; the native combobox mapping
  stands. CDP row covers names, group, separator, disabled.
- API: state shapes and data attributes mirror RadioGroup / CheckboxGroup (`selected` instead of
  `checked` per conventions 4.1); owned keys documented.

## Deviation judgements

1 accept (P2 confirms; refine the memo: Chromium re-clones on reset only when no option has
  `selected`/`defaultSelected`, i.e. not in the library's normal case). Record a repo issue:
  "Chromium 156: form reset restoring a `selected` option does not update `<selectedcontent>`
  (spec reset algorithm step 'update descendant selectedcontent')" - for a human to report
  upstream. See L3 for the listener target.
2 accept the mechanism (implicit default = `""` option else first enabled; ref until the sync
  render); but adoption must stop once a value was chosen (H1) and the reset target must match
  the adopted placeholder (M1).
3 accept (Root state for Group/GroupLabel/Separator, design elided it).
4 accept (RadioGroup precedent).
5 accept (cross-realm iframe hydration row needs it).
6 accept.

## For the developer's "not verified" list

- `select.value = select.value` and `:user-invalid` in Chromium: **verified, not cleared** (P1).
- WebKit: still unverified here; the branches are sensible (feature checks, not engine names,
  except the 302008 row and the CDP row), apart from L4.
