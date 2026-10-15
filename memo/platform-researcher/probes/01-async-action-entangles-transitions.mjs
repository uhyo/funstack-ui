import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
const React = require('react');
const { createRoot } = require('react-dom/client');
const { useState, useTransition, startTransition, createElement: h } = React;

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
let resolveDeferred;
const deferred = new Promise((r) => (resolveDeferred = r));
let startA, setMExt, setUExt, setNoActionExt;

function A() {
  const [n, setN] = useState(0);
  const [pending, start] = useTransition();
  startA = () => start(async () => { setN(1); await deferred; });
  return h('span', { id: 'a' }, `A:n=${n},pending=${pending}`);
}
function B() {
  const [m, setM] = useState(0);
  setMExt = setM;
  return h('span', { id: 'b' }, ` B:m=${m}`);
}
function U() {
  const [u, setU] = useState(0);
  setUExt = setU;
  return h('span', { id: 'u' }, ` U:u=${u}`);
}
function App() { return h('div', null, h(A), h(B), h(U)); }

const root = createRoot(document.getElementById('root'));
root.render(h(App));
await tick();
const log = (label) => console.log(label.padEnd(58), '=>', document.getElementById('root').textContent);
log('0 initial');

// control: a transition with NO async action pending commits on its own
startTransition(() => setMExt(5)); await tick(); log('1 control: sibling transition, no action pending');

startA(); await tick(); log('2 A started async action (setN(1) before await)');
startTransition(() => setMExt(1)); await tick(); log('3 sibling B: standalone startTransition(setM(1))');
setUExt(1); await tick(); log('4 sibling U: urgent setState(1), no transition');
await tick(100); log('5 100ms later, deferred still unresolved');
resolveDeferred(); await tick(); log('6 deferred resolved');
