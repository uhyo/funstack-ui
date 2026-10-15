import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useState, useTransition, startTransition, use, Suspense, createElement: h } = React;
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let resolveData; const data = new Promise((r) => (resolveData = r));
let setShowExt, setMExt, setM2Ext;
function Slow() { const v = use(data); return h('span', null, ` slow=${v}`); }
function A() {
  const [show, setShow] = useState(false); const [pending, start] = useTransition();
  setShowExt = (v) => start(() => setShow(v));           // sync transition whose render suspends
  return h('span', null, `A:show=${show},pending=${pending}`, show ? h(Slow) : null);
}
function B() { const [m, setM] = useState(0); setMExt = setM; return h('span', null, ` B:m=${m}`); }
function Same() {  // second transition on the SAME hook queue as A's? no: separate state, same component
  const [m2, setM2] = useState(0); setM2Ext = setM2; return h('span', null, ` C:m2=${m2}`);
}
function App() { return h(Suspense, { fallback: h('i', null, 'FALLBACK') }, h('div', null, h(A), h(B), h(Same))); }
const root = createRoot(document.getElementById('root')); root.render(h(App)); await tick();
const log = (l) => console.log(l.padEnd(62), '=>', document.getElementById('root').textContent);
log('0 initial');
setShowExt(true); await tick(); log('1 A: sync transition that suspends (boundary already revealed)');
startTransition(() => setMExt(1)); await tick(); log('2 B: sibling transition in a later event');
startTransition(() => setM2Ext(1)); await tick(); log('3 C: another sibling transition');
resolveData('ok'); await tick(); log('4 data resolved');
