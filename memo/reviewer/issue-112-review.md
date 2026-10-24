# Review: #112 Combobox Trigger close (branch fix/112-combobox-trigger-close, 0bd8b82)

Verdict: **acceptable with minor fixes.** The source change is correct and minimal. The required
fixes are to design text, plus two small test additions. No source rework.

## Verified by experiment (private worktree, Chromium + Firefox; removed afterwards)

- Light-dismiss exemption matrix. A raw `<div popover>` is open, and a real mouse press lands on a
  `<button>` whose click is cancelled. Results were identical on Chromium and Firefox:
  - none: CLOSED
  - `popovertarget`: stays open
  - `commandfor` + `toggle-popover` / `show-popover` / `hide-popover`: stays open
  - `commandfor` + `--x`: stays open
  - `commandfor` with no `command`: stays open
  - `commandfor` + `close` (not a popover command): stays open
  - `commandfor` naming a non-popover: CLOSED
  - `disabled` + `commandfor`: CLOSED
  - `disabled` + `popovertarget`: CLOSED
- Combobox on the branch:
  - Keyboard Enter on the Trigger (click `detail` 0): opens once (one `beforetoggle`), anchored
    to the input (dx = dy = 0), focus goes to the input.
  - Chromium touch tap (CDP `Input.dispatchTouchEvent`) while open, async action: 60 ms later
    the popup is still open, `data-pending`, `aria-expanded="false"`; one `(false, activate,
    click)` dispatch; hidden after it settles.
  - Native-`disabled` Trigger pressed while open: closes (light dismiss, unchanged from master),
    focus stays in the input.
  - `aria-disabled` component-render `<button>` Trigger pressed while open: stays open
    (`commandfor` written, exempt, click ignored).
  - Link render (`<a href>`) pressed while open: hidden at pointerup (frames `11110000`), then
    exactly one `(false, activate, click)`, final closed, no re-open.
  - Sync refusal on master vs branch, `beforetoggle` on the popup: master `closed,open` on both
    engines; branch none.
- Mutations (browser rows, Chromium + Firefox; jsdom):
  - Master's trigger file: 9 failures. The Firefox sync-refusal row passes unfixed, as the
    developer said.
  - Click left uncancelled when closed: caught by the closed-click row (both engines) and by the
    jsdom "every click is cancelled" row.
  - No attribute cleanup: nothing fails (F5).
- Merges: trial merges with fix/111-combobox-label-press, fix/115-116-trigger-close and
  fix/113-small-followups are all clean. #111 only touches input focus and blur tracking. The
  Trigger cancels `mousedown`, so the input never blurs and there is no semantic interplay.
- Chromium AX (CDP `getFullAXTree`, raw HTML, popover open): a `commandfor` +
  `toggle-popover` button with explicit `aria-expanded="false"` is exposed as `expanded: true`.
  One with explicit `"true"` while the popover is closed is exposed as `false`. The implicit
  invoker state overrides the explicit attribute.

## Findings

### F1 (medium, design text): the custom-command sentence is wrong for the shipping engines
design/components/combobox.md:1824-1827 (and the issue comment) says that `command="--x"` would
not be exempt. The HTML spec agrees: "get the target popover" step 7 returns null unless the
command is toggle-, show- or hide-popover. But Chromium and Firefox exempt any `commandfor` that
names an open auto popover, whatever the command (custom, missing, or `close`). Only a disabled
button or a non-popover target is not exempt. The developer's finding is confirmed.

The text should say: "By the spec only a popover command is exempt (HTML 'get the target
popover'). Chromium and Firefox (Playwright builds, 2026-10) exempt any `commandfor` that names
the popover. So the behaviour rows cannot tell the command apart, and the jsdom/hydration
attribute assertions are what pin `command="toggle-popover"`. We write the spec's form so the
exemption holds on a conformant engine." Also mention that a disabled button is never exempt
(step 2).

### F2 (medium, design text, cross-component): explicit `aria-expanded` does not win in Chromium
design/components/combobox.md:1829-1831 says "The Trigger's explicit `aria-expanded` and
`aria-controls` win". In Chromium, the probe shows the invoker's implicit expanded state
overrides the explicit attribute.

Effect on Combobox:
- During a pending close, AX says expanded=true while the DOM says `"false"`. This is truthful,
  because the listbox is visible.
- During a slow pending open, the DOM says `"true"` while AX says false.
- `aria-details` to the popup is added (the popup is not adjacent).

The input's `aria-expanded` (role=combobox) is the primary state, so the user impact is low.
The text should be corrected. menu.md:807 and popover.md:964 make the same "overridden" claim
for their Triggers. File a repo issue to re-check those (Firefox and WebKit unverified).

### F3 (low, test): the sync-refusal frame sampler cannot fail on Firefox
combobox.browser.test.tsx:809. On Firefox the hide and re-show land in one frame. Add a
`beforetoggle` listener on the popup to both refusal rows and assert no `"closed"`. That catches
the unfixed code on both engines (master: `closed,open`; branch: none). This also covers the
ViewTransition/animation replay that a same-frame blink still causes.

### F4 (low, test coverage): non-button Trigger press while open has no browser row
The two removed jsdom rows are genuinely obsolete for a `<button>`: there is no snapshot, no
`pointercancel` and no `detail === 0` branch. But the light-dismiss-before-click path still
exists for a link or non-button render, which `disabledButton` still supports with
`aria-disabled`. It now closes correctly only because `intended()` is still true at the click:
the `toggle` echo is a later task. My probe confirms the final state is closed with one
`(false, activate)`. Add a browser row with `render={<a href="#" />}`: press while open gives
closed and exactly one `(false, "activate")`, and no re-open over the next frames. That pins the
ordering assumption that replaced the snapshot.

### F5 (nit, test): the attribute cleanup is untested
combobox-trigger.tsx:106-109. Removing the cleanup fails nothing. Today it only runs when the
merged ref changes (an inline consumer ref) or on unmount, so it is harmless. Either add a
rerender row that switches `render` from `<button>` to a host `<span>` on the same Trigger, or
accept it as is.

### F6 (nit, docs/consistency)
- ComboboxPage.tsx:366 says "a click while it is open keeps it shown until
  `openChangeAction(false)` settles". This holds for a `<button>` Trigger only. Add "(a
  `<button>` Trigger; any other element is light-dismissed at the press, and warns in
  development)".
- ComboboxPage.tsx:78 should also say "a `<button>` Trigger".
- The row at :363 still advertises the link `render` (`aria-disabled`) for both parts. Link
  render on the Trigger now warns in development.
- combobox-trigger.tsx:91-93: the warning is less informative than #115's overlay-Trigger text
  on fix/115-116 (use-popover-trigger.ts). That text says "the close is not awaited,
  openChangeAction(false) cannot veto it and there is no exit transition. Render a <button>."
  Align the wording when both land.

### F7 (nit, behaviour to record): disabled flavours differ while open
A native-`disabled` Trigger is not exempt, so a press on it light-dismisses the open listbox
(same as master). An `aria-disabled` `<button>` (component render) is exempt and its click
returns early, so a press does nothing. The second is arguably the better behaviour. Record it
in the design's Trigger row; no code change needed.

## Checked and fine

- Click cancelled first (combobox-trigger.tsx:135). A cancelled `click` skips the button's
  activation behaviour, so no command runs:
  - mouse
  - touch (probed)
  - Enter/Space (`detail` 0, probed)
  - `element.click()`
  - an assistive-technology press. Chromium's DoDefaultAction and Firefox's a11y "press"
    dispatch a (synthetic) click whose default is the same activation behaviour, and that click
    is cancelled. An AT press also produces no `pointerdown`, so it never light-dismisses.
- Before hydration: no attributes, and a real click opens nothing (the hydration row extension
  covers it). After hydration the attributes are present.
- Anchoring: `source` stays the input (closed-click row with the `beforetoggle` count; probe
  dx = dy = 0).
- The Clear part is unchanged and still a documented light dismiss.
- The ref callback composes `checkName` / `checkElement` correctly (both stable).
  `useElementCheck` warns once.
- Types: `commandfor` / `command` are now owned (Omit). A consumer `onPointerCancel` passes
  through `rest` unmerged, which is correct now that the library has no handler. This is a
  type-level breaking change, acceptable for an experimental package. Consider a
  `@ts-expect-error` row for `commandfor` (menu.test.tsx:2250 has the precedent). Also,
  `render={<button commandfor="x" />}` is still typeable. Its value would be overwritten and
  then removed by the cleanup. Edge case; nit.
