import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { componentNavItems } from "../navigation.js";
import { ToggleFavorite } from "../examples/ToggleFavorite.js";

const principles = [
  {
    title: "Suspense-native",
    body: "Content that suspends is the normal case. Panels keep the old content on screen while the new content loads; no fallback flashes.",
  },
  {
    title: "Transition by default",
    body: "Every state change the library makes is a React transition. You do not opt in; urgent updates would be the opt-out.",
  },
  {
    title: "Action props, not event handlers",
    body: "Interactive props are actions (pressedChangeAction, valueChangeAction). They may be async; the component awaits them and shows pending state.",
  },
  {
    title: "<ViewTransition> built in",
    body: "Every part whose content is driven by library state takes a transition prop. Pass it and the part renders a <ViewTransition>, so the change animates.",
  },
  {
    title: "Greedy about the platform",
    body: "Popover API, CSS Anchor Positioning, <dialog> with Invoker Commands, native form controls, <details name>, hidden=until-found, ::details-content, interestfor. Where HTML can do the job, it does.",
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
          <a href="/getting-started" className="button primary">
            Get started
          </a>
          <a href="/concepts/action-props" className="button secondary">
            Learn the concepts
          </a>
        </div>
      </section>

      <Callout kind="warning" title="Experimental">
        <p>
          FUNSTACK UI is experimental. APIs change without notice; releases are published on npm
          under the <code>alpha</code> dist-tag. Feedback and issues are welcome on{" "}
          <a href="https://github.com/uhyo/funstack-ui/issues">GitHub</a>.
        </p>
      </Callout>

      <h2>What it is</h2>
      <p>
        React 19 gave us transitions, actions, <code>useOptimistic</code>, Suspense for data and{" "}
        <code>&lt;ViewTransition&gt;</code>. Component libraries still mostly hand you{" "}
        <code>onClick</code> and <code>onChange</code> and leave the rest to you. FUNSTACK UI starts
        from the other end: the component owns the transition, shows the optimistic state right
        away, exposes the pending state as a data attribute, and keeps suspending content on screen
        until it is ready.
      </p>
      <p>
        Click the button below. The star flips at once, the button shows a spinner while the fake
        save runs, and clicking again while it is pending simply wins.
      </p>
      <Example file="ToggleFavorite.tsx" css="toggle.css">
        <ToggleFavorite />
      </Example>
      <p>
        The components are headless: they render accessible HTML with data attributes and no styles.
        You bring the CSS.
      </p>

      <h2>Principles</h2>
      <ul className="principles">
        {principles.map((p) => (
          <li key={p.title}>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
          </li>
        ))}
      </ul>

      <h2>Browser support</h2>
      <p>
        <strong>
          The latest stable version of each major engine (Blink, WebKit, Gecko). No fallbacks.
        </strong>{" "}
        Being modern is the point. Platform features that have not shipped in all three engines are
        still used, but only behind <code>experimental_*</code> props that you opt into per call
        site. See <a href="/concepts/experimental">Experimental features</a>.
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

      <h2>Components</h2>
      <p>
        The component pages so far:{" "}
        {componentNavItems.map((item, i) => (
          <span key={item.path}>
            {i > 0 && (i === componentNavItems.length - 1 ? " and " : ", ")}
            <a href={item.path}>{item.label}</a>
          </span>
        ))}
        . A larger set follows; see the <a href="/roadmap">roadmap</a>.
      </p>
      <CodeBlock language="bash">{`npm install @funstack/ui@alpha`}</CodeBlock>
    </div>
  );
}
