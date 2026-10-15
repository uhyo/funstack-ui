// Probe: what happens when a Server Function (client-side reference) is called with
// `(next, details)` where `details.event` is a DOM Event?
//
// Run (scratch install of react-server-dom-webpack@19.3.1 + react@19.3.1 + jsdom):
//   SCRATCH=<dir with node_modules> node --conditions=react-server 03-server-function-action-details.mjs
//   NODE_ENV=production SCRATCH=... node --conditions=react-server 03-server-function-action-details.mjs
//
// The client half uses react-server-dom-webpack/client.browser (the SSR node client refuses callServer) (createServerReference + encodeReply),
// the server half react-server-dom-webpack/server (decodeReply) in the same process, which is
// why the react-server condition is needed. No React rendering is involved.

import { createRequire } from 'node:module';
const scratch = process.env.SCRATCH ?? '/tmp/claude-1000/-home-uhyo-repos-funstack-ui/9edfb96d-3075-4d78-bcf8-d09772e47fee/scratchpad/rsdw';
const require = createRequire(scratch + '/package.json');
globalThis.__webpack_require__ = { u: () => '' }; // the browser build reads webpack globals at load
const client = require('react-server-dom-webpack/client.browser');
const server = require('react-server-dom-webpack/server');
const { JSDOM } = require('jsdom');
const { window } = new JSDOM('<!doctype html><button id="b"></button>');

console.log('react-server-dom-webpack', require('react-server-dom-webpack/package.json').version, 'NODE_ENV=', process.env.NODE_ENV ?? '(dev)');

// ---- fake framework ---------------------------------------------------------------------
const serverFns = {
  setFavorite: async (next, details) => ({ next, detailsKeys: Object.keys(details ?? {}), typeofEvent: typeof details?.event }),
  touchEvent: async (next, details) => details.event.shiftKey, // a server fn that dots into the event
  echoArgs: async (...args) => args.length,
};
let warnings = [];
const origError = console.error;
console.error = (...a) => { warnings.push(String(a[0]).split('%s')[0].slice(0, 90)); };

function makeCallServer({ temporaryReferences: useTemp }) {
  return async (id, args) => {
    const clientTemp = useTemp ? client.createTemporaryReferenceSet() : undefined;
    const body = await client.encodeReply(args, { temporaryReferences: clientTemp });
    const wire = typeof body === 'string' ? body : '[FormData] ' + JSON.stringify(Object.fromEntries(body.entries()));
    const serverTemp = useTemp ? server.createTemporaryReferenceSet() : undefined;
    const decoded = await server.decodeReply(body, {}, { temporaryReferences: serverTemp });
    return { wire, result: await serverFns[id](...decoded), decoded };
  };
}

async function run(label, fnId, makeArgs) {
  for (const useTemp of [false, true]) {
    warnings = [];
    const callServer = makeCallServer({ temporaryReferences: useTemp });
    const ref = client.createServerReference(fnId, callServer);
    let out;
    try {
      const { wire, result } = await ref(...makeArgs());
      out = `OK   wire=${wire}  result=${JSON.stringify(result)}`;
    } catch (e) {
      out = `FAIL ${String(e.message).split('\n')[0].slice(0, 110)}`;
    }
    console.log(`\n[${label}] temporaryReferences=${useTemp}\n  ${out}`);
    if (warnings.length) console.log('  console.error:', warnings.join(' | '));
  }
}

const ev = () => new window.MouseEvent('click', { shiftKey: true });

await run('1 plain {event: MouseEvent}', 'setFavorite', () => [true, { event: ev() }]);
await run('1b server fn reads details.event.shiftKey', 'touchEvent', () => [true, { event: ev() }]);
await run('1c Node global Event', 'setFavorite', () => [true, { event: new Event('click') }]);
await run('2 event non-enumerable data prop', 'setFavorite', () => {
  const d = {}; Object.defineProperty(d, 'event', { value: ev(), enumerable: false }); return [true, d];
});
await run('3 event enumerable getter', 'setFavorite', () => { const e = ev(); return [true, { get event() { return e; } }]; });
await run('3b event non-enumerable getter', 'setFavorite', () => {
  const d = {}; Object.defineProperty(d, 'event', { get: () => ev(), enumerable: false }); return [true, d];
});
class ActionDetails { constructor(event) { this.event = event; } }
await run('4 class instance', 'setFavorite', () => [true, new ActionDetails(ev())]);
await run('4b class instance, no fields', 'setFavorite', () => [true, new (class {})()]);
await run('5 plain serializable only', 'setFavorite', () => [true, { reason: 'click', shiftKey: true }]);
await run('6 {event: undefined}', 'setFavorite', () => [true, { event: undefined }]);
await run('7 symbol-keyed event', 'setFavorite', () => [true, { [Symbol('event')]: ev() }]);
await run('8 event as 3rd positional arg', 'echoArgs', () => [true, {}, ev()]);
await run('9 Proxy over {} with get/has traps', 'setFavorite', () => {
  const e = ev();
  const d = new Proxy({}, { get: (t, k) => (k === 'event' ? e : t[k]), has: (t, k) => k === 'event' || k in t });
  return [true, d];
});
await run('10 null-prototype object', 'setFavorite', () => [true, Object.assign(Object.create(null), { reason: 'click' })]);
await run('11 details frozen plain object', 'setFavorite', () => [true, Object.freeze({ reason: 'click' })]);
await run('12 WeakMap side channel (details = {})', 'setFavorite', () => { const d = {}; new WeakMap().set(d, ev()); return [true, d]; });

// ---- detection: what does a client-side reference look like? ----------------------------
console.error = origError;
const ref = client.createServerReference('setFavorite', makeCallServer({ temporaryReferences: true }), undefined, undefined, 'setFavorite');
console.log('\n[detection] own props:', Object.getOwnPropertyNames(ref), 'name:', ref.name, 'length:', ref.length,
  '$$typeof:', ref.$$typeof, '$$id:', ref.$$id, 'bind own?', Object.hasOwn(ref, 'bind'),
  '\n  toString:', ref.toString().split('\n')[0].slice(0, 80));
const bound = ref.bind(null, 'post-1');
console.log('[detection] bound: own props:', Object.getOwnPropertyNames(bound), 'name:', bound.name);
