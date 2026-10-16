// Probe for the Switch/Checkbox design: (1) `reset` fires before the reset algorithm and
// `el.defaultChecked` is the reset target; (2) consumer onClick runs before library onChange for
// the same click; (3) a layout effect that writes defaultChecked/checked runs after React's own
// form reset in the same commit; (4) updateInput rewrites checked on every re-render.
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
for (const k of ['FormData','HTMLFormElement','HTMLInputElement','Event','SubmitEvent','MouseEvent']) globalThis[k] = dom.window[k];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useState, useRef, useLayoutEffect, useOptimistic, useTransition, startTransition, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

console.log('== 1. reset event order (no React)');
{
  const host = document.createElement('div'); document.body.append(host);
  host.innerHTML = '<form><input type="checkbox" checked></form>';
  const form = host.querySelector('form'), el = host.querySelector('input');
  el.checked = false;
  const log = [];
  form.addEventListener('reset', (e) => { log.push(`reset listener: checked=${el.checked} defaultChecked=${el.defaultChecked} cancelable=${e.cancelable}`); queueMicrotask(() => log.push(`microtask: checked=${el.checked}`)); });
  form.reset();
  log.push(`after reset(): checked=${el.checked}`);
  await tick(1);
  console.log(log.join('\n'));
  host.remove();
}

console.log('\n== 2. consumer onClick runs before library onChange; defaultPrevented visible in onChange');
{
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const log = [];
  function C() {
    const [c, setC] = useState(false);
    return h('input', { type: 'checkbox', checked: c,
      onClick: (e) => { log.push('onClick'); e.preventDefault(); },
      onChange: (e) => { log.push(`onChange defaultPrevented=${e.nativeEvent.defaultPrevented}`); setC(e.target.checked); } });
  }
  root.render(h(C)); await tick();
  host.querySelector('input').click(); await tick();
  console.log(log.join(' | '), '| DOM after:', host.querySelector('input').checked);
  root.unmount(); host.remove();
}

console.log('\n== 3. auto form reset vs layout effect ordering, with defaultChecked prop change in the same commit');
{
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const log = [];
  let api = {};
  function Ctl({ def }) {
    const [committed, setCommitted] = useState(def);
    const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
    const [, start] = useTransition();
    const ref = useRef(null);
    api.optimistic = optimistic;
    useLayoutEffect(() => {
      const el = ref.current;
      log.push(`layout effect: DOM checked=${el.checked} defaultChecked=${el.defaultChecked}; prop def=${def} optimistic=${optimistic}`);
      el.defaultChecked = def; el.checked = optimistic;
    });
    React.useEffect(() => {
      const form = ref.current.form;
      const onReset = (e) => { log.push(`reset listener: DOM checked=${ref.current.checked} defaultChecked=${ref.current.defaultChecked}`); queueMicrotask(() => log.push(`microtask: DOM checked=${ref.current.checked} defaultChecked=${ref.current.defaultChecked} optimistic=${api.optimistic}`)); };
      form.addEventListener('reset', onReset); return () => form.removeEventListener('reset', onReset);
    }, []);
    return h('input', { ref, type: 'checkbox', name: 'c', checked: optimistic, onChange: () => { const next = !optimistic; start(async () => { setOptimistic(next); setCommitted(next); }); } });
  }
  let setDef;
  function App() { const [def, s] = useState(false); setDef = s; return h('form', { action: async (fd) => { log.push(`action FormData=${JSON.stringify([...fd])}`); await tick(5); startTransition(() => setDef(true)); } }, h(Ctl, { def }), h('button', { type: 'submit' }, 'go')); }
  root.render(h(App)); await tick();
  host.querySelector('input').click(); await tick();
  log.push(`before submit: DOM checked=${host.querySelector('input').checked}`);
  host.querySelector('button').click(); await tick(60);
  console.log(log.join('\n'));
  console.log('final DOM checked=', host.querySelector('input').checked, 'defaultChecked=', host.querySelector('input').defaultChecked);
  root.unmount(); host.remove();
}

console.log('\n== 4. does React rewrite el.checked on an unrelated re-render (updateInput every commit)?');
{
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); let bump;
  function C() { const [n, s] = useState(0); bump = s; return h('input', { type: 'checkbox', checked: true, onChange: () => {}, 'data-n': n }); }
  root.render(h(C)); await tick();
  const el = host.querySelector('input'); el.checked = false;
  bump(1); await tick();
  console.log('after unrelated re-render, DOM checked=', el.checked);
  root.unmount(); host.remove();
}
process.exit(0);
