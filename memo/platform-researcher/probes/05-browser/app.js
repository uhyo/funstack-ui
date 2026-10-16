// Bundled for the browser by run.mjs. Exposes window.probe.* scenarios driven by Playwright.
import React, { useState, useTransition, useOptimistic, startTransition, createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
let resolveAction;
const newDeferred = () => new Promise((r) => (resolveAction = r));
window.resolveAction = () => resolveAction();
window.api = {};
function Optimistic({ prevent }) {
  const [committed, setCommitted] = useState(false);
  const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
  const [pending, start] = useTransition();
  window.api.opt = { committed, optimistic, pending };
  return h('input', { id: 'opt', type: 'checkbox', checked: optimistic, onChange: (e) => {
    if (prevent) e.preventDefault();
    const next = !optimistic;
    start(async () => { setOptimistic(next); await newDeferred(); startTransition(() => setCommitted(next)); });
  } });
}
function TransitionOnly() {
  const [checked, setChecked] = useState(false);
  const [, start] = useTransition();
  return h('input', { id: 'tr', type: 'checkbox', checked, onChange: (e) => {
    const next = e.target.checked;
    start(async () => { await newDeferred(); startTransition(() => setChecked(next)); });
  } });
}
window.mount = (name, props) => {
  const host = document.getElementById('root');
  const root = createRoot(host);
  root.render(h({ Optimistic, TransitionOnly }[name], props));
  window.unmount = () => root.unmount();
};
function Radios() {
  const [committed, setCommitted] = useState('a');
  const [optimistic, setOptimistic] = useOptimistic(committed, (_, n) => n);
  const [, start] = useTransition();
  window.api.radios = { committed, optimistic, events: (window.api.radios?.events ?? []) };
  return h('fieldset', { role: 'radiogroup' }, h('legend', null, 'Size'), ['a', 'b', 'c'].map((v) => h('input', { key: v, id: 'r' + v, type: 'radio', name: 'size', value: v, 'aria-label': v, checked: optimistic === v,
    onChange: (e) => { window.api.radios.events.push(`${e.nativeEvent.type}:${e.nativeEvent.constructor.name}:${v}`);
      start(async () => { setOptimistic(v); await newDeferred(); startTransition(() => setCommitted(v)); }); } })));
}
window.mountRadios = () => { const root = createRoot(document.getElementById('root')); root.render(h(Radios)); };
