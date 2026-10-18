# Working notes: Button research (#79, wave 8), 2026-10-18

Sources: BCD 8.1.6 (2026-10-15; Chrome 155 / Firefox 158 / Safari 27 current); chromiumdash
stable 155.0.8059.85; Playwright Chromium 156 / Firefox 157; WebKit still cannot launch locally.
Packages read: react-aria-components 1.22.1, react-aria 3.53.1, @base-ui/react 1.9.0,
@radix-ui/themes 3.3.0, @mui/material 9.5.0, govuk-frontend 6.6.0, react-dom 19.3.1.

Findings worth remembering:
- Focused button -> `disabled`: Chromium and Firefox blur to <body> within a frame (sync read
  still shows the button); next Tab goes to the following element. WebKit bug 119713 (NEW) =
  no blur. aria-disabled keeps focus.
- Implicit submission: disabled default button blocks it; flipping the only submit button to
  type=button does NOT (single text field form still submits) -> React Aria's isPending
  submit->button trick is incomplete.
- React 19.3.1: useFormStatus().action === submitter's function formAction -> per-button pending.
  Form actions run concurrently (no queue); useActionState queues. preventDefault in the
  submitter's onClick blocks React's form action. type=button + formAction warns. Fizz emits
  $ACTION_ID_ name/formaction for Server Functions (progressive enhancement).
- HTML: a button with a form owner in the Auto state returns before running its command, so
  command/commandfor inside a form needs explicit type=button.
- React Aria Button isPending: aria-disabled, drops all on* except focus/blur/hover/pointer
  enter-leave, assertive LiveAnnouncer of name+progressbar label only while focused, on edges.
- MUI: type=button unless formAction; loading => native disabled. Radix Themes: loading =>
  native disabled, no type default. GOV.UK preventDoubleClick: 1 s debounce.
- aria-busy: Chromium exposes busy=1; a11ysupport (2021) none for NVDA/VO; JAWS reportedly hides
  busy content (Vispero note not retrievable).

Re-check later: WebKit focus fixup (119713); AT announcement of aria-disabled change on focus.
