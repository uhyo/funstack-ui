// Probe: native checkbox/radio inputs under FUNSTACK's transition-by-default model.
// jsdom 30 + React 19.3.1. Run: node memo/platform-researcher/probes/04-controlled-checkbox-transition.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const React = require('react');
const { createRoot, hydrateRoot } = require('react-dom/client');
const { renderToString } = require('react-dom/server');
const { useState, useTransition, useOptimistic, startTransition, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const errs = [];
const origErr = console.error;
console.error = (...a) => { errs.push(String(a[0]).slice(0, 160)); };

function section(t) { console.log('\n== ' + t); }

// ---------------------------------------------------------------- 1. native event order
section('1 native event order (no React)');
for (const prevent of [false, true]) {
  const host = document.createElement('div'); document.body.append(host);
  host.innerHTML = '<input type="checkbox" id="n">';
  const el = host.querySelector('input');
  const log = [];
  for (const t of ['click', 'input', 'change']) el.addEventListener(t, (e) => {
    log.push(`${t}(checked=${el.checked})`);
    if (t === 'click' && prevent) e.preventDefault();
  });
  el.click();
  log.push(`after-dispatch(checked=${el.checked})`);
  console.log(`preventDefault=${prevent}:`, log.join(' -> '));
  host.remove();
}

// ---------------------------------------------------------------- helpers
async function mount(el) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  root.render(el); await tick();
  return { host, root, input: () => host.querySelector('input') };
}
let resolveAction, rejectAction;
const newDeferred = () => new Promise((res, rej) => { resolveAction = res; rejectAction = rej; });

// ---------------------------------------------------------------- 2. controlled + transition only
section('2 controlled checked, state set in a transition (no optimistic)');
{
  let commits = [];
  function C({ asyncAction }) {
    const [checked, setChecked] = useState(false);
    const [pending, start] = useTransition();
    commits.push(`render checked=${checked} pending=${pending}`);
    return h('input', { type: 'checkbox', checked, onChange: (e) => {
      const next = e.target.checked;
      commits.push(`onChange event.type=${e.nativeEvent.type} target.checked=${next}`);
      start(async () => {
        if (asyncAction) { await newDeferred(); startTransition(() => setChecked(next)); }
        else setChecked(next);
      });
    } });
  }
  for (const asyncAction of [false, true]) {
    commits = [];
    const m = await mount(h(C, { asyncAction }));
    m.input().click();
    const sync = m.input().checked;
    await tick();
    const later = m.input().checked;
    if (asyncAction) { resolveAction(); await tick(); }
    console.log(`async=${asyncAction}: DOM right after click=${sync}, after tick=${later}, final=${m.input().checked}`);
    console.log('   ', commits.join(' | '));
    m.root.unmount(); m.host.remove();
  }
}

// ---------------------------------------------------------------- 3. controlled + useOptimistic
section('3 checked={optimistic}, async action, resolve / reject(swallowed)');
{
  let api;
  function C() {
    const [committed, setCommitted] = useState(false);
    const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
    const [pending, start] = useTransition();
    api = { committed, optimistic, pending };
    return h('input', { type: 'checkbox', checked: optimistic, 'data-pending': pending ? '' : undefined, onChange: (e) => {
      const next = !optimistic;
      start(async () => {
        setOptimistic(next);
        try { await newDeferred(); startTransition(() => setCommitted(next)); } catch {}
      });
    } });
  }
  for (const outcome of ['resolve', 'reject']) {
    const m = await mount(h(C));
    m.input().click();
    const sync = m.input().checked;
    await tick();
    const mid = `${m.input().checked} pending=${api.pending}`;
    outcome === 'resolve' ? resolveAction() : rejectAction(new Error('x'));
    await tick();
    console.log(`${outcome}: DOM right after click=${sync}; while pending=${mid}; settled DOM=${m.input().checked} committed=${api.committed} optimistic=${api.optimistic}`);
    m.root.unmount(); m.host.remove();
  }
}

// ---------------------------------------------------------------- 4. preventDefault in onChange
section('4 preventDefault() on the React onChange event (= native click), with optimistic');
{
  let api;
  function C() {
    const [committed, setCommitted] = useState(false);
    const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
    const [pending, start] = useTransition();
    api = { committed, optimistic, pending };
    return h('input', { type: 'checkbox', checked: optimistic, onChange: (e) => {
      e.preventDefault();
      const next = !optimistic;
      start(async () => { setOptimistic(next); await newDeferred(); startTransition(() => setCommitted(next)); });
    } });
  }
  const m = await mount(h(C));
  const nativeLog = [];
  for (const t of ['input', 'change']) m.input().addEventListener(t, () => nativeLog.push(t));
  m.input().click();
  const sync = m.input().checked;
  await tick();
  console.log(`DOM after click=${sync}; after tick DOM=${m.input().checked} optimistic=${api.optimistic}; native input/change fired: [${nativeLog}]`);
  resolveAction(); await tick();
  console.log(`after resolve: DOM=${m.input().checked} committed=${api.committed}`);
  m.root.unmount(); m.host.remove();
}

// ---------------------------------------------------------------- 5. radio group controlled + optimistic / transition only
section('5 radio group (same name), controlled');
{
  let api;
  function G({ optimisticOn }) {
    const [committed, setCommitted] = useState('a');
    const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
    const [, start] = useTransition();
    const shown = optimisticOn ? optimistic : committed;
    api = { committed, optimistic };
    return h('div', null, ['a', 'b', 'c'].map((v) => h('input', { key: v, type: 'radio', name: 'g' + optimisticOn, value: v, checked: shown === v,
      onChange: () => start(async () => { if (optimisticOn) setOptimistic(v); await newDeferred(); startTransition(() => setCommitted(v)); }) })));
  }
  for (const optimisticOn of [false, true]) {
    const m = await mount(h(G, { optimisticOn }));
    const radios = () => [...m.host.querySelectorAll('input')].map((r) => (r.checked ? r.value : '-')).join('');
    m.host.querySelectorAll('input')[1].click();
    const sync = radios();
    await tick();
    const mid = radios();
    resolveAction(); await tick();
    console.log(`optimistic=${optimisticOn}: after click=${sync}, pending=${mid}, settled=${radios()}`);
    m.root.unmount(); m.host.remove();
  }
}

// ---------------------------------------------------------------- 6. indeterminate prop
section('6 indeterminate as a React prop');
{
  errs.length = 0;
  const m = await mount(h('input', { type: 'checkbox', indeterminate: true, readOnly: true }));
  console.log(`client: attr=${JSON.stringify(m.input().getAttribute('indeterminate'))} prop=${m.input().indeterminate} matches(:indeterminate)=${m.input().matches(':indeterminate')}`);
  console.log('server:', renderToString(h('input', { type: 'checkbox', indeterminate: true, readOnly: true })));
  console.log('server aria-checked=mixed on input:', renderToString(h('input', { type: 'checkbox', 'aria-checked': 'mixed', readOnly: true })));
  console.log('dev errors:', errs.map((e) => e.slice(0, 100)));
  m.root.unmount(); m.host.remove();
}

// ---------------------------------------------------------------- 7. form reset and FormData
section('7 form reset / FormData');
{
  let api;
  function F() {
    const [checked, setChecked] = useState(true);
    api = { checked };
    return h('form', null,
      h('input', { type: 'checkbox', name: 'controlled', checked, onChange: (e) => setChecked(e.target.checked) }),
      h('input', { type: 'checkbox', name: 'uncontrolled', defaultChecked: true }),
      h('input', { type: 'checkbox', name: 'withvalue', value: 'yes', defaultChecked: true }));
  }
  const m = await mount(h(F));
  const [c, u] = m.host.querySelectorAll('input');
  console.log(`initial: controlled.defaultChecked=${c.defaultChecked} hasAttr(checked)=${c.hasAttribute('checked')}`);
  console.log('FormData:', JSON.stringify([...new window.FormData(m.host.querySelector('form'))]));
  c.click(); u.click(); await tick();
  console.log(`after clicks: controlled DOM=${c.checked} state=${api.checked}; uncontrolled DOM=${u.checked}`);
  m.host.querySelector('form').reset(); await tick();
  console.log(`after form.reset(): controlled DOM=${c.checked} state=${api.checked} (desync if differ); uncontrolled DOM=${u.checked}`);
  m.root.unmount(); m.host.remove();
}

// ---------------------------------------------------------------- 8. hydration after pre-hydration click
section('8 hydration when the user clicked before hydration');
{
  let changes = [];
  let api;
  function C() {
    const [checked, setChecked] = useState(false);
    api = { checked };
    return h('input', { type: 'checkbox', checked, onChange: (e) => { changes.push(e.target.checked); setChecked(e.target.checked); } });
  }
  const host = document.createElement('div'); document.body.append(host);
  host.innerHTML = renderToString(h(C));
  host.querySelector('input').click(); // user clicks before JS loads
  errs.length = 0;
  hydrateRoot(host, h(C)); await tick();
  console.log(`after hydrate: DOM=${host.querySelector('input').checked} state=${api.checked} onChange calls=${JSON.stringify(changes)} hydration errors=${errs.length}`);
  host.querySelector('input').click(); await tick();
  console.log(`after next click: DOM=${host.querySelector('input').checked} state=${api.checked} onChange calls=${JSON.stringify(changes)}`);
}
console.error = origErr;
process.exit(0);
