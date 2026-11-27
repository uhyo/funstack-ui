## What's Changed

This release adds the remaining wave of components from the UI library survey (#162).

### Features

- **Drawer** (`@funstack/ui/drawer`, #168): a dialog attached to an edge of the viewport (a bottom sheet or side panel) that the user can swipe away with mouse, pen or touch. Every part is a Dialog part: top layer, focus, Escape and the JS-free mode all come from Dialog. A swipe is a dismissal reported to `onOpenChange`. Your CSS moves the drawer through three custom properties. `modal={false}` gives a non-modal side panel.
- **Avatar** (`@funstack/ui/avatar`, #171): an image of a person or thing, with initials or an icon shown in its place. The image is in the server HTML and the fallback sits under it. The name goes on the Root. React's commit wait for images under a ViewTransition still applies.
- **OTPField** (`@funstack/ui/otp-field`, #171): a field for one-time codes. It is a single `autocomplete="one-time-code"` input drawn as a row of boxes, with a filter that keeps the text a valid code and WebOTP fill. `completeAction` is an awaited request that runs when the code is complete, with `data-pending`; `submitOnComplete` submits the form.

### Documentation

- A **Scroll areas** recipe (#171) replaces a ScrollArea component. It uses a native scroller with `scrollbar-width`, `scrollbar-color` and `scrollbar-gutter`, edge fades from a scroll-driven animation, and a Tab stop for content with nothing focusable.

**Full Changelog**: https://github.com/uhyo/funstack-ui/compare/0.1.0-alpha.20...0.1.0-alpha.21
