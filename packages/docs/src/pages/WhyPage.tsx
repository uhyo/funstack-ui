import { CodeBlock } from "../components/CodeBlock.js";
import { DocPage } from "../components/DocPage.js";
import { inline, Table } from "../components/Tables.js";

// What a reader stops writing by hand, each with the concept page that explains it.
const chores = [
  {
    title: "No pending flags",
    body: "Every component sets `data-pending` while your action runs, until its result is on screen. Style it in CSS.",
    href: "/concepts/pending-and-optimistic",
  },
  {
    title: "No onChange + useTransition + useOptimistic",
    body: "Pass an async function as an action prop. The component runs it in a transition, shows the new value at once, and rolls it back if the action fails. Errors go to your Error Boundary.",
    href: "/concepts/action-props",
  },
  {
    title: "No races between fast clicks",
    body: "The latest click wins. A slow response to an older click never overwrites a newer choice.",
    href: "/concepts/action-props#overlapping-actions",
  },
  {
    title: "No fallback flashes",
    body: "When the next tab, accordion item or dialog loads data, the current screen stays as it is and the trigger shows pending until the new content is ready.",
    href: "/concepts/suspense",
  },
  {
    title: "No JavaScript copies of the browser",
    body: "Popups use the Popover API, `<dialog>` and CSS Anchor Positioning; form controls are native inputs. The browser handles the top layer, Escape, click outside and focus return.",
    href: "/concepts/browser-owned-state",
  },
  {
    title: "No animation glue",
    body: "Pass `transition` to a part and it renders React's `<ViewTransition>`. Each change is tagged with a transition type, such as `fsui-tabs-next`, so you can animate by direction.",
    href: "/concepts/transitions",
  },
];

export function WhyPage() {
  return (
    <DocPage
      title="Why FUNSTACK UI"
      description="Why choose FUNSTACK UI: headless React components that already do the async work React 19 asks for. Pending and optimistic state, Suspense, transitions and the platform, built in."
    >
      <p className="page-intro">
        React 19 added actions, transitions, <code>useOptimistic</code>, Suspense for data and{" "}
        <code>&lt;ViewTransition&gt;</code>. FUNSTACK UI is a headless component library that uses
        them for you, so the async work around every button, tab and dialog is already done.
      </p>

      <h3 id="what-you-stop-writing">What you stop writing</h3>
      <ul className="card-list">
        {chores.map((chore) => (
          <li key={chore.title}>
            <h4>
              <a href={chore.href}>{chore.title}</a>
            </h4>
            <p>{inline(chore.body)}</p>
          </li>
        ))}
      </ul>

      <h3 id="before-and-after">Before and after</h3>
      <p>A favourite button that saves to a server. By hand:</p>
      <CodeBlock>{`const [pressed, setPressed] = useState(initial);
const [optimistic, setOptimistic] = useOptimistic(pressed);
const [isPending, startTransition] = useTransition();

<button
  aria-pressed={optimistic}
  data-pending={isPending ? "" : undefined}
  onClick={() => {
    const next = !optimistic;
    startTransition(async () => {
      setOptimistic(next);
      await saveFavorite(next);
      startTransition(() => setPressed(next));
    });
  }}
>
  Favorite
</button>
// ...and a slow save from an earlier click can still overwrite a later one.`}</CodeBlock>
      <p>With FUNSTACK UI:</p>
      <CodeBlock>{`<Toggle defaultPressed={initial} pressedChangeAction={(next) => saveFavorite(next)}>
  Favorite
</Toggle>`}</CodeBlock>
      <p className="why-claim">
        Same optimistic flip, same <code>data-pending</code>, plus rollback on failure and
        latest-click-wins. Try it on the <a href="/">home page</a>.
      </p>

      <h3 id="compared">Compared with other headless libraries</h3>
      <p>
        Most established headless React libraries were designed before React's async features, and
        support a wide range of browsers. They are mature and a safe choice. FUNSTACK UI takes a
        different approach:
      </p>
      <Table
        head={["", "Typical headless library", "FUNSTACK UI"]}
        rows={[
          [
            "**Callbacks**",
            "Event handlers (`onValueChange`, `onOpenChange`). Transitions, optimistic state and pending flags are yours to add.",
            "[Action props](/concepts/action-props): run in a transition, may be async. Optimistic and pending state built in.",
          ],
          [
            "**Content that loads data**",
            "Usually updated urgently, so content that suspends shows its fallback unless you add a transition.",
            "[Old content stays on screen](/concepts/suspense) until the new content is ready.",
          ],
          [
            "**Popups**",
            "JavaScript for positioning, layering and dismissal, so older browsers work too.",
            "The [platform](/concepts/browser-owned-state): Popover API, `<dialog>`, CSS Anchor Positioning. Some components work before hydration.",
          ],
          [
            "**Animation**",
            "CSS, plus your own code for exit animations.",
            "CSS, plus `<ViewTransition>` through the parts' `transition` prop ([Transitions](/concepts/transitions)).",
          ],
          [
            "**Browsers**",
            "Wide support, including older versions.",
            "Latest stable Chrome, Edge, Safari and Firefox. No fallbacks.",
          ],
          [
            "**Maturity**",
            "Stable APIs, large component sets.",
            "Experimental alpha. APIs change without notice.",
          ],
        ]}
      />

      <h3 id="who-for">Who it is for</h3>
      <div className="why-columns">
        <div>
          <h4>Choose it if</h4>
          <ul>
            <li>
              Your app uses React 19.3 or later, with actions, Suspense or{" "}
              <a href="/concepts/server-components">Server Components</a>.
            </li>
            <li>Your controls save to a server and should feel instant.</li>
            <li>You only need to support current browsers.</li>
            <li>You want to write your own CSS: no styles, no theme, no provider.</li>
          </ul>
        </div>
        <div>
          <h4>Look elsewhere (for now) if</h4>
          <ul>
            <li>You need older browsers or older Safari versions.</li>
            <li>You need a stable API today.</li>
            <li>You want styled components out of the box.</li>
            <li>
              You need a component that is not here yet (see the <a href="/roadmap">roadmap</a>).
            </li>
          </ul>
        </div>
      </div>

      <h3 id="next">Next</h3>
      <ul>
        <li>
          <a href="/getting-started">Getting started</a>: install, import, style.
        </li>
        <li>
          <a href="/concepts/action-props">Action props</a>: the idea everything else builds on.
        </li>
        <li>
          <a href="/guides/ai-agents">Using with AI agents</a>: give your coding agent the full
          docs.
        </li>
      </ul>
    </DocPage>
  );
}
