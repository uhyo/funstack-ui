import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { inline } from "../components/Tables.js";
import { componentNavItems } from "../navigation.js";
import { ToggleFavorite } from "../examples/ToggleFavorite.js";

// The six principles of docs/vision.md, linked to the page that explains each where there is one.
const principles: { title: string; body: string; href?: string }[] = [
  {
    title: "Suspense-native",
    body: "Content that suspends is the normal case. The old content stays on screen while the new content loads.",
    href: "/concepts/suspense",
  },
  {
    title: "Transition by default",
    body: "Every state change the library makes is a React transition. You do not opt in.",
    href: "/concepts/transitions",
  },
  {
    title: "Action props, not event handlers",
    body: "Pass an async function (`pressedChangeAction`, `valueChangeAction`); the component shows the new value at once and `data-pending` until it is done.",
    href: "/concepts/action-props",
  },
  {
    title: "<ViewTransition> built in",
    body: "Give a part a `transition` prop and its changes animate with React's `<ViewTransition>`.",
    href: "/concepts/transitions#transition-prop",
  },
  {
    title: "Greedy about the platform",
    body: "Popover API, `<dialog>`, CSS Anchor Positioning, `<details>`, native form controls. Where HTML can do the job, it does.",
    href: "/concepts/browser-owned-state",
  },
  {
    title: "Accessibility is not optional",
    body: "Components follow the WAI-ARIA Authoring Practices and are tested for keyboard and assistive-technology behaviour.",
  },
];

export function HomePage() {
  return (
    <div className="page">
      <PageHead description="FUNSTACK UI is a headless React component library and the first UI library that is Async React-native: Suspense-native, transition by default, action props, and <ViewTransition> built in." />
      <section className="hero">
        <h1>FUNSTACK UI</h1>
        <p className="tagline">
          Headless React components, and the first UI library that is <strong>Async React</strong>
          -native.
        </p>
        <img src="/FUNSTACK_UI_Hero_small.png" alt="FUNSTACK UI" className="hero-image" />
        <div className="hero-buttons">
          <a href="/why" className="button primary">
            Why FUNSTACK UI
          </a>
          <a href="/getting-started" className="button secondary">
            Get started
          </a>
        </div>
      </section>

      <Callout kind="warning" title="Experimental">
        <p>
          APIs change without notice. Releases are on npm under the <code>alpha</code> dist-tag.
          Feedback is welcome on <a href="https://github.com/uhyo/funstack-ui/issues">GitHub</a>.
        </p>
      </Callout>

      <h2>Try it</h2>
      <p>
        The star flips at once, the button shows a spinner while the fake save runs, and a second
        click while it is pending wins. The code is one <code>Toggle</code> with an async action.
      </p>
      <Example file="ToggleFavorite.tsx" css="toggle.css">
        <ToggleFavorite />
      </Example>
      <p>
        The components are headless: accessible HTML with data attributes, no styles. You bring the
        CSS. <a href="/why">Why FUNSTACK UI</a> shows what this saves you.
      </p>

      <h2>Principles</h2>
      <ul className="card-list">
        {principles.map((p) => (
          <li key={p.title}>
            <h3>{p.href === undefined ? p.title : <a href={p.href}>{p.title}</a>}</h3>
            <p>{inline(p.body)}</p>
          </li>
        ))}
      </ul>

      <h2>Install</h2>
      <CodeBlock language="bash">{`npm install @funstack/ui@alpha`}</CodeBlock>
      <p>
        React 19.3 or later. Supported browsers:{" "}
        <strong>the latest stable Blink, WebKit and Gecko. No fallbacks.</strong> Platform features
        not yet in all three are opt-in <a href="/concepts/experimental">experimental props</a>.
      </p>
      <p>
        Components:{" "}
        {componentNavItems.map((item, i) => (
          <span key={item.path}>
            {i > 0 && (i === componentNavItems.length - 1 ? " and " : ", ")}
            <a href={item.path}>{item.label}</a>
          </span>
        ))}
        . More are coming; see the <a href="/roadmap">roadmap</a>.
      </p>

      <h2>The FUNSTACK family</h2>
      <p>
        FUNSTACK UI is part of the FUNSTACK family, which aims to be the most modern React stack:
      </p>
      <ul>
        <li>
          <a href="https://router.funstack.work">FUNSTACK Router</a>: a React router built on the
          Navigation API.
        </li>
        <li>
          <a href="https://static.funstack.work">FUNSTACK Static</a>: a React Server Components
          static site framework. This site is built with it.
        </li>
      </ul>
    </div>
  );
}
