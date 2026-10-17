// form.reset() on a React-controlled <input type=range> (jsdom + React 19.3.1). Run: node react-range-reset.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
const React = require('react'); const { createRoot } = require('react-dom/client');
const { useState, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
let setV;
function App() {
  const [v, s] = useState(20); setV = s;
  return h('form', { id: 'f' },
    h('input', { id: 'c', type: 'range', name: 'c', value: v, onChange: (e) => s(Number(e.target.value)) }),
    h('input', { id: 'u', type: 'range', name: 'u', defaultValue: 20 }));
}
createRoot(document.getElementById('root')).render(h(App)); await tick();
const c = document.getElementById('c'), u = document.getElementById('u');
setV(70); u.value = '70'; await tick();
console.log('before reset   controlled', c.value, 'attr', c.getAttribute('value'), '| uncontrolled', u.value, 'attr', u.getAttribute('value'));
document.getElementById('f').reset(); await tick();
console.log('after reset    controlled', c.value, '| uncontrolled', u.value);
