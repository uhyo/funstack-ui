const IDS = ["pt-plain", "pt-show", "pt-hide-out", "pt-dis", "pt-mi", "pt-aria-false", "cf-dis", "pt-noanchor", "pt-nonpopover", "close-cf", "close-pt", "close-ptt"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function run(d, log) {
  log("closed", await d.ax(IDS.filter((i) => !i.startsWith("close"))));
  await d.eval("window.showAll()");
  await sleep(600);
  log("open", await d.ax(IDS));
  await d.eval("window.hideAll()");
  await sleep(600);
  log("closed-again", await d.ax(IDS.filter((i) => !i.startsWith("close"))));
}
