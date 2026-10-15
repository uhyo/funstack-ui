import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
globalThis.window = dom.window; globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
globalThis.CSS = { escape: (s) => String(s), supports: () => true };
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
const vtCalls = [];
document.fonts = { status: 'loaded', ready: Promise.resolve() };
dom.window.Element.prototype.getAnimations = () => []; document.getAnimations = () => [];
const ind = () => document.querySelector('span');
document.startViewTransition = (opts) => {
  const c = { types: opts.types ? [...opts.types] : [], before: ind()?.outerHTML, after: null };
  opts.update(); c.after = ind()?.outerHTML; vtCalls.push(c);
  return { ready: Promise.resolve(), finished: Promise.resolve(), updateCallbackDone: Promise.resolve(), skipTransition() {}, types: new Set(c.types) };
};
const React = require('react');
const { createRoot } = require('react-dom/client');
const { ViewTransition, addTransitionType, startTransition, useOptimistic, useRef, useState, useTransition, useDeferredValue, createElement: h } = React;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

function Tabs({ mode, action }) {
  const [internal, setInternal] = useState('a');
  const [optimistic, setOptimistic] = useOptimistic(internal, (_p, n) => n);
  const [pending, start] = useTransition();
  const latest = useRef(0);
  const deferred = useDeferredValue(optimistic);
  const shown = mode === 'deferred' ? deferred : optimistic;
  const dispatch = (next) => { const id = ++latest.current; start(async () => { addTransitionType('fsui-tabs'); setOptimistic(next); await action?.(next); if (id === latest.current) startTransition(() => setInternal(next)); }); };
  return h('div', null,
    h('button', { id: 'b', onClick: () => dispatch('b') }, 'b'),
    h(ViewTransition, { default: 'slide' }, h('span', { 'data-value': shown, 'data-pending': pending || undefined, style: { positionAnchor: '--t-' + shown } })),
    h('p', { 'data-committed': internal }));
}
const root = createRoot(document.getElementById('root'));
async function scenario(label, mode, action) {
  const n0 = vtCalls.length;
  root.render(h(Tabs, { mode, action })); await tick();
  document.getElementById('b').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await tick();
  console.log(`${label}: after click (action pending) indicator=${ind().outerHTML} committed=${document.querySelector('p').dataset.committed} vt=${vtCalls.length - n0}`);
  for (const c of vtCalls.slice(n0)) console.log(`   startViewTransition types=[${c.types}] ${c.before} -> ${c.after}`);
  return n0;
}
let resolve1; const n1 = await scenario('S1 optimistic direct, async action', 'optimistic', () => new Promise((r) => (resolve1 = r)));
resolve1(); await tick(); console.log(`   after resolve: ${ind().outerHTML} vt=${vtCalls.length - n1}`); for (const c of vtCalls.slice(n1)) console.log(`   startViewTransition types=[${c.types}] ${c.before} -> ${c.after}`);
root.render(null); await tick();
let resolve2; const n2 = await scenario('S2 useDeferredValue(optimistic), async action', 'deferred', () => new Promise((r) => (resolve2 = r)));
resolve2(); await tick(); console.log(`   after resolve: ${ind().outerHTML} vt=${vtCalls.length - n2}`); for (const c of vtCalls.slice(n2)) console.log(`   startViewTransition types=[${c.types}] ${c.before} -> ${c.after}`);
root.render(null); await tick();
const n3 = await scenario('S3 useDeferredValue(optimistic), sync action', 'deferred', () => {});
process.exit(0);
