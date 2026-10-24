# #118 invoker aria-expanded notes (2026-10-24)

- Firefox AX without Playwright: Playwright 1.64 dropped `page.accessibility`, and Juggler has no
  getFullAXTree. Working method: launch the Playwright Firefox binary directly with
  `-headless -marionette -remote-allow-system-access -profile <tmp>` (user.js sets
  `marionette.port` and `accessibility.enable_all_cache_domains`). Speak the Marionette TCP protocol
  (`len:[0,id,cmd,params]`), use the chrome context for `nsIAccessibilityService`, and walk from
  `gBrowser.selectedBrowser`. The first call starts the service; wait about 2 s before reading.
  Passing `-marionette` through Playwright's `launch({args})` did not open the port.
- Chromium: `DOM.querySelector` + `Accessibility.getPartialAXTree({nodeId, fetchRelatives:false})`
  is quicker than filtering getFullAXTree.
- Owned `id` on Menu.Trigger and others: probe with `data-probe` attributes, not ids.
- The #112 simulation must cancel the click, or the command runs and hides the popup.
- GitHub GraphQL blame works for WebKit/WebKit but times out on chromium/chromium.
- Open spec item to watch: w3c/html-aria#514. If it merges, recheck the Gecko OR behaviour and the
  axe-core rule (#4837).
