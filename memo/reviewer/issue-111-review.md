# Review: #111 Combobox label press (branch fix/111-combobox-label-press, 9f98c06)

Verdict: **acceptable with minor fixes** (none blocking; F1-F3 can be follow-ups).

## Verified
- Mutation spot-check (private worktree, Chromium + Firefox, removed afterwards):
  - M1 no defer (old behaviour): Chromium 5 fail (4 held label rows + held page press),
    Firefox 9 fail (all 8 label rows + held page press); jsdom 2 rows fail.
  - M2 check synchronously at pointerup (no setTimeout): 16 browser label rows fail; jsdom 1.
  - Matches the developer's notes. Quick-click rows pass on unfixed Chromium by nature (Chromium
    keeps the text on a quick click); they still guard Firefox.
- Probes (not committed):
  - Press on the label, drag off to the page, release: text reverts, focus on body. Correct, since
    there is no label click.
  - `openOnClick` + label click: text kept, listbox stays closed, no reopen from the label's
    activation. Same as without openOnClick.
- Timing: the 80 ms rows assert the fixed behaviour after `settle` + `flushFor(60)`. With the fix
  the outcome doesn't depend on the hold length, so there's no race. "Still held: nothing
  decided yet" after `flushFor(80)` is deterministic too, because nothing is scheduled until the
  release.
- Cleanup: the listeners are removed on unmount.
  - A pending `afterPress` check is dropped with the listeners, so no stale check runs after the
    Root unmounts.
  - If only the Input unmounts, the existing `input.isConnected` guard covers it.
- StrictMode: re-subscribing is harmless (the refs persist). SSR: effect only, no server work.
- Iframe: a press inside a nested iframe never reaches the parent document's listeners.
  `pressing` stays false and the old path runs: one task later `activeElement` is the iframe, so
  it leaves. Unchanged and correct.
- Touch: compat `mousedown` (the blur) fires after `pointerup`, so `pressing` is already false and
  the old one-task path runs. The tap's mousedown/mouseup/click are dispatched together, so it
  still sees the label refocus. Touch scroll: `pointercancel` clears the flag.
- Pen: behaves like the mouse.
- Keyboard during a held press: keys go to body; Tab moves focus on; the release-time check reads
  the live `activeElement`, so the result is correct either way.
- Light dismiss: the listbox closes on a label press (the label is outside the popup). The rows
  pin this, and it's reasonable: the text and the value are untouched.

## Findings

### F1 (minor) Global listeners per Root, always attached
combobox-root.tsx:729-748 (branch).
- Every mounted Root holds three document capture listeners for its whole life, whether or not
  its input is focused. A page with 20 Comboboxes runs 20 handlers on every pointer event.
- The cost per handler is trivial, so this isn't a performance bug. It is still avoidable, and
  the lead asked for it explicitly.
- The pointerdown that matters always lands while the input has focus. So the listeners can be
  added on the input's `focus`/`focusin` and removed once focus has left and any deferred check
  has run (or on unmount).
- Doing that also shrinks F2's window: a stuck flag can only come from a press made while this
  input was focused.

### F2 (minor) `pressing` can stick when the release is never delivered
combobox-root.tsx:731-739.
- A press whose `pointerup`/`pointercancel` never reaches the document leaves `pressing === true`.
  Examples: an `alert()`/`confirm()` opened from a mousedown handler, or a native context menu on
  some platforms (Linux opens it at mousedown). This can't be reproduced headless.
- Consequence: the next `relatedTarget === null` blur (script `blur()`, disabling) is deferred
  until some later pointer release anywhere. Until then the text isn't reverted/committed.
- It self-heals on the next press, and the check reads live state, so nothing wrong is
  committed; it's only late.
- Cheap hardening: clear `pressing` (and run any pending check) on window `blur`, or on
  `focusin` back into the input.
- Multi-pointer (mouse + touch at once) can also clear the flag early, because one boolean
  tracks every pointer. A `Set` of `pointerId`s would fix that, but it's only worth it if the
  listener code is touched anyway for F1.

### F3 (nit) Document resolved once at effect time
combobox-root.tsx:730.
- `inputRef.current?.ownerDocument ?? document` is read once in a `[]` effect.
- If `Combobox.Input` mounts after the Root (conditional rendering) inside a portal into another
  document, the listeners end up on the wrong document.
- F1's focus-scoped attach would resolve the document from the input on each focus and remove
  this.

### F4 (nit) Test gap
- No row covers a press that starts on the label and is released elsewhere (it should revert; the
  probe confirms it does).
- No row covers `openOnClick` with a label click.
- Both are cheap to add to the #111 describe with the existing `mouse` helpers. Optional.

## Simpler alternatives considered
- Handling mousedown on `Combobox.Label` only (preventDefault, or focusing the input) would cover
  our own label. It misses Field.Label and any consumer `<label for>` or wrapping label.
  preventDefault on a label's mousedown would also block text selection.
- `relatedTarget` is `null` in every one of these cases (focus goes to body), so it can't tell
  the cases apart. Some knowledge of the press is needed; the pointer flag is the minimal
  version.
- The approach is right. F1 is the only structural change I'd ask for.

## Design wording (combobox.md 5.4, line 724; test plan line 1242)
The deviation reads well. Suggested replacement for the null-relatedTarget sentence:

> `relatedTarget === null` closes nothing synchronously. If a pointer is down (the blur came from
> a `mousedown`), the check runs one task after that press is released (`pointerup` or
> `pointercancel`); a `<label for>` (Combobox.Label, Field.Label) refocuses the input in the
> release's click, so a label press of any length keeps the text (#111). Without a press (script
> blur) it runs a task later. In both cases, if `document.hasFocus()` and the active element is
> outside the input and the popup, the revert or custom commit runs; the light dismiss has
> already closed the listbox (a label press closes it too, the label being outside the popup); a
> window blur stays a no-op.

Line 1242 (Focus loss row) should add: "with a pointer down, nothing until one task after its
`pointerup`/`pointercancel`; a label press keeps the text".
