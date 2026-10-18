# Architect notes: Dialog.Form and Form.Root (#59), 2026-10-18

Working notes behind the "Dialog.Form and Form.Root (#59)" section of
`design/components/dialog.md`. Not a spec.

## What the composition does today (read from the code)

- `Dialog.Form render={<Form.Root errors />} action={dispatch}`: `useRender` clones the
  `Form.Root` element with Dialog.Form's merged props (`action` owned by Dialog.Form, `method`
  owned: `undefined` with a function action), and Dialog.Form's resolved children plus its
  `FormStatusWatcher` become `Form.Root`'s children. `Form.Root` then renders
  `<FormContext>` around `<form>` whose children are [Dialog.Form's fragment, Form.Root's own
  watcher]. So Dialog.Form's watcher is inside the FormContext and runs its effect before
  Form.Root's watcher (sibling order).
- `returnValue`: Dialog.Form's capture `submit` listener on the form sees the native event
  before React's `onSubmit` (Form.Root's) calls `preventDefault()`; the submitter's value is
  recorded either way.
- The Popup's root-node `submit` listener returns unless the method is `"dialog"`; a form with a
  React function action has React's method, so it never interferes.
- `merge-props.ts` owned-key rule: a key present in `libraryProps` with `undefined` removes
  the attribute. `Form.Root` owns `method` (`typeof action === "string" ? method : undefined`),
  so with no action it removes the `"dialog"` Dialog.Form passed: the composed form becomes a
  GET-navigating form. Hence the dev warning in the proposal.

## Why "error-aware closeOnSettle" rather than new props

The actual ergonomic complaint (field-form.md walkthrough 11, the Field docs page) is
`closeOnSettle={false}` plus "close it yourself on success", not the `render=` attribute. The
test row "the default closeOnSettle closes the dialog even when the result has errors" pins the
behaviour nobody wants. Fixing the predicate removes the complaint; adding `errors` to
Dialog.Form would also need the predicate fix and would add a second prop surface.

Detecting the composition: `use(FormContext)` from a child of Dialog.Form. Exact (the context
exists iff a Form.Root is the form), no import of `FormRoot` into the dialog subpath, works in
both orientations.

Predicate: `hasAnyError(errors)` (hidden stale entries included), the same as `autoReset`, so
"reset" and "close" can never disagree on a settle.

## Things I considered and dropped

- `closeOnSettle: boolean | "clean"`: a mode for something detectable; Toast uses the boolean.
- Suppressing Form.Root's reset when the dialog is closing: needs a Dialog → Form channel
  (context write from Dialog.Form's watcher) for a cosmetic; recipe `autoReset={false}` on the
  Form.Root element instead. Flagged as PO item 4 in case the user disagrees.
- Form.Root closing the dialog itself: couples the form subpath to Dialog and changes the
  meaning of a bare `<Form.Root>` inside a Popup.

## Follow-ups if accepted

Fold into dialog.md 3.5 / 8.1 / decisions row 9, field-form.md walkthrough 11 and PO item 9;
update `form.test.tsx` rows, the Field and Dialog docs pages.
