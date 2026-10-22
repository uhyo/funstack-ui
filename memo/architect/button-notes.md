# Architect notes: Button (#79, wave 8), 2026-10-18 / 2026-10-22

Working notes behind `design/components/button.md`. Not a spec; the design doc is.

## Why the re-entry guard reads two sources

`useTransition`'s `isPending` is a render value: two clicks in one task (a key repeat, a double
`fireEvent.click`) both see `false`. So the hook needs a synchronous in-flight counter in a ref.
But the counter alone is wrong in the other direction: it clears when the promise settles, while
`data-pending` stays until the commit, and React may hold that commit for as long as *any* other
async action is pending (entanglement). In that window the button looks pending and the counter
says idle; a click would start a run that also only commits with the held one. Reading the last
render's `pending` too makes behaviour match what the user sees. Both, OR-ed.

For `formAction` only the render value exists: React starts the form status in a transition
update, so a same-task double click is theoretically unguarded. I considered a `submit` capture
listener through `useFormOwnerEvent` setting a flag, but a flag set on `submit` can get stuck
(a consumer `onSubmit` that `preventDefault()`s after ours, so status never goes pending and
nothing re-renders to clear it). Not worth the failure mode for a window a user cannot hit.

## Why `aria-disabled` while pending is not `data-disabled`

`[data-disabled]` is the consumer's `disabled` and the two states should never be forced to look
alike; `state.disabled` feeding `children(state)` must not flip either (a label swap keyed on
`disabled` would flicker). `aria-disabled` is the AT-facing fact only.

## `menu-dom.ts` is why the other triggers wait

`menu-dom.ts:19` treats `aria-disabled="true"` items as disabled for arrow navigation and
typeahead. A pending `Menu.Item` rendering `aria-disabled` would be skipped by the arrows while it
is the focused item. The follow-up (#81) has to key that query on `data-disabled` first. Dialog /
Popover Close are mechanical (about twenty "called twice" assertions and the "first close wins"
walkthroughs).

## `submittedWith` ref for `formAction`

`useFormStatus().action` is the function React captured at submit. An inline
`formAction={(fd) => …}` gets a new identity when the parent re-renders during the submission,
and `status.action === formAction` would go false, dropping `pending` after the first re-render.
Capturing in the click handler covers click, Enter/Space and implicit submission (the browser
clicks the default button); `form.requestSubmit(button)` sends no click, hence the prop
comparison stays as the first check.

## `type` owned, computed from the Button's own prop

Not owning it would let `render={<button type="submit">}` silently become a submit button while
the Button thinks it is `"button"`. Owning it with the consumer's `type` prop as input keeps one
writer. `rendersButton(render)` gates the key so an `<a>` never gets a `type`.

## `focusableWhenDisabled`

Added beyond the PO's list because `aria-disabled` is owned (omitted from the props type) and a
natively disabled button fires no events, so without the prop there is no way to put a Tooltip on
a disabled Button. The Toolbar rule is the same prop forced on by context. User kept it in v1.

## `Toolbar.Button`

Draft recommended keeping it as an alias of `Button` through 0.1.0. User chose removal now
(alpha; one name per component). toggle-group.md 3.4 / 11.5 are superseded; the implementer adds
an amendment note there as part of #79's docs work.

## Conventions edits made (accepted 2026-10-22, resolved question 34)

Header; decisions row 2; 1.1 `Button` row; 2.3 item 3 (cancelled click, pure trigger) and item 9;
2.5 "Pure triggers ignore re-entry" bullet with the #81 rollout; 2.7 own-`formAction` reading;
3.4 hook option and boolean `run`; 3.6 "never natively disabled" rewrite; 4.1 `pending` row; 5.3
rows; 9.1 folder; 10.1 Re-entry row and the N/A note on the superseded-rejection row.

## Wave 9 (#81, #83), 2026-10-22

- `useActionTrigger` users: Button, Dialog.Close, Popover.Close, Menu.Item, Toast.Action (pure
  triggers) and the `runStep` of Slider.Root / NumberField.Root (steps: every one must run). So the
  option cannot be dropped; the default flips to `true` and the two continuous controls opt out
  explicitly. Safer failure mode for a forgotten option is the guard, not the duplicate.
- `isDisabledItem` is used only by `edgeItem` (Home / End, open focus) in menu-dom.ts; the arrows
  never skipped disabled items (menu.md: "skipped by nothing"). Keying it on `data-disabled` is
  enough; the typeahead never read it.
- #83 rule: `aria-disabled` is only safe where the part cancels the click itself. Form.Submit has no
  handler (a submitter), so it keeps native `disabled`; the JS-free command modes of the Dialog /
  Popover Trigger and Close keep native `disabled` for the same reason (`installClick` is the
  condition). Toast.Action / Toast.Close do not own `disabled` at all (pass-through); out of scope.
