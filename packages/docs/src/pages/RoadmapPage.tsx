import { DocPage } from "../components/DocPage.js";
import { GITHUB_URL, ISSUES_URL } from "../navigation.js";

const issue = (n: number) => `${GITHUB_URL}/issues/${n}`;

export function RoadmapPage() {
  return (
    <DocPage
      title="Roadmap & changelog"
      description="Where FUNSTACK UI is heading, and where to follow changes."
    >
      <p className="page-intro">
        FUNSTACK UI is experimental; alpha releases are on npm. Planning happens in{" "}
        <a href={ISSUES_URL}>GitHub issues</a>; this page is a short summary.
      </p>

      <h3>Changelog</h3>
      <p>
        Alpha releases (<code>0.1.0-alpha.N</code>) are published on npm under the{" "}
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
          A Popover opened by an <code>interestfor</code> button that is not its Trigger (Chromium)
          hides when interest is lost, reported as <code>"dismiss"</code> (
          <a href={issue(127)}>#127</a>).
        </li>
        <li>
          Pressing a button of yours that targets an open Menu or Combobox (a{" "}
          <a href="/concepts/browser-owned-state#foreign-invoker">foreign invoker</a>) no longer
          moves focus out of it first; the button's own close is the only close (
          <a href={issue(126)}>#126</a>).
        </li>
        <li>
          A foreign <code>popovertarget</code> button that closes a Popover, Menu or Combobox is
          reported as <code>"activate"</code> instead of <code>"dismiss"</code> (
          <a href={issue(125)}>#125</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>Popover.Trigger</code>, <code>Menu.Trigger</code>,{" "}
          <code>Menu.SubmenuTrigger</code> and <code>Combobox.Trigger</code> name their popup with{" "}
          <code>popovertarget</code> instead of <code>commandfor</code> +{" "}
          <code>command="toggle-popover"</code>, and a <code>&lt;button&gt;</code> Trigger renders
          no <code>aria-expanded</code>: every browser exposes the popup's state on it. Move CSS
          from <code>[aria-expanded="true"]</code> to <code>[data-open]</code> (now also written in
          Popover's JS-free mode), or to <code>:has(+ :popover-open)</code> on a page that never
          hydrates. <code>commandfor</code>, <code>command</code>, <code>popoverTarget</code> and{" "}
          <code>popoverTargetAction</code> are owned by these Triggers (
          <a href={issue(121)}>#121</a>).
        </li>
        <li>
          Clicking the Trigger of an open Menu or Combobox is a library-owned close on every engine:
          the popup stays shown with <code>data-pending</code> until{" "}
          <code>openChangeAction(false)</code> settles, and the exit view transition runs (
          <a href={issue(110)}>#110</a>, <a href={issue(112)}>#112</a>).
        </li>
        <li>
          An overlay Trigger's <code>aria-expanded</code> and the Combobox input's report whether
          the popup is actually shown; <code>data-open</code> stays optimistic. With{" "}
          <code>defaultOpen</code> the server HTML has <code>aria-expanded="false"</code> until the
          popup is shown after hydration (<a href={issue(118)}>#118</a>).
        </li>
        <li>
          A Trigger click on an open non-modal <code>lightDismiss</code> Dialog dismisses it on
          every engine (<a href={issue(116)}>#116</a>).
        </li>
        <li>
          Popover and Menu Triggers rendered as something other than a <code>&lt;button&gt;</code>{" "}
          are no longer invokers; a development warning explains that they close through light
          dismiss (<a href={issue(115)}>#115</a>).
        </li>
        <li>
          The fallback live region is removed: announcements use <code>ariaNotify</code> only (
          <a href={issue(113)}>#113</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>MenuTriggerProps</code> no longer accepts{" "}
          <code>onMouseDown</code> (<a href={issue(110)}>#110</a>);{" "}
          <code>ComboboxTriggerProps</code> no longer accepts <code>commandfor</code> or{" "}
          <code>command</code> (<a href={issue(112)}>#112</a>); <code>Combobox.Input</code> owns{" "}
          <code>onPointerDown</code> (<a href={issue(123)}>#123</a>).
        </li>
        <li>
          CheckboxGroup compares a controlled <code>value</code> by content, so an inline array with
          the same items does not re-render every Item (<a href={issue(108)}>#108</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>TabsValueChangeDetails.reason</code> and{" "}
          <code>AccordionValueChangeDetails.reason</code> are the shared <code>ChangeReason</code>{" "}
          type (<a href={issue(102)}>#102</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>Combobox.Root</code>'s{" "}
          <code>inputValueChangeAction</code> is renamed <code>onInputValueChange</code> and the
          type <code>UrgentChangeAction</code> is renamed <code>UrgentChangeHandler</code>; an
          action prop always means a transition (<a href={issue(96)}>#96</a>).
        </li>
        <li>
          While a tooltip is showing, the next one opens at once (<a href={issue(21)}>#21</a>).
        </li>
        <li>
          <strong>Breaking:</strong> <code>data-side</code> / <code>data-align</code> on Tooltip,
          Popover and Menu report the side the browser chose while shown, not the requested one; the{" "}
          <code>side</code> type gains <code>"inline-start"</code> / <code>"inline-end"</code> and{" "}
          <code>align</code> start / end mirror under RTL; a submenu opens on the inline-end side
          (the left in RTL) (<a href={issue(20)}>#20</a>, <a href={issue(53)}>#53</a>).
        </li>
        <li>
          Every Menu closes on a right- or middle-click outside; a wheel over a menu never scrolls
          the page (<a href={issue(45)}>#45</a>, <a href={issue(88)}>#88</a>).
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
    </DocPage>
  );
}
