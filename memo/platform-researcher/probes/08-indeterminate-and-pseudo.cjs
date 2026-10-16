// Chromium + Firefox: click on an indeterminate checkbox; preventDefault restores indeterminate;
// ::before renders on an appearance:none checkbox (pixel check).
const pw = require('/home/uhyo/repos/funstack-ui/packages/ui/node_modules/playwright');
(async () => { for (const n of ['chromium', 'firefox']) {
  const b = await pw[n].launch(); const p = await b.newPage();
  await p.setContent(`<style>#s{appearance:none;width:20px;height:20px;margin:0;display:block;background:white}#s::before{content:"";display:block;width:20px;height:20px;background:rgb(255,0,0)}</style>
<input type=checkbox id=s><input type=checkbox id=i><input type=checkbox id=j>`);
  const r = await p.evaluate(() => {
    const i = document.getElementById('i'); i.indeterminate = true;
    i.click(); const a = { checked: i.checked, indeterminate: i.indeterminate };
    const j = document.getElementById('j'); j.indeterminate = true;
    j.addEventListener('click', (e) => e.preventDefault()); j.click();
    return { afterClick: a, afterCanceledClick: { checked: j.checked, indeterminate: j.indeterminate } };
  });
  const shot = await p.locator('#s').screenshot();
  // crude: PNG decode not available; compare against a known red block rendered in a div
  await p.setContent('<div style="width:20px;height:20px;background:rgb(255,0,0)"></div>');
  const red = await p.locator('div').screenshot();
  console.log(n, b.version(), JSON.stringify(r), 'appearance:none ::before renders =', Buffer.compare(shot, red) === 0);
  await b.close();
} })();
