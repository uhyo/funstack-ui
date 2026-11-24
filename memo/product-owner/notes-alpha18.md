## What's Changed

### Behavior Changes

- `Accordion.Root`'s `exclusive` is now fixed at mount, like `ToggleGroup.Root`. Changing it later is ignored, with a development warning (#153).
- A `Button` with a function `formAction` is now pending from its own submission until all of the form's overlapping submissions have finished. Previously it lost `data-pending` when another submitter (another `Button formAction`, `Form.Submit`, Enter in a field) submitted while it was still running (#154).

### Fixes

- `whilePending="ignore"` on a `Button` with a function `formAction` now holds through overlapping submissions. Before, clicking A, then B, then A again ran A's action a second time (#154).
- A refused re-open never moves focus. When a controlled parent keeps a Popover, Menu, Combobox or non-modal Dialog open after a light dismiss or Escape, the re-shown popup no longer takes focus from the element the user clicked, including a default `<dialog>` Popover and a consumer `autofocus` child. The popup is `inert` only for the re-show call. A modal Dialog is unchanged (#156).

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.17...0.1.0-alpha.18
