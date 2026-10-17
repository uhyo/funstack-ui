// Toast design (#54): does a Suspense boundary that mounted in an URGENT commit reveal its content
// while an unrelated async action is pending (React 19.3.1, jsdom)?
// Run from packages/ui: node ../../memo/architect/probes/toast-suspense-reveal.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useState, useTransition, use, Suspense, createElement: h } = React;
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));
console.log('react', React.version);
const scenario = process.argv[2] ?? 'pending';

let release, startSlow, push, resolveContent;
const content = new Promise((r) => (resolveContent = r));
function Slow() {
  const [pending, start] = useTransition();
  startSlow = () => start(async () => { await new Promise((r) => (release = r)); });
  return h('span', null, `slowPending=${pending} `);
}
function Content() { return h('span', null, `content=${use(content)}`); }
function Toast({ name }) { return h('span', null, `[${name}:`, h(Suspense, { fallback: 'fallback' }, h(Content)), ']'); }
function Toaster() {
  const [toasts, setToasts] = useState([]);
  push = (t) => setToasts((ts) => [...ts, t]);
  return h('span', null, toasts.map((t) => h(Toast, { key: t, name: t })));
}
const root = createRoot(document.getElementById('root'), { onUncaughtError: (e) => console.log('uncaught', e), onRecoverableError: (e) => console.log('recoverable', String(e)) });
root.render(h('div', null, h(Slow), h(Toaster)));
await tick();
const log = (l) => console.log(l.padEnd(60), '=>', document.getElementById('root').textContent);
if (scenario === 'pending') { startSlow(); await tick(); log('slow async action pending'); }
push('a'); await tick(); log('urgent push of a toast whose content suspends');
resolveContent('ready'); await tick(); log('content promise resolved'); await tick(450); log('450 ms after resolve (action still pending if any)');
if (scenario === 'pending') { release(); await tick(); log('slow action released'); }
await tick(200); log('200 ms later'); await tick(400); log('600 ms later');
