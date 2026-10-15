# Research index

Research documents that FUNSTACK UI's platform and React bets are based on. Each doc ends with a
verdict: **adopt**, **adopt behind experimental flag**, or **not yet**.

| Doc | Topic | Verdict | Date |
| --- | --- | --- | --- |
| [react-async-apis.md](./react-async-apis.md) | React 19.3 async APIs: Actions, `useTransition`, `useOptimistic`, `useActionState`, `<ViewTransition>`, `<Activity>`, `use`, RSC boundaries | Adopt (ViewTransition/Activity stable; gesture transitions and `onDefaultTransitionIndicator` not yet) | 2026-10-15 |
| [popover-anchor-tooltip.md](./popover-anchor-tooltip.md) | Tooltip via Popover API (`hint`), `interestfor`, Invoker Commands, CSS Anchor Positioning, `@starting-style`; React 19.3 attribute support | Adopt Popover API + Anchor Positioning + `@starting-style`; `popover="hint"` and `interestfor` behind experimental flag (Safari lacks `hint` in 27.0; `interestfor` is Chromium-only); `::interest-button` not yet | 2026-10-15 |
