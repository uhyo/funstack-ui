import { createRequire } from 'node:module';
const require = createRequire('/home/uhyo/repos/funstack-ui/packages/ui/package.json');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
globalThis.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, '_'), supports: () => true };
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);

// Polyfill the View Transition API just enough for React's host config.
const vtCalls = [];
document.fonts = { status: 'loaded', ready: Promise.resolve() };
dom.window.Element.prototype.getAnimations = () => [];
document.getAnimations = () => [];
document.startViewTransition = (opts) => {
  const types = opts.types ? [...opts.types] : [];
  vtCalls.push({ phase: currentPhase, types, html: null });
  opts.update();
  vtCalls[vtCalls.length - 1].html = btn().outerHTML;
  return {
    ready: Promise.resolve(),
    finished: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    skipTransition() {},
    types: new Set(types),
  };
};
let currentPhase = 'init';

const React = require('react');
const { createRoot } = require('react-dom/client');
const { ViewTransition, addTransitionType, startTransition, useOptimistic, useRef, useState, useTransition, createElement: h } = React;

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const btn = () => document.querySelector('button');

function useControllableAction({ controlled, defaultValue, action, transitionType }) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = controlled !== undefined;
  const committed = isControlled ? controlled : internal;
  const [optimistic, setOptimistic] = useOptimistic(committed, (_p, n) => n);
  const [pending, startOwn] = useTransition();
  const latest = useRef(0);
  function dispatch(next, details) {
    const id = ++latest.current;
    startOwn(async () => {
      addTransitionType('fsui-toggle');
      const t = transitionType?.(next);
      if (t) addTransitionType(t);
      setOptimistic(next);
      await action?.(next, details);
      if (!isControlled && id === latest.current) startTransition(() => setInternal(next));
    });
  }
  return { committed, optimistic, pending, dispatch };
}

function Toggle({ pressed, defaultPressed = false, pressedChangeAction, transition }) {
  const { optimistic, pending, dispatch } = useControllableAction({
    controlled: pressed, defaultValue: defaultPressed, action: pressedChangeAction,
    transitionType: (next) => (next ? 'fsui-toggle-press' : 'fsui-toggle-release'),
  });
  return h(ViewTransition, { default: transition ?? 'none' },
    h('button', {
      type: 'button', 'aria-pressed': optimistic,
      'data-pressed': optimistic || undefined, 'data-pending': pending || undefined,
      onClick: (e) => dispatch(!optimistic, { event: e.nativeEvent }),
    }, optimistic ? 'ON' : 'OFF'));
}

const root = createRoot(document.getElementById('root'));
function mount(el) { root.render(el); return tick(); }
function click() { btn().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }
function log(label) { console.log(`${label.padEnd(40)} ${btn().outerHTML}  vt=${vtCalls.length}`); }
function dumpVt(from) { for (const c of vtCalls.slice(from)) console.log(`   startViewTransition phase=${c.phase} types=[${c.types}] -> ${c.html}`); }

// --- Scenario 1: uncontrolled, async action resolving ---
let resolveA; let n0 = vtCalls.length;
currentPhase = 's1';
await mount(h(Toggle, { transition: 'fade', pressedChangeAction: () => new Promise((r) => (resolveA = r)) }));
log('S1 mounted');
click(); await tick(); log('S1 after click (optimistic)');
resolveA(); await tick(); log('S1 after resolve (committed)');
dumpVt(n0);

// --- Scenario 2: uncontrolled, async action rejecting (caught by boundary) ---
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() { return this.state.err ? h('i', null, 'ERR') : this.props.children; }
}
let rejectB; n0 = vtCalls.length; currentPhase = 's2';
await mount(h(Boundary, null, h(Toggle, { transition: 'fade', pressedChangeAction: () => new Promise((_, rj) => (rejectB = rj)) })));
log('S2 mounted');
click(); await tick(); log('S2 after click (optimistic)');
rejectB(new Error('nope')); await tick(); console.log(`S2 after reject: root=${document.getElementById('root').innerHTML}  vt=${vtCalls.length}`);
dumpVt(n0);

// --- Scenario 3: uncontrolled, sync action ---
n0 = vtCalls.length; currentPhase = 's3';
await mount(h(Toggle, { transition: 'fade', pressedChangeAction: () => {} }));
log('S3 mounted');
click(); log('S3 sync after click');
await Promise.resolve(); log('S3 after 1 microtask');
await tick(); log('S3 after tick');
dumpVt(n0);

// --- Scenario 4: controlled, parent updates in sync prefix (sync action) ---
n0 = vtCalls.length; currentPhase = 's4';
function Parent() {
  const [p, setP] = useState(false);
  return h(Toggle, { transition: 'fade', pressed: p, pressedChangeAction: (next) => { setP(next); } });
}
await mount(h(Parent));
log('S4 mounted');
click(); await tick(); log('S4 after click');
dumpVt(n0);

// --- Scenario 5: controlled, parent never updates (veto) ---
n0 = vtCalls.length; currentPhase = 's5';
let resolveE;
await mount(h(Toggle, { transition: 'fade', pressed: false, pressedChangeAction: () => new Promise((r) => (resolveE = r)) }));
log('S5 mounted');
click(); await tick(); log('S5 after click (optimistic)');
resolveE(); await tick(); log('S5 after resolve (snaps back)');
dumpVt(n0);

// --- Scenario 6: two overlapping clicks, first resolves last ---
n0 = vtCalls.length; currentPhase = 's6';
const resolvers = [];
const calls = [];
await mount(h(Toggle, { transition: 'fade', pressedChangeAction: (next) => { calls.push(next); return new Promise((r) => resolvers.push(r)); } }));
log('S6 mounted');
click(); await tick(); log('S6 after click 1');
click(); await tick(); log('S6 after click 2');
console.log('S6 action args:', calls);
resolvers[1](); await tick(); log('S6 after click-2 resolves');
resolvers[0](); await tick(); log('S6 after click-1 resolves');
dumpVt(n0);
process.exit(0);
