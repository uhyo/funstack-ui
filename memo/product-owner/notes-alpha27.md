## What's Changed

### Features

- `TextField`: in a `<textarea>`, Ctrl+Enter or Cmd+Enter commits the edit, the same commit as leaving the field. It never submits an enclosing form; Enter alone and Shift+Enter are still a new line. The docs show a short `Form.Root` handler for a form that should submit on the key (#196).

### Fixes

- Escape: a second Escape pressed before the first one's deferred decision ran (after a `stopPropagation()`) made the first one close nothing. Each Escape now closes one layer, innermost first (#195).

### Improvements

- `TextField`: `type="search"` stays unsupported, and its development warning now explains why (the engine's own Escape clear) and names `type="text"` with `role="searchbox"` and `enterKeyHint="search"` (#197).
- Tests pin "check, form reset, check again" on Checkbox, Switch, RadioGroup and CheckboxGroup, with a script reset and a real reset button in all three engines (#198).

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.26...0.1.0-alpha.27
