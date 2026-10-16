import { PageHead } from "../components/PageHead.js";
import { GITHUB_URL, ISSUES_URL } from "../navigation.js";

const issue = (n: number) => `${GITHUB_URL}/issues/${n}`;

export function RoadmapPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Roadmap & changelog"
        description="Where FUNSTACK UI is heading, and where to follow changes."
      />
      <h2>Roadmap & changelog</h2>
      <p className="page-intro">
        FUNSTACK UI is experimental and has not had its first release yet. Planning happens in{" "}
        <a href={ISSUES_URL}>GitHub issues</a>; this page is a short summary.
      </p>

      <h3>Changelog</h3>
      <p>
        No release has been published. Once releases start, each one is listed on{" "}
        <a href={`${GITHUB_URL}/releases`}>GitHub Releases</a>. Until then, the{" "}
        <a href={`${GITHUB_URL}/commits/master`}>commit history</a> is the changelog.
      </p>

      <h3>Done</h3>
      <ul>
        <li>
          Library-wide API conventions: action props, pending and optimistic state, Suspense,
          ViewTransition, composition.
        </li>
        <li>
          The first four primitives: <a href="/components/toggle">Toggle</a>,{" "}
          <a href="/components/tabs">Tabs</a>, <a href="/components/accordion">Accordion</a>,{" "}
          <a href="/components/tooltip">Tooltip</a>.
        </li>
        <li>
          The second wave: <a href="/components/dialog">Dialog</a> (on <code>&lt;dialog&gt;</code>{" "}
          and Invoker Commands), and the native form controls{" "}
          <a href="/components/switch">Switch</a>, <a href="/components/checkbox">Checkbox</a> and{" "}
          <a href="/components/radio-group">RadioGroup</a>, with the shared form-reset and hydration
          handling.
        </li>
        <li>
          Browser-mode tests (Playwright) in Chromium, Firefox and WebKit for Popover, anchor
          positioning, <code>&lt;dialog&gt;</code>, native inputs and ViewTransition.
        </li>
      </ul>

      <h3>Next</h3>
      <ul>
        <li>
          A first npm release of <code>@funstack/ui</code>.
        </li>
        <li>
          CheckboxGroup: a <code>&lt;fieldset&gt;</code> with a shared <code>name</code>, a parent
          box with mixed state, and a group-level <code>required</code> (<a href={issue(33)}>#33</a>
          , in design).
        </li>
        <li>
          The cost of a <code>&lt;ViewTransition&gt;</code> that mounts inside a transition: React
          starts a document view transition even with <code>default="none"</code>, which delays the
          next commit (<a href={issue(35)}>#35</a>, in research).
        </li>
        <li>More components, toward a full set: Popover, Menu, Select, ToggleGroup, and more.</li>
      </ul>

      <h3>Deferred</h3>
      <ul>
        <li>
          Directive-free (truly zero-JS) variants of platform-native parts (
          <a href={issue(19)}>#19</a>).
        </li>
        <li>
          Tooltip: an Arrow part that points the right way after a fallback flip (
          <a href={issue(20)}>#20</a>) and a skip-delay group (<a href={issue(21)}>#21</a>).
        </li>
      </ul>

      <h3>Upstream</h3>
      <ul>
        <li>
          react-dom renders <code>hidden="until-found"</code> as a boolean (
          <a href={issue(16)}>#16</a>).
        </li>
        <li>
          Chromium does not match <code>:checked</code> on a checkbox that is both checked and
          indeterminate; jsdom toggles instead of restoring a checkbox after a cancelled click (
          <a href={issue(34)}>#34</a>).
        </li>
      </ul>
      <p>
        Ideas and bug reports are welcome as <a href={`${ISSUES_URL}/new`}>new issues</a>.
      </p>
    </div>
  );
}
