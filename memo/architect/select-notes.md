# Architect notes: Select (#50), 2026-10-17

Working notes behind `design/components/select.md`. Not a spec.

## Probe run for this design

`memo/architect/probes/select-refresh-probe.mjs` (Chromium 156 headless via the ui package's
Playwright; WebKit still cannot launch locally). Output in `select-refresh-probe.output.txt`.
What it settled:

| Case | Result |
| --- | --- |
| 1–3 | `select.value = select.value` with the picker open: stays `:open`, `activeElement` stays on whichever option the user had moved to, no `input`/`change`, `<selectedcontent>` refreshed with mutated content. Escape afterwards still returns focus to the select. |
| 4 | Append an option while open, then `newOption.selected = true`: stays open, value and `<selectedcontent>` move to it, focus stays on the previously focused option. |
| 5 | Closed: `option.selected = true` on a different option updates `<selectedcontent>` (selection change). Same-option write does not (researcher's D2). |
| 6 | `defaultSelected = true` on a **non-dirty** option selects it (b parser-selected → a). After `b.selected = true` (b dirty) a `c.defaultSelected = true` still moves the selection to c (dirtiness is per option: c was non-dirty). `defaultSelected = false` on a dirty selected option leaves it. `form.reset()` goes to the last `defaultSelected` option. |
| 7 | `select.value = "nope"` → `selectedIndex -1`, `<selectedcontent>` empty; `select.value = ""` → placeholder selected. Hence the `selectedIndex !== -1` guard on the refresh. |
| 8 | MutationObserver (subtree, childList, characterData, attributes): text change inside the option → `childList@I<OPTION`; refresh → `childList@SELECTEDCONTENT<BUTTON`; `data-pending` on the option → `attributes@OPTION<SELECT`. Filtering by `closest("option")` / `closest("selectedcontent")` and excluding attribute records on the option element itself is enough; no loop. |
| 9 | ArrowDown on a focused closed base-select opens the picker (`focus,blur` logged: focus leaves the select for the option). |
| 10 | Replacing the selected option element while open (what a React `key` change does): selection falls to the placeholder and `activeElement` becomes `body` while the picker stays open; after `selected = true` on the replacement the value and content are right but focus is still lost. Reason to refresh in place rather than remount. |

## react-dom 19.3.1 reads

- `setInitialProperties` select branch: `value != null ? updateOptions(el, multiple, value, false) : defaultValue != null && updateOptions(el, multiple, defaultValue, true)`. So a controlled select never gets `defaultSelected` on a client render; only `defaultValue` writes it. SSR writes the `selected` attribute on the match (Fizz), so SSR'd and client-rendered controlled selects reset to different options unless the library mirrors.
- `updateProperties` select branch: `value != null → updateOptions(value, false)` on every update of the select element; else if `!!lastDefaultValue !== !!defaultValue` re-applies the default. Confirms "updateOptions runs only in the select's own commit".
- `restoreControlledSelectState`: `value != null → updateOptions(target, multiple, value, false)`. The same post-event restore as inputs; the reason for `value={optimistic}`.
- `updateOptions` (single): first option with equal `value` gets `selected = true` (and `defaultSelected` when asked) and returns; with no match, the first non-disabled option is selected. With only a disabled fallback present nothing is selected (C2: `-1`).

## Decisions I expect to be questioned

- **`value: string`, not `string | null`.** Conventions 3.1 says "none selected is `null`", but `select.value` is a string and the empty state of a single select is an option (the HTML placeholder label option, which `required` validates against). `null` would be a second spelling of `""`. Raised as question 1.
- **Refresh via MutationObserver in `Select.Value`** rather than in the Option's effect: the Option's effect misses a Suspense boundary resolving inside the option and memoised subtrees; the "change the key" recipe loses focus while open (case 10). Observer is skipped where `HTMLSelectedContentElement` is undefined.
- **Hydrated vs created late options** with `useSyncExternalStore`'s server snapshot. The problem: React never applies `value` to options mounted after the select's commit, so (iii) client-created late options are auto-selected to the first option by the browser (not a user intent, must not dispatch) while (ii) server-streamed late options can carry a real pre-hydration pick (must dispatch). The DOM alone cannot tell them apart (both look like "selected ≠ base"); the `selected` attribute left by Fizz is a weaker tell (absent when the server value matched nothing). The server-snapshot read during a hydration render is React's own answer. To verify in implementation: the mount layout effect of a hydrating Option sees the render that used the server snapshot (the consistency re-render is scheduled from a passive effect, `updateStoreInstance`).
- **Platform dispatch gate: the intended option must exist.** Without it, controlled `value="c"` with Suspense-loading options would dispatch the fallback at mount. Implemented as `readCurrent()` returning the base when the option is absent, so the shared adapter's compare is a no-op without a new option on it.
- **`defaultSelected` mirror before re-apply, same synchronous step.** Case 6: a mirror write on a non-dirty option moves the selection; re-applying `.selected = true` on the target restores it before paint. Writes only when the property differs.
- **No `transition` on any part.** First component with none; Menu's items set the precedent ("optimistic flip that never animates"). PO decision 4 already rules out a value-change VT; an `<option>` boundary inside the UA picker would animate nothing.
- **`Group label` required + optional `GroupLabel`** instead of one part: HTML requires the attribute; Firefox and AT read it; `<legend>` is base-select-only rendering.
- **Trigger and Value optional, not generated.** The UA button shows option text without them; generating them would put hydration-sensitive markup in every Select.

## Things to verify during implementation

- `useSyncExternalStore` server snapshot inside a late-hydrating Suspense boundary (and after a hydration mismatch fallback, which should read as created).
- Order of commit mutations: option text update lands before the select's `updateOptions` in the same commit (children first), so a selection change in the same commit clones the new content; otherwise the observer refresh covers it anyway.
- Fizz writes `selected` on the matching option inside a Suspense boundary within a `<select>` (the format context's `selectedValue` should propagate); affects only whether the streamed segment is already on the right option before the late re-apply.
- jsdom: `HTMLSelectedContentElement` undefined (observer skipped); `form.reset()` honours `defaultSelected`; `user.selectOptions()` fires `change` React sees; `renderToString` of `<selectedcontent dangerouslySetInnerHTML>` emits an empty element.
- WebKit: `<selectedcontent>` refresh timing (bug 325898) with the picker open; the nested `position-try` hang (302008) with a Select inside a Popover.
- Chromium: whether `select.value = select.value` clears the user-interacted flag (`:user-invalid`); the probe did not check. If it does, the refresh should skip while `select.matches(":user-invalid")`… or accept.
- `@types/react` intrinsic element augmentation for `selectedcontent` compiles under `verbatimModuleSyntax` and reaches `dist` (same mechanism as the attribute augmentation).

## Status

Design written and committed as proposed; eight questions for the product owner at the end of
the document; conventions changes listed under "Conventions feedback" to apply on acceptance.
