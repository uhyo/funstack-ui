// Probe: <form action={fn}> auto-reset (requestFormReset) vs a controlled checkbox, and the `reset`
// event as a hook for library state. jsdom 30 + React 19.3.1.
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
for (const k of ['FormData','HTMLFormElement','Event','SubmitEvent']) globalThis[k] = dom.window[k];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useFormStatus } = require('react-dom');
const { useState, useEffect, useRef, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let api = {}; const log = [];
function Status() { const s = useFormStatus(); api.formPending = s.pending; return null; }
function Ctl({ listenReset }) {
  const [checked, setChecked] = useState(false); api.checked = checked;
  const ref = useRef(null);
  useEffect(() => {
    if (!listenReset) return;
    const form = ref.current.form;
    const onReset = () => { log.push('reset event; scheduling re-sync'); queueMicrotask(() => { log.push(`after reset DOM=${ref.current.checked}`); setChecked(ref.current.checked); }); };
    form.addEventListener('reset', onReset); return () => form.removeEventListener('reset', onReset);
  }, [listenReset]);
  return h('input', { ref, type: 'checkbox', name: 'c', checked, onChange: (e) => setChecked(e.target.checked) });
}
for (const listenReset of [false, true]) {
  api = {}; log.length = 0;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let received;
  root.render(h('form', { action: async (fd) => { received = [...fd]; await tick(5); } }, h(Ctl, { listenReset }), h(Status), h('button', { type: 'submit' }, 'go')));
  await tick();
  const input = host.querySelector('input');
  input.click(); await tick();
  host.querySelector('button').click(); await tick(1);
  const midPending = api.formPending;
  await tick(50);
  console.log(`listenReset=${listenReset}: FormData=${JSON.stringify(received)} useFormStatus.pending during=${midPending}; after action: DOM=${input.checked} state=${api.checked} ${log.join(' / ')}`);
  root.unmount(); host.remove();
}
process.exit(0);
