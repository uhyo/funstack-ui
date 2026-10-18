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
        <li>
          A conditional <code>&lt;ViewTransition&gt;</code> boundary: components render one only
          when the <code>transition</code> prop is given, so a component mounting inside a
          transition no longer starts a document view transition (<a href={issue(35)}>#35</a>).
        </li>
        <li>
          The first npm release, <code>0.1.0-alpha.0</code> (dist-tag <code>alpha</code>).
        </li>
        <li>
          <a href="/components/checkbox-group">CheckboxGroup</a>: a <code>&lt;fieldset&gt;</code>{" "}
          with a shared <code>name</code> and a set value, a Parent box with mixed state, and a
          group-level <code>required</code> (<a href={issue(33)}>#33</a>).
        </li>
        <li>
          <a href="/components/popover">Popover</a>: a non-modal overlay on{" "}
          <code>popover="auto"</code> and Invoker Commands, with library-owned closes that animate
          with a view transition in every engine (<a href={issue(38)}>#38</a>,{" "}
          <a href={issue(40)}>#40</a>).
        </li>
        <li>
          <a href="/components/menu">Menu</a>: a menu button whose items run their actions with
          pending state and close the menu when they settle, optimistic checkbox and radio items,
          typeahead and submenus (<a href={issue(39)}>#39</a>, <a href={issue(41)}>#41</a>). Close
          parts and menu items now share one action hook that never drops a rejection (
          <a href={issue(47)}>#47</a>).
        </li>
        <li>
          <a href="/components/select">Select</a>: a real <code>&lt;select&gt;</code> progressively
          enhanced with customizable select (<code>appearance: base-select</code>), with optimistic
          selection, options that load late, and a button that stays in sync with the selected
          option (<a href={issue(50)}>#50</a>).
        </li>
        <li>
          <a href="/components/combobox">Combobox</a>: an editable combobox whose typing is the
          library's first urgent state (<code>inputValueChangeAction</code>, typed{" "}
          <code>UrgentChangeAction</code>), with results from a deferred query inside Suspense,{" "}
          <code>aria-activedescendant</code>, an option that stays pending until its save settles,
          free text, forms, and a default result-count announcement through <code>ariaNotify</code>{" "}
          (<a href={issue(50)}>#50</a>).
        </li>
        <li>
          <a href="/components/toast">Toast</a>: a <code>toast()</code> function feeding an urgent
          queue (a toast shows while the action it reports on is still pending), promise toasts, an
          Undo action prop, <code>closeAction</code> for the Undo window, announcements through{" "}
          <code>ariaNotify</code>, and a region that moves into an open modal Dialog so it stays
          interactive (<a href={issue(54)}>#54</a>).
        </li>
        <li>
          <a href="/components/field">Field and Form</a>: labelled, described fields on native
          constraint validation and <code>:user-invalid</code>, a styleable error instead of the
          bubble with first-invalid focus, and a Form that runs its action in a transition, routes
          server errors to fields and resets only on success (<a href={issue(54)}>#54</a>).
        </li>
      </ul>

      <h3>Next</h3>
      <ul>
        <li>More components toward a full set: ToggleGroup, and more.</li>
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
