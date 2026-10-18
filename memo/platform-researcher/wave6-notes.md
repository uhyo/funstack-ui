# Working notes: wave 6 research (ToggleGroup/Toolbar, NumberField, Progress/Meter), 2026-10-18

Sources / environment: BCD 8.1.6 (2026-10-15); chromiumdash stable 155.0.8059.85 (branch 8059);
Playwright Chromium 156 / Firefox 157; WebKit still cannot launch locally (host libs).
Library versions read: Radix toggle-group 1.2.1, Base UI 1.9.0, react-aria 3.53.1.

Findings worth remembering:
- focusgroup: flag stable in M155 and main; WHATWG PR #11723 still open (2026-10-13); Mozilla
  positive, bug 2070976 unassigned; WebKit #171 "None". Nested focusgroup = separate segment =
  extra Tab stops. Tab from a conflicting input moves to next item in the group.
- Chromium number input: localisation from UI language (--lang), not lang/locale override;
  en-US "1,5" -> 15 silently. Firefox: element lang. Chromium wheel steps focused number input;
  Firefox ignores. Neither handles PageUp/Home/End. UI stepping does not snap; stepUp() does.
- Chromium AX: number input without min/max -> valuemin 0 valuemax 0.
- WebKit: 314879 (number = AXTextField), 221102 (spinbutton "50%"/"0"), 250380, 193825 (no minus
  on iPhone decimal pad). React Aria and Base UI drop role=spinbutton.
- Hidden visually-hidden type=number gets browser focus on invalid submit unless the visible
  input is made invalid too (mirror validationMessage).
- <progress> children never render; Chromium transitions ::-webkit-progress-value size, Firefox
  does not transition ::-moz-progress-bar. Indeterminate + appearance:none: Chromium no fill,
  Firefox full fill. ::-moz-meter-bar / :-moz-meter-optimum supported in Firefox but missing from BCD.
- Playwright click on submit in Firefox again flaky (no invalid events); requestSubmit is reliable.

Re-check later: WHATWG #11723; WebKit 221102/314879; meter role screen-reader support (no tests
newer than 2018 found); typed attr() in Safari.
