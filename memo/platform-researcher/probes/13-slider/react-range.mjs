// Controlled <input type=range> under transitions (jsdom + React 19.3.1). Run: node react-range.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
const React = require('react'); const { createRoot } = require('react-dom/client');
const { act } = React;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const { useState, useOptimistic, startTransition, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
console.log('react', React.version);

const setNative = (el, v) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, String(v));
};
let release = [];
const onChangeLog = [];
function TransitionOnly() {
  const [v, setV] = useState(50);
  return h('input', { id: 't', type: 'range', value: v, onChange: (e) => {
    onChangeLog.push(`t:onChange(${e.nativeEvent.type}):${e.target.value}`);
    const next = Number(e.target.value);
    startTransition(async () => { await new Promise((r) => release.push(r)); startTransition(() => setV(next)); });
  } });
}
function WithOptimistic() {
  const [v, setV] = useState(50);
  const [opt, setOpt] = useOptimistic(v);
  return h('input', { id: 'o', type: 'range', value: opt, onChange: (e) => {
    onChangeLog.push(`o:onChange(${e.nativeEvent.type}):${e.target.value}`);
    const next = Number(e.target.value);
    startTransition(async () => { setOpt(next); await new Promise((r) => release.push(r)); startTransition(() => setV(next)); });
  } });
}
const root = createRoot(document.getElementById('root'));
root.render(h('div', null, h(TransitionOnly), h(WithOptimistic)));
await tick();
const t = document.getElementById('t'), o = document.getElementById('o');
const show = (l) => console.log(l.padEnd(50), `transition-only DOM=${t.value}  optimistic DOM=${o.value}`);

for (const el of [t, o]) { setNative(el, 60); el.dispatchEvent(new window.Event('input', { bubbles: true })); }
show('after input event to 60 (actions pending)');
await tick(); show('later, still pending');
// simulated drag: several input events
for (const v of [65, 70, 75]) for (const el of [t, o]) { setNative(el, v); el.dispatchEvent(new window.Event('input', { bubbles: true })); }
await tick(); show('after drag 65,70,75 (pending)');
// trailing native change with same value: does React fire onChange again?
onChangeLog.length = 0;
for (const el of [t, o]) el.dispatchEvent(new window.Event('change', { bubbles: true }));
console.log('native change after input, same value -> onChange calls:', JSON.stringify(onChangeLog));
for (const r of release.splice(0)) r(); await tick(50);
show('all actions settled');
