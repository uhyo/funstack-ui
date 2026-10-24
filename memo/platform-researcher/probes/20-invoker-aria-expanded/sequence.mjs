// Shared probe sequence. driver: { eval(js) -> value (js is an expression), ax(ids) -> {id: string}, name }
const STATIC = ["a-cf-false", "a-pt-false", "b-cf-true", "b-pt-true", "c-cf-none", "c-pt-none", "d-cfshow-false", "e-plain-true", "f-cfcustom-false"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function run(d, log) {
  const domState = (ids) => d.eval(`JSON.stringify(Object.fromEntries(${JSON.stringify(ids)}.map(id => { const e = document.querySelector('[data-probe="' + id + '"]') ?? document.getElementById(id); const t = e.commandForElement ?? e.popoverTargetElement ?? (e.getAttribute('commandfor') && document.getElementById(e.getAttribute('commandfor'))); return [id, 'dom=' + e.getAttribute('aria-expanded') + ' popupOpen=' + (t ? t.matches(':popover-open') : 'n/a')]; })))`);
  const snap = async (label, ids) => {
    await sleep(400);
    const dom = JSON.parse(await domState(ids));
    const ax = await d.ax(ids);
    log(`--- ${label}`);
    for (const id of ids) log(`  ${id.padEnd(18)} ${dom[id].padEnd(30)} AX: ${ax[id]}`);
  };
  const click = (id) => d.eval(`((document.querySelector('[data-probe="${id}"]') ?? document.getElementById('${id}')).click(), true)`);
  const hang = (v) => d.eval(`(window.__hang = ${JSON.stringify(v)}, true)`);
  const release = () => d.eval(`(window.__release(), true)`);

  await snap("static: all closed", STATIC);
  await d.eval(`(['p1','p2','p3','p4','p5','p6','p7','p8'].forEach(id => document.getElementById(id).showPopover()), true)`);
  await snap("static: all open", STATIC);
  await d.eval(`(['p1','p2','p3','p4','p5','p6','p7','p8'].forEach(id => document.getElementById(id).hidePopover()), true)`);

  for (const t of ["pl-trigger", "m-trigger", "cb-trigger"]) {
    const ids = [t];
    await snap(`${t}: closed`, ids);
    await hang("open"); await click(t);
    await snap(`${t}: PENDING OPEN (optimistic true, popup not shown yet)`, ids);
    await release(); await hang(null);
    await snap(`${t}: open`, ids);
    await hang("close"); await click(t);
    await snap(`${t}: PENDING CLOSE (optimistic false, popup still shown)`, ids);
    await release(); await hang(null);
    await snap(`${t}: closed after release`, ids);
  }
  await snap("pj-trigger (JS-free): closed", ["pj-trigger"]);
  await click("pj-trigger");
  await snap("pj-trigger (JS-free): open", ["pj-trigger"]);
  await click("pj-trigger");
  await click("cb2-trigger");
  await snap("cb2-trigger (no commandfor): open", ["cb2-trigger", "cb2-input"]);
  await click("cb2-trigger");
  await snap("cb2-trigger (no commandfor): closed", ["cb2-trigger", "cb2-input"]);
}
