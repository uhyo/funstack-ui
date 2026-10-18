// Button research (#79), 2026-10-18. jsdom 30 + React 19.3.1.
// Run: node memo/platform-researcher/probes/16-button/form-action-status.mjs
// 1. Does useFormStatus().action identify which submitter's `formAction` is running?
// 2. Are two quick submissions through the same `formAction` run concurrently or queued?
// 3. Does a `preventDefault()` in the submitter's onClick stop React's form action?
// 4. type="button" + formAction: does React warn?
import { createRequire } from "node:module";
const require = createRequire("/home/uhyo/repos/funstack-ui/packages/ui/package.json");
const { JSDOM } = require("jsdom");
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.FormData = dom.window.FormData;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const React = require("react");
const { createRoot } = require("react-dom/client");
const { useFormStatus } = require("react-dom");
const h = React.createElement;
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const errs = [];
console.error = (...a) => errs.push(String(a[0]).slice(0, 140));

const log = [];
const resolvers = [];
const actionA = (fd) => { log.push("A start"); return new Promise((r) => resolvers.push(() => { log.push("A end"); r(); })); };
const actionB = (fd) => { log.push("B start"); return new Promise((r) => resolvers.push(() => { log.push("B end"); r(); })); };
let blockNext = false;

function Btn({ id, formAction, type }) {
  const s = useFormStatus();
  const mine = s.pending && s.action === formAction;
  return h("button", {
    id, formAction, type,
    "data-form-pending": s.pending ? "" : undefined,
    "data-mine": mine ? "" : undefined,
    onClick: (e) => { if (blockNext && id === "a") e.preventDefault(); },
  }, id);
}
function App() {
  return h("form", { action: async () => { log.push("form action"); } },
    h(Btn, { id: "a", formAction: actionA }),
    h(Btn, { id: "b", formAction: actionB }),
    h(Btn, { id: "plain", type: "submit" }),
    h(Btn, { id: "typed", type: "button", formAction: actionA }),
  );
}
createRoot(document.getElementById("root")).render(h(App));
await tick();
const $ = (id) => document.getElementById(id);
const attrs = () => ["a", "b", "plain"].map((id) => `${id}:${$(id).hasAttribute("data-form-pending") ? "P" : "-"}${$(id).hasAttribute("data-mine") ? "M" : "-"}`).join(" ");

$("a").click();
await tick();
console.log("1 after click A:", attrs());
$("a").click();
await tick();
console.log("2 after second click A (first unresolved):", JSON.stringify(log));
resolvers.splice(0).forEach((r) => r());
await tick(50);
console.log("  after resolve:", attrs(), JSON.stringify(log));
log.length = 0;
blockNext = true;
$("a").click();
await tick();
console.log("3 click A with preventDefault in onClick:", JSON.stringify(log));
blockNext = false;
console.log("4 console.error:", JSON.stringify(errs));
process.exit(0);
