# form-controls research notes (2026-10-16)

- WebKit cannot launch locally (missing libgtk-4 etc.); WebKit facts are from docs. CI runs WebKit,
  so a `*.browser.test.tsx` in the Switch/Checkbox implementation should assert the probe-05 table.
- Probe 05 bundles a tiny React app with esbuild from node_modules/.pnpm (nodePaths -> packages/ui).
- Radio probe "afterResolve committed=a" is an artifact: two actions, only the last deferred
  resolved, the first never settles so nothing commits (entanglement). Not a finding.
- `getComputedStyle(el, '::checkmark').content` returns the authored value even if the
  pseudo-element does not apply; do not use it as support detection.
- Key react-dom internals: batchedUpdates$1 -> flushSyncWork$1 -> restoreStateOfTarget;
  initInput keeps DOM checked when hydrating; recursivelyResetForms calls form.reset() in commit.
- Open: group-level "at least one" required for CheckboxGroup (setCustomValidity).
