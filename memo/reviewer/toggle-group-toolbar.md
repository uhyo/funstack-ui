# Review: ToggleGroup and Toolbar (#66)

Commits reviewed: d5af7f5 (library), 5068d22 (playground), a621645 (docs). Against
`design/components/toggle-group.md` (accepted 2026-10-18), `design/conventions.md`, `docs/vision.md`,
`memo/developer/toggle-group.md`.

Verdict: **acceptable with minor fixes.** No must-fix findings. The value model, optimistic and
pending semantics, transition types, ARIA output and the jsdom/browser split all follow the design.
Three should-fix items concern the native `focusgroup` path and the claim that the JS and native
paths behave the same. I found and confirmed them with a standalone Playwright probe against
Chromium (focusGroup in the prototype). The rest are test gaps and nits.

Checks run on a621645: `vitest --project jsdom` on toggle-group, toolbar, use-roving-focus and menu
(230/230 pass); `vitest --project browser` on toggle-group and toolbar (20/20 pass on the locally
installed engines); `pnpm typecheck`; `pnpm lint` (clean).

## Findings

### Should-fix

1. **First entry skips `aria-disabled` on the JS path but not on the native path.**
   `packages/ui/src/toolbar/toolbar-root.tsx:44` (`firstEnabled`). Probe: in Chromium, with
   `focusgroup="toolbar inline wrap"` and `<button aria-disabled="true">` as the first item, Tab
   from outside lands on the aria-disabled button. The JS engine lands on the second item. Design 8
   requires the two paths to agree or the divergence to be recorded. `memo/developer/cross-engine.md`
   says "agree on every row tested", but this row was never tested (the browser `Editor` starts with
   an enabled `Cut`). Fix: either drop the skip (simplest; design 6.2 said "first enabled item",
   where items already exclude `:disabled`) or keep it and record the divergence in cross-engine.md
   and on the docs page. In both cases, add a browser row with an aria-disabled first item.
   APG's "first control that is not disabled" supports the skip, so keeping it is defensible. The
   problem is the false claim of parity.

2. **`release()` deletes a `tabindex` the consumer rendered, which can make an item unfocusable.**
   `packages/ui/src/internal/use-roving-focus.ts:161-168` (and `:195-197` for an element that leaves
   the container). On hydration the server snapshot gives `native=false`. The first layout effect
   then writes `tabindex` on every item, including one that is focusable only through its own
   `tabindex="0"` (for example `<div role="spinbutton" tabIndex={0}>`, a custom slider, any
   `[tabindex]` widget). When `native` turns true, `release()` calls `removeAttribute("tabindex")`.
   React still believes it rendered `tabIndex={0}`, so it never writes it back. The probe confirms
   that Chromium's focusgroup does not reach a `div role=spinbutton` without `tabindex`. The result
   is that a control in an SSR page with `experimental_focusgroup` in Chromium becomes unreachable
   by keyboard. Fix: record the attribute value seen before the first write (a `Map<HTMLElement,
   string | null>` instead of the `Set`) and restore it in `release()` and when an element leaves
   the container. Add a jsdom unit test (render with `native=false`, then switch it on with a
   `[tabindex="0"]` div item).

3. **A native radio group inside a Toolbar diverges between paths.** Probe: under Chromium's
   `focusgroup="toolbar"`, ArrowRight on a radio stays inside the radio group and checks the next
   radio, wrapping within the group (the radio keeps its arrows). On the JS path
   (`use-roving-focus.ts:89-113`), `radio` is in `BUTTON_LIKE_INPUTS`, so the toolbar handles the
   arrow with `preventDefault()`. That moves focus to the next radio without checking it and then
   walks out of the group. This also contradicts the radio pattern, where arrows select. The APG
   Toolbar example contains a radio group, so this is a realistic case, and FUNSTACK `RadioGroup`
   (native radios) hits it. The design does not cover it. Recommendation: ask the architect for a
   decision, and track it as a GitHub issue in this repo. The likely answer: treat
   `input[type=radio]` and `role=radio` as arrow-owning (6.3 rule, Tab moves to the next item),
   which matches native. Add a browser row on both paths.

4. **`ToolbarContext` leaks into popups that render inside a Toolbar.** This is the developer's
   known limitation, but it is wider than they describe. A standalone ToggleGroup inside a
   Popover/Dialog/Menu popup within a Toolbar runs no engine, and the Toolbar's engine excludes
   popup content, so every Item becomes its own Tab stop. In addition, a `Menu.Trigger` inside such
   a popup in a vertical Toolbar (`menu-trigger.tsx:88-93`) loses ArrowDown/ArrowUp opening and
   opens on ArrowRight, although it is not a toolbar item. `Toolbar.Separator` there also takes the
   toolbar's orientation. Fix: the overlay popup parts provide `<ToolbarContext value={null}>`
   around their content (one line each in Popover/Dialog/Menu popup, mirroring the engine's
   `[popover]`/`dialog` exclusion). It is rare, so a GitHub issue is fine if it does not fit this
   round.

5. **Test gap: rollback re-basing is not tested.** Design row 5 asks for "stacked patches re-base
   when 1 rejects" (5.2: Bold's save rejects, Italic stays pressed). The test titled "stacked
   patches re-base: Italic stays pressed while Bold's save is still in flight"
   (`toggle-group.test.tsx:387`) resolves both and checks that a controlled group that is never
   updated reverts both. That is a different behaviour, and no test covers the rejection. The vision
   asks for `useOptimistic` that reconciles correctly on rejection. Add the case, for example with
   an `ErrorCatcher` placed outside a wrapper that keeps the group mounted, or with `catchErrors` in
   the harness so the second patch stays.

6. **Browser coverage of the native path is thinner than row 20 implies.** Only the horizontal
   `wrap` token runs on native Chromium. Not covered on either path in a real engine:
   `orientation="vertical"` (`block`), `loop={false}` (`nowrap`), and a `Menu.Trigger` in the
   Toolbar (native suppression of the move through `preventDefault()`, design 7.4, plus menu items
   inside the toolbar subtree under a native focusgroup). Add one vertical/nowrap row and one Menu
   row to `toolbar.browser.test.tsx` under the existing `describe.each` over the flag. Findings 1
   and 3 show that the "no divergence" result came from the cases tested.

### Nits

7. Owned-handler typing is inconsistent. `ToolbarRootProps` omits `onFocus` and `onPointerDown`
   but not `onBlur` (`toolbar-root.tsx:16-26`), although the engine also owns `onBlur`.
   `ToggleGroupRootBaseProps` omits only `onKeyDown` (`toggle-group-root.tsx:51-54`), as the design
   says. Handlers merge (both run), so nothing breaks. Pick one rule (Tabs.List omits its owned
   handlers) and update the docs sentences (ToolbarPage "are the library's", ToggleGroupPage "except
   role and onKeyDown").
8. `useDevWarning(inToolbar && focusgroupProp !== undefined, …)` (`toggle-group-root.tsx:217`) also
   warns for an explicit `experimental_focusgroup={false}`. The same applies to
   `orientation="horizontal"` inside a horizontal toolbar. This is harmless, but a shared group
   component that forwards defaults will warn. Consider `=== true` for the flag.
9. Row 15 (`toolbar.test.tsx:578-604`) asserts that the menu opens on ArrowRight/ArrowLeft in a
   vertical toolbar, but not that the **first item** has focus, which is the part of 7.4 that
   differs from Enter.
10. `ToolbarVertical.tsx` and the ToolbarPage text tell readers to use `side="right"` for a
    vertical toolbar's menu, yet in RTL the trigger opens on ArrowLeft while the popup still sits
    on the right. Mention `side="left"` (or an inline-end side, if the anchor API has one) for RTL.
11. ToolbarPage has no reduced-motion block (design 10, "the conventions 5.4 block in every
    example"). ToggleGroupPage has one. Toolbar.Button has `transition`, so add it.
12. Design doc drift to record on the architect's side (no code change): 3.1 owned keys
    (`onBlur`, the standalone handlers), 6.2 `memory: false` semantics (focused item while inside),
    the `WeakSet` to `Set` change in 16.7, `focusgroupstart` whenever the flag is on (16.2 vs row
    16), and the `enabled` option.
13. Tooltip's #57 composite-role check does not know `role="group"`. As the developer notes, it
    runs before the engine writes, so it does not fire today. Record it in a GitHub issue so the
    check does not start firing if Tooltip's check timing changes.

## The developer's deviations

1. **onBlur, so the focused item is the stop while focus is inside a standalone group:
   acceptable, and better than the literal design.** Taken literally, `memory: false` would put
   Tab from an unpressed Item onto the pressed one, which is still inside the group. The
   implementation matches native `nomemory` + `focusgroupstart`, and both the jsdom and browser
   tests cover leaving from an unpressed Item. Window blur (`relatedTarget` null) resets the stop,
   and the next focus event restores it. Correct.
2. **Engine shape:**
   - `enabled`: acceptable (it lets the hook run unconditionally).
   - `Set` with cleanup: acceptable and needed (a stale `0` on a button that is disabled and later
     re-enabled). See finding 2: it should keep the original value, not only membership.
   - `tabindex` removed when native turns on after hydration: the right idea, wrong restore (finding 2).
   - popover elements excluded: acceptable (a `Menu.Popup` is `[popover][tabindex=-1]`).
   - options passed through an insertion effect: acceptable; this is the `useLatest` idiom
     (`internal/use-latest.ts`) and it is ordered before the layout-effect `apply`.
3. **Item order from state refreshed in a layout effect: acceptable.** It is the CheckboxGroup
   precedent and avoids reading refs during render. It costs one extra sync render at mount when
   the value's own order differs from the DOM order. The order only refreshes on Root commits; an
   Item reordered by a child-only render updates `state.value` order on the next Root commit. That
   is acceptable, since `next` is always sorted from the DOM at dispatch.
4. **`focusgroupstart` whenever the flag is on: acceptable, and preferable.** Server and hydration
   markup stay identical whatever the engine (conventions 8), as in Tabs. The attribute is inert
   elsewhere.
5. **First entry skips aria-disabled items: not acceptable as shipped** (finding 1). The behaviour
   is defensible under APG, but it diverges from native and the divergence is unrecorded.
6. **`deselectable?: never`: acceptable.** Confirmed: with no discriminant present, TypeScript does
   not treat `deselectable` as excess on the union. The `@ts-expect-error` test covers it.
7. **A disabled link `Toolbar.Button` calls preventDefault: acceptable**, and correct for a
   focusable-disabled control.
8. **Row 22 clicks an enabled button: acceptable.** Row 22 does not ask for aria-disabled. The
   pointerdown path is only isolated in WebKit, which runs on CI, so CI coverage is required for
   that row.

Known limitations: popup in Toolbar, see finding 4 (wider than stated; small fix). Tooltip #57, see
nit 13.

## Areas checked and found conformant

- **APG Toolbar:** `role=toolbar`, `aria-orientation` always emitted, one Tab stop with memory,
  arrows by orientation and mirrored in RTL (`getComputedStyle(root).direction`, horizontal only),
  Home/End, `disabled` skipped, `aria-disabled` reachable and non-dispatching, text-entry items keep
  their arrows and Tab moves between items from them, keys the item already handled are ignored
  (`defaultPrevented`), modifier keys ignored.
- **Toggle button group:** `aria-pressed` always "true"/"false" from optimistic state; no
  `aria-orientation` on `group`; arrows never press; entry on the first pressed enabled Item.
- **Async semantics:** every press goes through `useControllableAction` (transition, optimistic
  patch reducer computed against the optimistic set, latest-wins commit, superseded rejection
  surfaced). Per-Item `data-pending` follows design 5.3. Exclusive no-op with `deselectable={false}`.
  Types `fsui-toggle-group`, `-press` and `-release` are tested. `Toolbar.Button` uses
  `useActionTrigger` with its own `data-pending`. Suspending-content row 7 runs under `renderBoth`.
- **`Menu.Trigger`:** the vertical-toolbar branch opens on the inline-end arrow (RTL from the
  trigger), calls `preventDefault` so the toolbar does not move, and leaves ArrowDown/ArrowUp
  alone. Horizontal toolbars and menus outside a toolbar are unchanged and tested.
- **Docs props tables** match the TypeScript declarations (Root's two variants, Item, Root, Button,
  Separator, and the state shapes), apart from nit 7. The examples are correct. The controlled
  examples use the functional update or are exclusive with a fixed `fakeSave` delay, so they cannot
  reorder.
- **Directives, subpath exports, tsdown entries and root re-exports** are all present.
