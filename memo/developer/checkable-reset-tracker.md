# Checkable inputs and react-dom's `checked` tracker after a form reset (#198)

- Rows: `src/__tests__/checkable-reset-rows.tsx` (Checkbox, Switch, RadioGroup.Item,
  CheckboxGroup.Item, CheckboxGroup.Parent; uncontrolled and controlled-adopting), run by
  `form-reset-tracker.test.tsx` (script `form.reset()`, jsdom) and
  `form-reset-button.browser.test.tsx` (real reset button). All passed with no fix.
- jsdom does reproduce the stale tracker: a probe with a plain uncontrolled React
  `<input type="checkbox" onChange>` (check, `form.reset()`, check) gets one `onChange`, not two.
  That is react-dom's own behaviour for plain uncontrolled checkboxes, not ours.
- Why ours are safe: after the reset the control dispatches `"platform"`, the input's props change
  (`checked`, `data-checked`), and react-dom's `updateInput` writes `node.checked` through the
  tracked setter on every input update. When nothing re-renders (a refused reset), the rule 8
  re-apply or `useNativeChecked`'s `else if (el.checked !== base) el.checked = base` writes through
  the setter. So no `syncValueTracker` for `checked` is needed today. If a path ever leaves the DOM
  at the reset value with no input re-render and no library write, these rows should catch it.
- WebKit cannot launch on this machine (host libraries); the browser rows ran on Chromium and
  Firefox only. CI runs WebKit.
