# #203 readOnly (2026-11-28)

- Probes P1-P8: all pass on Chromium, Firefox, WebKit (CI run on probe/203, deleted).
- Baseline platform fact: Tab from an unchecked radio before the checked one lands on the
  checked radio in Chromium and Firefox; WebKit leaves the group. Not readOnly-related.
- jsdom 30 bug: legacy-canceled-activation toggles `checked` instead of restoring the saved
  value. With react-dom's restore during the dispatch, a cancelled click on a controlled
  checkbox ends checked in jsdom. After it, the next click is not a change to React (value
  tracker), so its onChange never runs: one gesture per render in jsdom rows; DOM `checked`
  after a cancelled click only in browser rows.
- Setting `input.value = x` directly goes through React's value tracker: onChange does not
  fire for a dispatched `input`. Use the prototype setter (drivers/slider.tsx setNativeValue).
- Combobox/MultiSelect: popup closes on readOnly-on via requestClose(undefined, "dismiss") in a
  layout effect (design said "as disabled", which does not close actively).
- Shell in this harness: heredocs and `$(...)` in git commands are refused; scripts go to the
  scratchpad (rep.py helper: rep(path, old, new, count)).
