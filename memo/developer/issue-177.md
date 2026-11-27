# #177: non-modal Dialog Escape vs inner manual popovers

- Cause: `listenDialogDismiss` listened on the `<dialog>` (bubble), so it ran before the
  document Escape listeners of HoverCard and Tooltip; `manual` popovers were skipped by the
  inner-layer check, so the dialog closed first.
- First fix (f46cca10): a standing window bubble listener. Review found (a) closed shadow roots:
  `composedPath()` at the window hides the nodes, dialog never closed; (b) `stopPropagation()`
  anywhere cancelled the dismissal.
- Final mechanism (architect, CHANGELOG entries "preventDefault() cancels, stopPropagation()
  does not" and "afterDispatch"): capture listener on the dialog records the Escape + inner-layer
  snapshot; a per-event window bubble listener decides with `settle(true)`; if propagation was
  stopped, `afterDispatch` (internal/after-dispatch.ts, shared with #185) decides with
  `settle(false)`. Scripted events settle in a microtask, real keys in a task.
- HoverCard `containsOpenLayer(popup, event)` also counts an open non-modal dialog inside the
  card that contains the target (the dialog now decides after the card's document listener).
- Test gotcha: counting window listeners must replay add/remove in call order
  (`invocationCallOrder`): `record` calls `removeEventListener` before `addEventListener`.
- Test gotcha: with scripted events the late path has already run when `act()` returns, so
  "unmount while pending" must unmount from a listener inside the dispatch.
- WebKit is not runnable locally (missing host libs); relied on CI for it.
- Follow-ups not done here (review nit 10): Escape path ignores `isComposing`; Tooltip's document
  Escape listener does not check `defaultPrevented`.
