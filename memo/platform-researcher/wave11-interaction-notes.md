# Working notes: wave 11 interaction research (#21, #88), 2026-10-23

Doc: docs/research/interaction-wave11.md. Probes: probes/18-wave11/.

Worth remembering:
- Chromium interestfor: delay read from the invoker's computed style when hover/focus starts
  (ScheduleInterestGainedTask); no global warm-up. Explainer's intended skip pattern is CSS
  `:has(:interest-source)`; verified. Registered-property + transition on :root gives a cooldown
  (verified) but clobbers app `html { transition }`.
- Under pointer capture items get no pointerover/:hover; elementFromPoint needed. Firefox keeps
  a contextmenu-opened popover open when the pointerup is over it even without capture.
- Touch long-press then drag: Chromium emulation pans (pointercancel) unless a non-passive
  document touchmove preventDefault is attached. Not verified on real iOS/Android.
- overscroll-behavior on a non-overflowing scroll container: Chromium honours, Firefox 157 not.
- React 19.3.1 Fizz: hoisted <style precedence> uses render option nonce.style; element nonce
  mismatch => error + rules dropped. Client forwards the nonce prop. Hash sources work for
  script-inserted <style> in Chromium and Firefox.
- Native thresholds: GTK3 MENU_SHELL_TIMEOUT 500 ms; Chromium views 200 ms + 4 DIP; Windows opens
  on button up; Chromium touch menus above the point (kTouchYPadding 15). Win32 TTDT_RESHOW = 100 ms;
  GTK tooltip browse mode 60 ms / 500 ms.

Re-check later: real-device touch drag (iOS Safari, Android Chrome); whether Android's touch
`contextmenu` has buttons != 0; WebKit CI for drag-release; Gecko overscroll-behavior change.
