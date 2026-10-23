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
        FUNSTACK UI is experimental; its first alpha is on npm. Planning happens in{" "}
        <a href={ISSUES_URL}>GitHub issues</a>; this page is a short summary.
      </p>

      <h3>Changelog</h3>
      <p>
        The first alpha, <code>0.1.0-alpha.0</code>, is published on npm under the{" "}
        <code>alpha</code> dist-tag: <code>npm install @funstack/ui@alpha</code>. Each release is
        listed on <a href={`${GITHUB_URL}/releases`}>GitHub Releases</a>; between releases, the{" "}
        <a href={`${GITHUB_URL}/commits/master`}>commit history</a> is the changelog.
      </p>

      <h3>Behaviour changes</h3>
      <p>
        Changes an upgrade may notice, newest first. Each component page documents the current
        behaviour.
      </p>
      <ul>
        <li>
          <strong>Breaking:</strong> <code>Combobox.Root</code>'s{" "}
          <code>inputValueChangeAction</code> is renamed <code>onInputValueChange</code> and the
          type <code>UrgentChangeAction</code> is renamed <code>UrgentChangeHandler</code>; an
          action prop always means a transition (<a href={issue(96)}>#96</a>).
        </li>
        <li>
          Every Menu closes on a right- or middle-click outside; a wheel over a menu never scrolls
          the page (<a href={issue(45)}>#45</a>, <a href={issue(88)}>#88</a>).
        </li>
        <li>
          <code>data-side</code> / <code>data-align</code> on Tooltip, Popover and Menu report the
          side the browser chose while shown, and <code>align</code> start / end mirror under RTL (
          <a href={issue(20)}>#20</a>, <a href={issue(53)}>#53</a>).
        </li>
        <li>
          While a tooltip is showing, the next one opens at once (<a href={issue(21)}>#21</a>).
        </li>
        <li>
          <code>disabled</code> on a link or component <code>render</code> renders{" "}
          <code>aria-disabled="true"</code> instead of native <code>disabled</code> on Toggle,
          ToggleGroup.Item, Menu.Trigger, Combobox.Trigger and Clear, NumberField.Increment and
          Decrement, and the Dialog and Popover Trigger and Close parts where they handle the click;
          a disabled link ToggleGroup.Item is reached by the arrow keys. Form.Submit keeps native{" "}
          <code>disabled</code> (<a href={issue(83)}>#83</a>).
        </li>
        <li>
          <code>Dialog.Close</code>, <code>Popover.Close</code>, <code>Menu.Item</code> and{" "}
          <code>Toast.Action</code> ignore a second click while their own action is pending, with{" "}
          <code>aria-disabled</code> meanwhile; before, a second click ran the action again (
          <a href={issue(81)}>#81</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>Toolbar.Button</code> is removed; use{" "}
          <a href="/components/button">Button</a>, which behaves the same inside a toolbar (
          <a href={issue(79)}>#79</a>).
        </li>
        <li>
          A <code>&lt;ViewTransition&gt;</code> is rendered only when the <code>transition</code>{" "}
          prop is given (<a href={issue(35)}>#35</a>).
        </li>
      </ul>

      <h3>Done</h3>
      <ul>
        <li>
          Library-wide API conventions: action props, pending and optimistic state, Suspense,
          ViewTransition, composition.
        </li>
        <li>
          <a href="/components/toggle">Toggle</a>, <a href="/components/tabs">Tabs</a>,{" "}
          <a href="/components/accordion">Accordion</a> and{" "}
          <a href="/components/tooltip">Tooltip</a>: the first four primitives.
        </li>
        <li>
          <a href="/components/dialog">Dialog</a>, <a href="/components/switch">Switch</a>,{" "}
          <a href="/components/checkbox">Checkbox</a> and{" "}
          <a href="/components/radio-group">RadioGroup</a>, with the shared form-reset and hydration
          handling.
        </li>
        <li>
          Browser-mode tests (Playwright) in Chromium, Firefox and WebKit for Popover, anchor
          positioning, <code>&lt;dialog&gt;</code>, native inputs and ViewTransition.
        </li>
        <li>
          A conditional <code>&lt;ViewTransition&gt;</code> boundary (<a href={issue(35)}>#35</a>).
        </li>
        <li>
          The first npm release, <code>0.1.0-alpha.0</code> (dist-tag <code>alpha</code>).
        </li>
        <li>
          <a href="/components/checkbox-group">CheckboxGroup</a> (<a href={issue(33)}>#33</a>).
        </li>
        <li>
          <a href="/components/popover">Popover</a> (<a href={issue(38)}>#38</a>,{" "}
          <a href={issue(40)}>#40</a>).
        </li>
        <li>
          <a href="/components/menu">Menu</a> (<a href={issue(39)}>#39</a>,{" "}
          <a href={issue(41)}>#41</a>, <a href={issue(47)}>#47</a>).
        </li>
        <li>
          <a href="/components/select">Select</a> and <a href="/components/combobox">Combobox</a>,
          the library's first urgent state, <code>onInputValueChange</code> (
          <a href={issue(50)}>#50</a>).
        </li>
        <li>
          <a href="/components/toast">Toast</a>, <a href="/components/slider">Slider</a> and{" "}
          <a href="/components/field">Field and Form</a> (<a href={issue(54)}>#54</a>).
        </li>
        <li>
          <a href="/components/progress">Progress</a> and <a href="/components/meter">Meter</a>, the
          first output-only components (<a href={issue(68)}>#68</a>).
        </li>
        <li>
          <a href="/components/toggle-group">ToggleGroup</a> and{" "}
          <a href="/components/toolbar">Toolbar</a> (<a href={issue(66)}>#66</a>).
        </li>
        <li>
          <a href="/components/number-field">NumberField</a> (<a href={issue(67)}>#67</a>).
        </li>
        <li>
          <a href="/components/button">Button</a> (<a href={issue(79)}>#79</a>), and re-entry
          handling for every pure trigger (<a href={issue(81)}>#81</a>, <a href={issue(83)}>#83</a>
          ).
        </li>
        <li>
          <a href="/components/context-menu">Context menu</a>: <code>Menu.ContextTrigger</code>,
          press-drag-release, touch long-press and the library's first shipped (positioning-only)
          CSS (<a href={issue(45)}>#45</a>, <a href={issue(88)}>#88</a>). Touch is verified under
          Chromium's emulation; iOS and Android pending (<a href={issue(90)}>#90</a>).
        </li>
        <li>
          Resolved placement (<code>data-side</code> is where the popup is),{" "}
          <a href="/components/tooltip#arrow">Tooltip.Arrow</a>, logical sides and RTL (
          <a href={issue(20)}>#20</a>, <a href={issue(53)}>#53</a>, <a href={issue(88)}>#88</a>).
          Firefox misplaces anchored popups in a direction island (<a href={issue(89)}>#89</a>).
        </li>
        <li>
          <a href="/components/tooltip#skip-delay">Tooltip skip-delay</a> (
          <a href={issue(21)}>#21</a>).
        </li>
        <li>
          <a href="/concepts/content-security-policy">Content Security Policy</a>:{" "}
          <code>STYLE_SHA256</code> and <code>{"<CSPProvider nonce>"}</code> (
          <a href={issue(88)}>#88</a>).
        </li>
        <li>
          Directive-free variants of platform-native parts: considered and not built (
          <a href={issue(19)}>#19</a>);{" "}
          <a href="/concepts/server-components#js-free">Server Components</a> defines "JS-free" and
          the form-control pages show the plain HTML alternative.
        </li>
      </ul>

      <h3>Next</h3>
      <ul>
        <li>More components toward a full set.</li>
      </ul>

      <h3>Deferred</h3>
      <ul>
        <li>
          A directive-free Accordion (<code>@funstack/ui/accordion/native</code>): a ready plan, not
          scheduled (<a href={issue(19)}>#19</a>).
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
