# Review: CheckboxGroup (#33), 2026-10-17

Commits reviewed: db8299d (ui), 631d86e (example), 860cbdc (docs), shared-hook `equals` option.
Verdict: **acceptable with fixes** (one H, two M; no rework of the architecture).
CI run 39003674400 green on Chromium, Firefox, WebKit.

## Experiments (temporary files, deleted)

- E1 jsdom, partial hydration: Root + Item a hydrated, b/c in a pending Suspense boundary.
  Pre-hydration `c.checked = true`, then click hydrated `a`, then open the gate. Result: the
  boundary stays dehydrated (same DOM node), two dispatches (`activate +a`, `platform +c`), no
  console output. Partial hydration holds up.
- E2 jsdom, uncontrolled `defaultValue=[]`, Parent `values=[a, ghost]`, Item a only. Parent click
  -> `{a, ghost}`; `form.reset()` -> `{ghost}` (dispatch `removed: [a]`). Reset does not return to
  `defaultValue`. BUG (M1).
- E3 jsdom, SSR `defaultValue=[a,b,c]` + Parent over all; before hydrate set `c.checked=false` and
  Parent `.checked=false` (what Firefox restores after the user unchecked c and reloaded).
  Result: one platform dispatch `removed: [a,b,c]`, DOM all unchecked. BUG (H1).
- Playwright, plain HTML, uncheck then `reload()`: Firefox restores a nameless checkbox
  (`parent: false`), does NOT restore one with `autocomplete="off"`; Chromium restores nothing on
  reload. So E3 is real in Firefox and `autocomplete="off"` is a working fix.
- Chromium CDP AX dump: native `required` checkbox -> only `invalid: "true"`; `aria-required="true"`
  checkbox -> no `required` property either. Deviation 4 is a CDP/Blink fact, not a test bug. What
  AT actually hears (IA2/UIA/AX API) is unverified.

## Findings

H1 parent.tsx:272-283 (+ libraryProps 307-324). Firefox form-state restoration of the Parent is
misread as a pre-hydration click. Scenario: form with Parent over [a,b,c], server default all
checked; user unchecks c (Parent goes mixed, DOM checked=false), reloads in Firefox. Firefox
restores Items {a,b} and Parent checked=false; derived checked=true != false -> reportParent
"uncheck all" -> group ends {} and valueChangeAction gets `removed:[a,b,c]`. Fix: render owned
`autoComplete="off"` on the Parent (it is never a value, so nothing to restore); add a jsdom row
asserting the attribute and a design 8.1 note. Could also be a Firefox browser row via a
same-document navigation if feasible.

M1 root.tsx:255-262, 280. Deviation 1 (lay platform reads over base()) is right for readCurrent
and for controlled reset, wrong for uncontrolled reset: values with no Item (documented for
Parent values) survive a reset. Fix: in uncontrolled mode readDefault starts from `defaultSet`
(then overlay Items' defaultChecked, which mirror it anyway). Test: E2 as a row.

M2 parent.tsx:289-294, browser test 195-196. Parent "check all" checks disabled Items. A
disabled box is one the user may not change; "select all" changes it, the action saves it, and
in a form it never posts (disabled), so `next` != FormData. Also the Parent can never show
checked over a disabled unchecked Item without changing it. Design question for the PO (Base UI
leaves disabled children alone, as far as I recall - verify). If accepted: at click time filter
values whose Item is `:disabled` (DOM read in the handler); derivation over enabled values needs
render-time knowledge (Item registration or document as a limitation).

L1 root.tsx:336. `required && optimistic.size === 0` counts values with no Item and checked
disabled Items: a controlled `["ghost"]` or a checked disabled Item removes `required` while no
enabled box is checked -> form submits with no entry for `name`. Document (or exclude in a
handler-time DOM check; render cannot know).
L2 Known gap (controlled Parent reset desync): agree, rare. Fix sketch: Parent in group mode
re-applies `el.checked = checked` in a microtask after the form's reset (own useFormReset) when
no dispatch followed. Same desync if the Parent mounted later than the Items with another value.
L3 root.tsx:297-298 comment "After every commit (Items may move without the Root re-rendering)"
is wrong: a deps-less effect runs only when the Root commits. Items reordered by a child that
re-renders alone leave `state.value` in stale order until the next Root render. Fix comment /
JSDoc ("as of the Root's last render").
L4 docs CheckboxGroupPage.tsx:394 "each box is announced as required (Chromium reports them as
invalid)" and browser test :396-397 "which is what assistive technology hears": unverified
claims. Say: engines expose the native constraint differently (Chromium: invalid); the reliable
announcement is the Label text / aria-describedby.
L5 sync-presence.ts duplicates RadioGroup's private helper (deviation 3). Hoist to
internal/sync-presence.ts in a follow-up; fine for now.
L6 internal/use-native-group-reconciliation.test.tsx has no `equals` row; only covered through
CheckboxGroup. Add one (new Set, same members -> no dispatch; default Object.is still dispatches).
L7 Docs transition default: CheckboxGroup "–" is right (deviation 5). Stale '"none"' also on
SwitchPage.tsx:96 and DialogPage.tsx:254, not just RadioGroupPage.tsx:176 and CheckboxPage.tsx:107.
L8 APG mixed-state example puts `aria-controls` (ids of controlled boxes) on the mixed checkbox.
It passes through; docs could show it. Optional.
L9 Pre-hydration Item clicks after a Parent click are overridden by the Parent's semantic
(report applied after the DOM read). Acceptable; document in 8.1.

## Deviation judgements
1 accept for mount / controlled reset; wrong for uncontrolled reset (M1).
2 accept (render cannot read refs); fix the comment (L3).
3 accept, follow-up hoist (L5).
4 accept, verified; docs overclaim (L4).
5 accept; four other pages stale (L7).
6 accept.

## Design-doc corrections
- 8.1/8.2: readCurrent lays Item reads over base(); readDefault does so only when controlled,
  uncontrolled starts from defaultValue (M1). Parent renders autocomplete="off" (H1).
- 7 table row C "AT announcement: each box required" -> engine-dependent; Chromium exposes
  `invalid`, no `required` (even aria-required) in its AX tree. Row 34 of 13 -> `invalid`.
- 5.1 / 3.1 RootState.value: order is "as of the Root's last render", first render and server in
  value order.
- 6.2: decide disabled Items under a Parent (M2).
- 7: note under-blocking with Item-less values / checked disabled Items (L1).
- 14.5 libraryProps: add autoComplete "off".
- 14.6: duplicate warning from the Root's layout effect (fine).
