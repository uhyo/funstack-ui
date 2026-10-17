# Popover and Menu (menu button): platform features

Research date: **2026-10-17**. Support data from MDN browser-compat-data 8.1.6 (timestamp
2026-10-15), the Chromium `runtime_enabled_features.json5` of the M155 branch (8059) and `main`,
wpt.fyi stable runs (Chrome 155.0.8059.84, Firefox 157.0, Safari 27.0; 2026-10-06 to 10-16), the
WebKit and Mozilla standards-positions data, Bugzilla (Mozilla, WebKit) and the live HTML spec.
Behaviour was verified with Playwright probes on Chromium 156 and Firefox 157
(`memo/platform-researcher/probes/10-popover-menu/`). WebKit still cannot launch locally, so its
column comes from BCD, WPT and bug trackers, not a probe.

| Engine | Stable release | Date |
| --- | --- | --- |
| Blink | Chrome 155 (155.0.8059.85) | 2026-10-06 |
| Gecko | Firefox 158 | 2026-10-13 |
| WebKit | Safari 27.0 | 2026-09-14 |

Related issue: GitHub #37. Builds on [popover-anchor-tooltip.md](./popover-anchor-tooltip.md)
(Popover API, `hint`, `interestfor`, anchor positioning, React attribute support) and
[dialog.md](./dialog.md) (close requests, "no portals", animation, toggle events). Those findings
are not repeated here.

## Summary

Everything a **Popover** and a **Menu** need for layering, stacking, dismissal and placement is
Baseline in all three engines: `popover="auto"`, nested auto popovers, light dismiss, Escape,
Invoker Commands (`commandfor` + `toggle-popover` / `show-popover` / `hide-popover`), the
implicit anchor, `ToggleEvent.source`, and CSS Anchor Positioning with `position-try-fallbacks`.
A menu built on them needs **no portal, no z-index, no outside-click listener, no Escape handler
and no positioning JS**.

There is **no native menu**. The keyboard model of the APG menu pattern stays in JS: arrow keys,
Home/End, typeahead, submenu open/close with ArrowRight/ArrowLeft, Tab closing the menu, and
moving focus into the menu on open. Chromium's `focusgroup="menu"` covers the arrow keys and is a
candidate for an experimental flag. The Open UI `<menulist>` / `<menuitem>` proposal is behind
an `experimental` Chromium flag and has no Gecko or WebKit position. It is not usable.

Probes found five things that affect the design:

1. **Submenus do not get focus back.** When a nested auto popover closes, focus is not restored
   to its invoker: it lands on `<body>` in Chromium and Firefox. The spec does this on purpose,
   because only the first popover in a stack restores focus. The library must move focus back to
   the parent item itself.
2. **An auto popover stays open when focus leaves it.** Tab out of a menu leaves it open in both
   engines, so APG's "Tab closes the menu" is library JS.
3. **`interestfor` does not fit submenus.** It opens the submenu on keyboard focus, and one
   Escape then closes the whole menu stack. Neither matches APG. Hover-to-open has to be JS.
4. **A library-driven open or close inside a React transition can be animated by
   `<ViewTransition>` in Firefox too.** CSS cannot animate a popover's exit there. This applies
   when the popover element is wrapped in `<ViewTransition>` and `showPopover()` /
   `hidePopover()` run in a layout effect. Menu-item activation is the dominant way a menu closes
   and is library-driven, so Menu can offer a real exit animation in every engine.
5. **`<dialog popover>` is a good Popover element, with one Chromium bug.** The dialog focusing
   steps run on open (in Chromium and Firefox), and the role is `dialog`. But Chromium exposes
   it as **modal** in the accessibility tree. `aria-modal="false"` fixes that.

Two **library bugs / corrections** came out of this research (see "Corrections"):
`"focusgroup" in HTMLElement.prototype` is always false, because the IDL attribute is
`focusGroup`, so Tabs' `experimental_focusgroup` never takes its native path. Also, BCD's note
that `showPopover({ source })` "does not change focus order" is stale: it does in Chromium 156
and Firefox 157.

### Verdicts

| Feature | Verdict | Reason |
| --- | --- | --- |
| `popover="auto"` for Popover and Menu (top layer, light dismiss, Escape, one-at-a-time stack) | **Adopt** | Chrome 114, Firefox 125, Safari 17. |
| Nested auto popovers for submenus (DOM child, or nested through the invoker / `source`) | **Adopt** | Same versions. Verified: sibling submenus close each other, Escape closes only the topmost, and an outside click closes the whole stack. |
| Invoker Commands `toggle-popover` / `show-popover` / `hide-popover`, cancelable `command` event | **Adopt** | Chrome 135, Firefox 144, Safari 26.2. Declarative trigger that works before hydration, plus a hook the library can intercept. |
| `ToggleEvent.source`, popover `beforetoggle` (open cancelable) / `toggle` | **Adopt** | `source`: Chrome 140, Firefox 145, Safari 26.5. |
| Implicit anchor (`commandfor`, `popovertarget`, `showPopover({ source })`) + `position-area` + `position-try-fallbacks` | **Adopt** | Chrome 133/135, Firefox 147, Safari 26/26.2. `position-anchor` initial value `normal` in all three since Chrome 151 / Firefox 151 / Safari 27. |
| Platform focus return to the invoker (first popover in a stack) | **Adopt** | Verified in Chromium and Firefox. Safari 27.0 passes the basic WPT (`popover-focus.html` 30/30). |
| Focus return for **submenus** | **Not provided by the platform** (spec) | The library restores focus to the parent item. |
| `<dialog popover>` as the Popover element | **Adopt, with `aria-modal="false"`** | Dialog focusing steps + `dialog` role. Chromium exposes it as modal without the attribute. |
| `<ViewTransition>` around a library-opened/closed popover | **Adopt** (library-driven open/close only) | Enter and exit animate in Chromium 156 and Firefox 157 (React 19.3.1). Browser-initiated closes (Escape, light dismiss) never go through React. |
| `@starting-style` + `allow-discrete` (+ `overlay`) | **Adopt** (exit is progressive enhancement) | As in dialog.md: Firefox closes instantly. |
| `focusgroup="menu"` (native arrow keys, Home/End, wrap) | **Adopt behind experimental flag** | Chromium only (flag `Focusgroup` is `stable`; Mozilla positive, meta bug 2070976 NEW; WebKit position open). No typeahead and no submenu keys, so the JS stays. |
| `interestfor` for hover-opened submenus | **Not yet** | Chromium only, and the semantics conflict with APG (opens on focus; one Escape closes all levels). |
| `popover="hint"` for menus | **Not applicable** | A menu must be `auto`. Tooltips over menus stay `manual` / `hint` (Tooltip design). |
| Anchored container queries (`container-type: anchored`, `@container anchored(fallback: …)`) | **Not yet** | Chrome 143 only. Would let an arrow or a submenu chevron follow a `position-try` flip. |
| Open UI menu elements (`<menubar>`, `<menulist>`, `<menuitem>`, `<menuitemcheckbox>`, `<menuitemradio>`, `<submenu>`) | **Not yet** | Chromium flag `MenuElements` is `experimental` (M155 and `main`). WebKit SP #580 and Mozilla SP #1317 have no position. TAG review #1242 is open. |
| `<menu>` element | **Do not use for menus** | It is a list (`role="list"`), not `role="menu"` (Open UI explainer, HTML-AAM). |

## Support table per engine

"Stable today" is the release listed at the top. Rows already in
[popover-anchor-tooltip.md](./popover-anchor-tooltip.md) are not repeated unless something changed.

| Feature | Chrome | Firefox | Safari | Notes |
| --- | --- | --- | --- | --- |
| `popover` (auto/manual), `:popover-open`, `beforetoggle`/`toggle` | 114 | 125 | 17 | |
| `togglePopover({ force, source })` / `showPopover({ source })` | 137 | 144 | 26 | Earlier partial versions did not change the focus order. Verified that 156/157 do. |
| `command` / `commandfor` (incl. `toggle-popover`, `show-popover`, `hide-popover`), `CommandEvent` | 135 | 144 | 26.2 | `HTMLCommandActionsV2` (more built-in commands) is `test` in Chromium. Custom `--foo` commands are Baseline. |
| `commandfor` implicit anchor | 135 | 147 | 26.2 | |
| `ToggleEvent.source` | 140 | 145 | 26.5 | |
| `position-area`, `position-try-fallbacks`, `@position-try` | 129 / 128 / 125 | 147 | 26 | Single-keyword `bottom`/`top` etc. overflowed the viewport before Chrome 144 / Firefox 148 (BCD partial). Fixed in stable. |
| `position-anchor` with initial value `normal` | 151 | 151 | 27 | Earlier versions had `auto` / `implicit` as the initial value. The implicit anchor works either way. |
| `container-type: anchored`, `@container anchored(fallback)` | 143 | – | – | |
| `focusgroup` (incl. `menu`, `menubar`) | 150 (`Focusgroup` stable) | – | – | IDL attribute is **`focusGroup`**. `FocusgroupV2` (grid) is experimental. |
| `interestfor` | 142 | – | – | See the tooltip doc. |
| Menu elements (`<menulist>` etc.) | flag `MenuElements` experimental | – | – | `document.createElement("menulist")` is `HTMLUnknownElement` in Chromium 156 and Firefox 157 (no flag). |
| `startViewTransition` (same-document) | 111 | 144 | 18 | `types`: 125 / 147 / 18.2. |
| `Element.ariaActiveDescendantElement` | 135 | 136 | 16.4 | Only relevant if `aria-activedescendant` is chosen; not recommended (below). |

WPT (stable runs, `html/semantics/popovers/`): Chrome 3902/3918 subtests, Firefox 3876/3902,
Safari 3042/3921. Most of the Safari gap is `popover="hint"` (700 subtests). The Safari failures
that matter for menus are listed under "Cross-engine gaps".

## Findings

### Stacking and nesting (verified, Chromium and Firefox identical)

Menu: a trigger with `commandfor="m" command="toggle-popover"`, `#m` `popover="auto"`, and three
submenus.

| Action | Result |
| --- | --- |
| Open a submenu that is a DOM child of the menu | Menu and submenu open. |
| Open a submenu that is **not** a DOM child, via a `commandfor` button inside the menu | Menu stays open (nesting through the invoker). The previously open sibling submenu closes. |
| `showPopover()` on a non-child submenu **without** `source` | **Closes the menu.** |
| `showPopover({ source: item })` on the same submenu | Menu stays open. |
| Escape with a submenu open | Only the submenu closes. A second Escape closes the menu. |
| Click outside | Whole stack closes. |
| Click an item of the parent menu while a submenu is open | Only the submenu closes. |
| `showPopover()` on an unrelated auto popover | Whole stack closes. |
| Click the trigger while open | Closes; it does not light-dismiss and then reopen. |

Rule: **always open popovers with an invoker or `source`.** Then the DOM position of the submenu
does not matter, and opening it does not close its parent. It also sets the implicit anchor, so
`position-area: span-block-end inline-end` places a submenu beside its item with no
`anchor-name` (verified: the submenu's left edge equals the item's right edge).

The dialog doc's rule still applies: **no portals**. Inside a modal `<dialog>`, a menu outside
the dialog's subtree is inert.

### Focus (verified, Chromium and Firefox identical)

| Case | Result |
| --- | --- |
| Open with Enter on the trigger | Focus **stays on the trigger**. A popover does not move focus unless something inside has `autofocus`. |
| `autofocus` on an item before opening | That item gets focus. |
| Tab from the trigger while open (popover far away in the DOM) | Focus goes into the popover's first focusable element, then on to the element after the trigger. Also true for `showPopover({ source })`. |
| Tab past the last item | Focus leaves; **the popover stays open**. |
| Escape / `hidePopover()` / `command="hide-popover"` with focus inside | Focus returns to the element that was focused when the popover opened (the trigger). |
| Same, but the popover was opened by script while focus was elsewhere | Focus returns to *that* element, not to the `source`. |
| Light dismiss by clicking another button | Focus goes to the clicked button; nothing is restored. |
| **Escape in a submenu** (nested auto popover) | Submenu closes, **focus goes to `<body>`**. Same for invoker-nested and DOM-child submenus. |

The submenu case follows the spec. "Show popover" sets `shouldRestoreFocus` only if no auto or
hint popover was already showing: "focus is returned to the previously-focused element only for
the first popover in a stack" (HTML, popover show steps). The library must listen to the
submenu's `toggle` (closed) and, if focus was inside the submenu or is now on `<body>`, focus the
submenu's parent item. ArrowLeft-to-close is library code anyway, so it can do the same.

Safari 27.0 fails the WPT for Tab from an invoker into a popover elsewhere in the DOM
(`popover-focus-2.html` 0/3, `popover-focus-4.html` 0/3). It passes `popover-focus.html`
(30/30, focus return). Firefox and Safari fail some `popover-focus-5.html` subtests, but only
for `<details>`, `delegatesFocus` and slotted content. Consequence: a Popover must not rely on
"Tab from the trigger enters the popup" in WebKit. Rendering the popup right after the trigger in
the DOM makes the order correct in all engines, and it also removes the `aria-details` relation
(next section).

### Accessibility mapping

Chromium 156 accessibility tree (CDP):

- **Invoker.** `popovertarget` and `commandfor` + `toggle-popover` invokers get `expanded=false`
  / `expanded=true` automatically. While the popover is open and is not the next sibling, they
  also get a `details` relation. HTML-AAM requires both. With `aria-haspopup="menu"` on the
  trigger and `role="menu"` on the popover, Chromium shows
  `button "…" hasPopup="menu" expanded=true` and `menu "…" orientation=vertical`.
- **Popover role.** `<div popover>` maps to `group` (HTML-AAM "minimum role"). WebKit does not
  implement the minimum role: WPT `popover-minimum-role.html` 0/2, WebKit bug 284230 NEW. WebKit
  also creates no implicit `aria-details` (bug 314812 NEW). **The library must set `role="menu"`
  / `role="dialog"` explicitly.**
- **`aria-expanded` and `aria-haspopup`.** No Gecko or WebKit bug documents the implicit
  `aria-expanded` mapping, so it is unverified there. The library should render `aria-expanded`
  itself, from the observed `:popover-open` state, and `aria-haspopup="menu"` on menu triggers.
  This is what APG specifies, it costs nothing, and an explicit attribute wins over the implicit
  one.
- **`aria-details` noise.** HTML-AAM suppresses it when the popover is the next accessibility
  sibling of the invoker. For a menu button it is redundant with `aria-controls` /
  `aria-haspopup`. Placing the popup immediately after the trigger avoids it.
- **`focusgroup="menu"` in Chromium** infers `role="menu"` on the container and `menuitem` on
  plain buttons. A `disabled` button stays `button` and is skipped by the arrow keys. APG wants
  disabled menu items focusable, so items should use `aria-disabled="true"`, not `disabled`.

### `<dialog popover>` for the Popover component

| | `<dialog popover>` | `<div popover role="dialog">` |
| --- | --- | --- |
| Focus on open (Chromium 156, Firefox 157) | First **sequentially focusable** descendant. Skips a `tabindex="-1"` heading, so it uses the spec's dialog focusing steps even in Chromium, which still uses the old algorithm for `showModal()`. With no focusable content, the dialog itself. | Stays on the trigger |
| Escape / focus return | Closes, focus to trigger | Same |
| `:modal` | false | false |
| Chromium AX | `dialog modal=true` (**wrong**; also with `popover="manual"` and when opened by `commandfor`) | `dialog` |
| With `aria-modal="false"` | `dialog modal=false` | n/a |

The HTML popover focusing steps say: "If subject is a dialog element, then run the dialog
focusing steps". That gives Popover the same initial-focus behaviour and `autofocus` story as
Dialog for free. The Chromium `modal=true` exposure would make screen readers treat the rest of
the page as inert while a non-modal popover is open. Always render `aria-modal="false"`. WebKit
behaviour of `<dialog popover>` was not verified.

Whether a Popover *should* move focus on open depends on its content. APG non-modal dialogs move
focus in. Disclosure-style popovers (a filter panel, an info card) often keep it on the trigger.
That is an API decision (open question 2).

### Keyboard: what stays in JS

APG menu button and menu patterns, compared with what the platform gives:

| APG requirement | Platform | Library |
| --- | --- | --- |
| Enter / Space / ArrowDown on trigger opens and focuses first item; ArrowUp focuses last (optional) | `toggle-popover` opens; focus stays on trigger | Focus the first/last item after open (or write `autofocus` before `showPopover`, as Dialog does). |
| Up/Down move, wrap optional; Home/End | `focusgroup="menu"` (Chromium only; wraps by default; Left/Right ignored; Home/End work) | JS roving tabindex everywhere else. |
| Typeahead (printable character moves to next item starting with it) | none (`focusgroup` has none) | JS. |
| ArrowRight opens a submenu and focuses its first item; ArrowLeft closes and returns to parent item (mirrored in RTL) | none | JS: `showPopover({ source: item })`, focus first item; on close, focus parent item (see the Focus section). |
| Escape closes the current menu and returns focus to its trigger | Top-level: yes. Submenu: closes, but focus is lost | Submenu focus restore. |
| Tab closes all menus and moves on | Moves focus, menus stay open | Close the stack on `focusout` leaving the menu tree (`relatedTarget` outside all menu popovers). |
| Enter on item activates and closes the menu; Space on checkbox/radio items toggles (APG: menu may stay open) | none | JS (activation → action → close). |
| Disabled items focusable but not activatable | `focusgroup` skips `disabled` | `aria-disabled`. |
| Hover opens submenus (not APG, common UX) | `interestfor` does, but wrongly for keyboard | JS hover intent with delays. |

**Roving tabindex, not `aria-activedescendant`.** Use real DOM focus on the items:

- The popover focus-return logic checks whether focus is inside the popover.
- `focusgroup` (the experimental native path) is roving focus.
- Submenus need real focus to anchor the next `showPopover({ source })`.

`ariaActiveDescendantElement` is Baseline (Chrome 135, Firefox 136, Safari 16.4), but nothing
here needs it. It belongs to Combobox/Listbox, where focus must stay in the text input.

### `interestfor` as a submenu trigger (Chromium only)

Chromium 156; a fresh page per case. Results were the same for `interest-delay: 0s` and
`normal`, and for an `auto` or `hint` submenu.

| Case | Result |
| --- | --- |
| Hover item → hover sibling item | Submenu opens, parent stays open; then closes on leaving. Good. |
| Hover item → move into submenu → move to empty space | Stays open in the submenu, closes on leaving. |
| **Keyboard focus** on the item | **Submenu opens.** APG opens submenus only on ArrowRight/Enter/Space. |
| Escape after focus opened it | **Both** submenu and menu close; focus goes to the menu trigger. APG expects only the submenu to close and focus to return to the parent item. |
| Tab after focus opened it | Focus moves **into** the submenu (rich-hint focus order). APG expects Tab to close the menus. |

The hover behaviour is right, but the focus behaviour cannot be suppressed: `interest-delay-start`
applies to both pointer and focus. Since the feature is also Chromium-only, the cross-engine JS
hover intent is needed anyway. **Not yet** for Menu. Tooltip keeps its own flag.

### Open UI menu elements (future native menu)

The explainer (updated 2026-10-01) proposes `<menubar>`, `<menulist>` (an auto popover anchored to
its invoker, role `menu`), `<menuitem>`, `<menuitemcheckbox>`, `<menuitemradio>`, `<submenu>`,
`<fieldset>` groups and `<hr>` separators.

- **Invocation.** `command="toggle-menu"`. The invoker gets `aria-haspopup=menu` and
  `aria-expanded`, and no `aria-details`.
- **Keyboard.** Single tab stop, arrows, Enter/Space, Escape back to the invoker, Tab closes. An
  activation fires a `click`.
- **Open questions in the explainer.** Hover, typeahead, close-on-activate, `show-menu` /
  `hide-menu`, interactive content.
- **Status.** Chromium flag `MenuElements` is `experimental`. TAG review w3ctag/design-reviews#1242
  is open (July 2026). David Baron objected to changing the existing `<menu>` element. WebKit
  standards-position #580 and Mozilla #1317 have no position. No Gecko or WebKit implementation
  bug was found.

The proposal is useful as a **naming and semantics guide** for the library's API:

- separate checkbox and radio item parts rather than a `type` prop;
- radio groups scoped by a group part;
- activation closes the menu by default;
- disabled items stay focusable.

If it ships, `Menu` could later render native elements behind an `experimental_` flag.

### ViewTransition (React 19.3.1, vitest browser mode, Chromium 156 / Firefox 157)

Raw DOM first. `document.startViewTransition(() => popover.showPopover())` captures the popover
as `::view-transition-new(name)`, and `hidePopover()` captures it as
`::view-transition-old(name)`, in both engines. A top-layer element is snapshotted like any
other element.

With React, the popover opens and closes inside `startTransition`, and a `useLayoutEffect`
calls `showPopover()` / `hidePopover()`:

| Variant | Open commit | Close commit |
| --- | --- | --- |
| `<ViewTransition>` **wraps the popover element** (content static) | VT runs, `::view-transition-new(_t_)`, popover open when the update callback finished | VT runs, `::view-transition-old(_t_)` |
| `<ViewTransition>` inside the popover around content mounted on open | **No VT** (the boundary has no box while the popover is `display: none`) | VT runs, `::view-transition-old(_t_)` (exit) |
| No `<ViewTransition>` | none | none |

Results were the same in both engines. Consequences:

- **For the library-owned direction, `<ViewTransition>` must wrap the popup element itself, not
  its contents.** Then both enter and exit animate, and **the exit animates in Firefox**, where
  the CSS `allow-discrete` exit does not run.
- Browser-initiated closes (Escape, light dismiss, `command="hide-popover"` without
  interception) happen outside React and never get a VT. Only CSS can animate them.
- Conventions 3.5 say "`<ViewTransition>` does not apply to browser-owned open/close". That is
  still true, but a menu's **item activation → close** can be library-owned (the item's action
  runs in a transition, then `hidePopover()` in the commit). It is the dominant close path, so a
  VT exit there is worth having. The same holds for Dialog's "action then close"
  (`requestClose()` in a layout effect), which dialog.md and the Dialog design currently exclude
  from VT. Not probed for `<dialog>`.
- The #35 caveat applies unchanged: render `<ViewTransition>` only when the consumer passes
  `transition`, or every open pays the root cross-fade.
- During a VT the page does not receive pointer events (the transition root is hit-tested).
  Keep menu VT durations short.

### React 19.3 integration notes

- `popover` is special-cased. A **hydrated** element with a `popover` prop gets native
  `beforetoggle`/`toggle` listeners (react-dom 19.3.1 `hydrateInstance` and `setProp`). So,
  unlike `<dialog>` (react/react#37261), `onToggle` on a popover works after hydration. React
  19.3.1 still emulates bubbling of `toggle` (fixed on `main` by #37580, unreleased): a
  submenu's toggle reaches the parent menu's `onToggle`. Filter on `event.target`, or keep the
  conventions 7.4 native-listener pattern.
- `commandfor` / `command` remain untyped. Use the library's existing module augmentation and
  lowercase JSX names (tooltip doc).
- `command` is not a React event. Intercept it with `addEventListener` (cancelable, verified:
  `preventDefault()` keeps the popover closed). This is how a library-owned open (Dialog option
  C) works for Popover and Menu.

## Cross-engine gaps tests must branch on

| Gap | Engines | Test strategy |
| --- | --- | --- |
| `focusgroup` native path | Chromium only | Branch on `"focusGroup" in HTMLElement.prototype` (camelCase). JS path asserted elsewhere. |
| `interestfor` | Chromium only | Menu should not use it. Tooltip as today. |
| `popover="hint"` | Missing in Safari 27.0 | Only relevant where a Tooltip sits over a Menu: in Safari the tooltip is `manual`, which also does not close the menu. Same assertion either way. |
| Submenu focus restore | All engines lack it (spec) | Assert the **library** restores focus to the parent item in every engine. |
| Tab into a popover that is not next to the trigger | Safari 27.0 fails WPT | Do not assert "Tab from trigger enters the popup" unless the popup is DOM-adjacent. Menus move focus programmatically. |
| Exit animation | Firefox none (CSS); VT works everywhere | Never wait on CSS exit animations. VT-exit tests may assert in all engines (probe says so for Chromium/Firefox; first WebKit CI run will tell). |
| `<dialog popover>` `aria-modal` | Chromium bug | Library always renders `aria-modal="false"`. jsdom can assert the attribute. |
| `position-try-fallbacks` on **nested** popovers | WebKit bug 302008 (hang, NEW; reporter says 26.4 fixed the original hang but a CPU spin remains) | First WebKit CI run of a submenu test with `position-try-fallbacks`: watch for timeouts. |
| `position-try-fallbacks` + `@starting-style` on iOS | WebKit bug 317926 (hang on iOS 26.0.1, NEW) | Not covered by Playwright WebKit (macOS/Linux builds). Note it in the docs CSS snippets. |
| Minimum role `group` for `popover` | WebKit missing | Library sets roles explicitly; tests assert explicit roles, not computed implicit ones. |

## Recommendations

### Popover

- **Element.** `<dialog popover="auto" aria-modal="false">` when the content is interactive
  (default). Optionally a `<div popover>` with a consumer-chosen role for non-interactive
  content. Placement through the implicit anchor plus inline `position-area` /
  `position-try-fallbacks`, the same `side`/`align` shape as Tooltip.
- **Trigger.** `<button commandfor command="toggle-popover">`, rendered immediately before the
  popup in the DOM where the anatomy allows it. JS-free mode exactly like Dialog: works before
  hydration and from Server Components (with the Tooltip caveat that id-linking parts are client
  modules).
- **State.** Same two modes as Dialog option C:
  - In **JS-free mode** the browser owns everything.
  - In **library mode**, open is library-owned: intercept `command`, run `openChangeAction(true)`
    in a transition, render content from committed state, `showPopover({ source })` in a layout
    effect.
  - Close is browser-owned for light dismiss and Escape (a notification with
    `reason: "dismiss"`), and library-owned for Close parts and actions.
- **Focus.** Platform focus return. Initial focus by the dialog focusing steps (`autofocus` or
  the first focusable), so consumers use the same `initialFocus` mechanism as Dialog.
- **ARIA.** Explicit `aria-expanded` on the trigger. `aria-haspopup="dialog"` only if the design
  wants it (Dialog chose not to). `aria-labelledby` to a Title part.
- **Animation.** CSS for browser-owned transitions. With `transition` passed,
  `<ViewTransition>` wraps the popup element so library-owned opens and closes animate in every
  engine.
- **Baseline.** Everything above. **Experimental:** nothing required.

### Menu (menu button)

- **Trigger.** `<button commandfor command="toggle-popover" aria-haspopup="menu"
  aria-expanded>`. Enter, Space and ArrowDown open and focus the first item; ArrowUp focuses
  the last.
- **Popup.** `<div popover="auto" role="menu" aria-labelledby={trigger}>`, placed by the implicit
  anchor (`position-area: block-end span-inline-end`, `position-try-fallbacks: flip-block,
  flip-inline`).
- **Items.** `<button type="button" role="menuitem" tabindex="-1|0">`, disabled via
  `aria-disabled`.
  - Checkbox items: `role="menuitemcheckbox"` with `aria-checked` from `useOptimistic`.
  - Radio items: `role="menuitemradio"` in a `role="group"`.
  - Separator: `role="separator"`.
  - Group label: `role="group"` + `aria-labelledby`.
- **Submenus.** A nested `role="menu"` popover opened with `showPopover({ source: parentItem })`
  (JS) or `commandfor` (declarative):
  - placed with `position-area: span-block-end inline-end` and `position-try-fallbacks:
    flip-inline`;
  - DOM placement free, but no portal out of a `<dialog>`.
- **Library JS.**
  - Roving focus (Up/Down/Home/End, wrap).
  - Typeahead.
  - ArrowRight/ArrowLeft (RTL-aware) for submenus.
  - **Focus restore to the parent item** when a submenu closes.
  - **Close the whole stack on Tab / focus leaving the tree.**
  - Hover intent for submenus (open delay, a "safe triangle" or close delay).
  - Activation: `Menu.Item action` runs in a transition, and the menu closes after the commit
    via `hidePopover()` in a layout effect, which lets `<ViewTransition>` animate the exit.
- **Experimental.** `experimental_focusgroup` on `Menu.Popup` renders `focusgroup="menu"`, and the
  JS arrow/Home/End handling steps aside where `focusGroup` exists. Typeahead and submenu keys
  stay JS.
- **Not used.** `interestfor`, `popover="hint"`, `aria-activedescendant`, `<menu>`, the Open UI
  elements.
- **JS-free mode.** A menu cannot be fully APG-conformant without JS (no arrow keys outside
  Chromium, no typeahead). A pre-hydration click still opens it natively via `toggle-popover`,
  and Tab reaches the items. That is acceptable progressive enhancement, not a supported
  JS-free mode.

## Open questions for the architect

1. **Menu item activation and close timing.** Close immediately (optimistic, browser-feel) or
   keep the menu open with `data-pending` on the item until the action settles, then close in
   the same commit (VT exit)? Checkbox/radio items: close or stay open (APG allows both)?
2. **Popover initial focus default.** Move focus into the popup (APG non-modal dialog; the
   `<dialog popover>` default) or keep it on the trigger (disclosure-like)? This decides whether
   the default element is `<dialog popover>` or `<div popover>`.
3. **Ownership vocabulary for Menu.** Is the menu's `open` browser-owned (Tooltip model) with
   item activation as library-owned close, or Dialog option C (library-owned open)? Menus rarely
   load content on open, so the simpler model may be enough. Submenus with async content are the
   exception.
4. **VT placement convention.** Should conventions 3.5 / 5.1 add the rule "`<ViewTransition>`
   wraps the top-layer element itself, not its children", and should Dialog reconsider animating
   the library-owned close?
5. **Hover intent API for submenus** (delays, safe-area) and whether it is shared with Tooltip's
   timers.
6. **Context menus.** Out of scope for wave 3? The platform has no anchor at the pointer: position
   with inline `left`/`top` on a manual or auto popover. Nothing in this doc blocks it.
7. **Fix the focusgroup detection** in Tabs and conventions 8 (see Corrections; a repo issue should be opened by the product owner).

## Corrections to earlier research

- [modern-platform-survey.md](./modern-platform-survey.md), conventions 8 and the Tabs design
  feature-detect `focusgroup` with `"focusgroup" in HTMLElement.prototype`. In Chromium 156 the
  IDL attribute is **`focusGroup`** (and `focusGroupStart`), so the check is always false.
  `Tabs.List experimental_focusgroup` renders the attribute, but its JS still handles every arrow
  key with `preventDefault()`, so the native path never runs. Use
  `"focusGroup" in HTMLElement.prototype`.
- BCD notes that `showPopover({ source })` does not change the focus order. That was true of the
  partial versions (Chrome 133–136, Firefox 141–143, Safari 18.4–25). In Chromium 156 and
  Firefox 157, Tab from the source enters the popover.
- [popover-anchor-tooltip.md](./popover-anchor-tooltip.md) lists `position-anchor` as Chrome 125.
  BCD now marks Chrome 125–150, Firefox 147–150 and Safari 26 as partial, because the initial
  value was not `normal`. This has no effect on implicit-anchor usage.

## Upstream issues to track (do not file; listed for a repo issue)

- Chromium: `<dialog popover>` exposed with `modal=true` in the accessibility tree (no tracker
  entry found; human task to report).
- WebKit 302008, `position-try` on a nested popover hangs (NEW).
- WebKit 317926, iOS hang with `position-try-fallbacks` + `@starting-style` (NEW).
- WebKit 284230 (popover minimum role), 314812 (implicit `aria-details`), 306041 (hint mapping).
- WebKit standards-positions #580, Mozilla #1317 (menu elements); TAG #1242.
- Mozilla 2070976 (focusgroup meta, NEW); WebKit standards-positions #171 (focusgroup).
- react/react#37580 (`toggle` bubbling emulation removed on `main`, unreleased).

## References

- HTML Standard, popovers (show steps, `shouldRestoreFocus`, popover focusing steps, topmost
  popover ancestor): https://html.spec.whatwg.org/multipage/popover.html
- HTML-AAM (`popover`, `popovertarget`, `commandfor` mappings, minimum role `group`):
  https://w3c.github.io/html-aam/
- WAI-ARIA APG, Menu Button: https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
- WAI-ARIA APG, Menu and Menubar: https://www.w3.org/WAI/ARIA/apg/patterns/menubar/
- WAI-ARIA APG, Dialog (non-modal guidance): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Open UI, Menu elements explainer: https://open-ui.org/components/menu.explainer
- TAG design review #1242 (HTML menu elements): https://github.com/w3ctag/design-reviews/issues/1242
- WebKit standards-positions #580 (menu elements), #171 (focusgroup), #464 (interestfor):
  https://github.com/WebKit/standards-positions
- Mozilla standards-positions (#1317 menu elements, #1348 focusgroup positive, #1181 interestfor
  neutral): https://mozilla.github.io/standards-positions/
- Open UI, scoped focusgroup explainer: https://open-ui.org/components/scoped-focusgroup.explainer/
- Open UI, interest invokers explainer: https://open-ui.org/components/interest-invokers.explainer/
- MDN browser-compat-data 8.1.6: https://github.com/mdn/browser-compat-data
- Chromium `runtime_enabled_features.json5` (M155 branch 8059 and main; `MenuElements`,
  `Focusgroup`, `FocusgroupV2`, `HTMLCommandActionsV2`, `PopoverHintNewBehavior`):
  https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5
- chromiumdash, M155 stable 155.0.8059.85: https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=1
- wpt.fyi, popovers (stable): https://wpt.fyi/results/html/semantics/popovers?label=stable
- WebKit bugs 302008, 317926, 264069, 284230, 314812, 306041, 297786: https://bugs.webkit.org/
- Mozilla bugs 2070976 (focusgroup), 1984699 (interestfor): https://bugzilla.mozilla.org/
- react-dom 19.3.1 (`popover` toggle listeners on hydration):
  https://unpkg.com/react-dom@19.3.1/cjs/react-dom-client.development.js
- Probes and outputs: `memo/platform-researcher/probes/10-popover-menu/`
