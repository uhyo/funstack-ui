// Which lane does a toast() dispatch land in, relative to a pending async action? (jsdom, react 19.3.1)
// Run: node toast-lanes.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
console.log('react', React.version);
const { useState, useTransition, startTransition, createElement: h } = React;
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

let release; let startSlow; let push;
function Slow() {
  const [pending, start] = useTransition();
  startSlow = () => start(async () => { await new Promise((r) => (release = r)); });
  return h('span', null, `slowPending=${pending} `);
}
function Toaster() {
  const [toasts, setToasts] = useState([]);
  push = (t) => setToasts((ts) => [...ts, t]);
  return h('span', null, `toasts=[${toasts.join(',')}]`);
}
const root = createRoot(document.getElementById('root'));
root.render(h('div', null, h(Slow), h(Toaster)));
await tick();
const log = (l) => console.log(l.padEnd(64), '=>', document.getElementById('root').textContent);
startSlow(); await tick(); log('slow async action pending');

push('plain'); await tick(); log('push() outside any transition');
startTransition(() => push('inTransition')); await tick(); log('push() inside startTransition');
startTransition(() => queueMicrotask(() => push('microtask'))); await tick(); log('push() via queueMicrotask from inside startTransition');
startTransition(async () => { await Promise.resolve(); push('afterAwait'); }); await tick(); log('push() after await inside an async startTransition');
release(); await tick(); log('slow action released');
