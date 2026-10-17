# Architect notes: Switch and Checkbox (#27), 2026-10-16

Working notes behind `design/components/switch.md` and `design/components/checkbox.md`. Not a spec.

## Probes run (react-dom 19.3.1, jsdom; `memo/architect/probes/checkbox-form-reset-ordering.mjs`)

1. **`reset` fires before the reset algorithm.** The listener sees the pre-reset `checked` and
   the post-reset target in `el.defaultChecked`; a microtask sees the reset value. The event is
   cancelable (a canceling listener prevents the reset), so the microtask checks
   `event.defaultPrevented`.
2. **A consumer `onClick` runs before the library's `onChange` for the same click**, and
   `event.nativeEvent.defaultPrevented` is already `true` in `onChange`. So one check after the
   dispatch catches both a `preventDefault()` in the action's sync prefix and one in a pass-through
   `onClick`.
3. **React's automatic form reset runs in the mutation phase** (`recursivelyResetForms` right
   after `recursivelyTraverseMutationEffects`, before layout effects). Consequences:
   - A `reset` listener subscribed in an effect **without deps** never sees it: the previous
     commit's cleanup has already removed it and the new subscription is not attached yet. The
     subscription must be stable (`useEffect` keyed on the form owner, `useEffectEvent` body).
   - A layout effect runs *after* the reset, so it is the right place to re-apply the optimistic
     `checked` and to sync `el.defaultChecked` to the latest `defaultChecked` prop. In the same
     commit where the prop changes (RSC re-render after a successful form action) the browser
     resets to the *old* default, the layout effect then fixes both properties, and the microtask
     reads the *new* default.
4. **`updateInput` rewrites `el.checked` on every commit of the input** (not only when the prop
   changed), so the library's re-apply layout effect is mostly belt-and-braces for `checked`; it
   is load-bearing for `indeterminate` and `defaultChecked`, which React does not manage for a
   controlled input (`updateInput` writes `defaultChecked` only when `checked == null`).
5. `diffHydratedProperties` skips `checked`: a pre-hydration click produces no hydration warning,
   so no `suppressHydrationWarning` is needed (unlike Accordion's `open`).

## Decisions I expect to be questioned

- **Single element, no `Indicator`/`Label`/`Thumb` parts.** The input cannot have children; a
  sibling indicator needs a wrapper part that owns context, which is three parts for what
  `label:has(:checked)` does in CSS. `render`'s function form may render siblings next to the
  input as the JS escape hatch.
- **`state.indeterminate = indeterminate && !pending`.** While an action is in flight the box
  shows the user's boolean; the dash returns on settle if the parent still says mixed. Attribute,
  DOM property and `:indeterminate` agree in every phase. The cost: a reset-triggered pending also
  hides the dash briefly.
- **Form reset in controlled mode notifies the parent** (reason `"platform"`, `event.type ===
  "reset"`) rather than being ignored. The DOM reset target stays React's mount-time value.
- **Uncontrolled reset target is the latest `defaultChecked` prop**, kept in `el.defaultChecked`
  by the hook. Matches a plain React uncontrolled input after an RSC re-render.
- **No `useFormStatus` coupling.**
- **CheckboxGroup deferred** to its own design.

## Status, 2026-10-17

switch.md and checkbox.md set to accepted (#27 closed, see memo/product-owner/status.md).
Checkbox 7 now lists `disabled` as owned (code: `packages/ui/src/checkbox/checkbox.tsx`, review
item L2 in `memo/developer/switch-checkbox.md`); Switch 12.2 already said so.
