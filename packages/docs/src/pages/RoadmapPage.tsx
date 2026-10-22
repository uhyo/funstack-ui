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
          <a href="/components/slider">Slider</a>: the first continuous control, on a visually
          hidden native range per thumb. Every step is a transition (<code>valueChangeAction</code>
          ), each gesture is saved once (<code>valueCommitAction</code>) and rolls back if the save
          fails, and the thumb under the pointer is urgent library state; multi-thumb, vertical and
          RTL (<a href={issue(54)}>#54</a>).
        </li>
        <li>
          <a href="/components/field">Field and Form</a>: labelled, described fields on native
          constraint validation and <code>:user-invalid</code>, a styleable error instead of the
          bubble with first-invalid focus, and a Form that runs its action in a transition, routes
          server errors to fields and resets only on success (<a href={issue(54)}>#54</a>).
        </li>
        <li>
          <a href="/components/progress">Progress</a> and <a href="/components/meter">Meter</a>: the
          first output-only components and the first whose Root is itself a Server Component (no{" "}
          <code>"use client"</code>). ARIA divs with a fill sized by your CSS from a registered
          custom property, localised <code>aria-valuetext</code>, an indeterminate state, the
          platform's meter regions, and the one place the transition advice inverts: a value that
          reports on a pending action is written with a plain <code>setState</code> (
          <a href={issue(68)}>#68</a>).
        </li>
        <li>
          <a href="/components/toggle-group">ToggleGroup</a> and{" "}
          <a href="/components/toolbar">Toolbar</a>: a set of <code>aria-pressed</code> toggles with
          an optimistic set value (exclusive mode included), and a toolbar whose roving focus finds
          its items in the DOM, so menu buttons, toggles, links and inputs join one Tab stop without
          wrapper parts (<a href={issue(66)}>#66</a>).
        </li>
        <li>
          <a href="/components/number-field">NumberField</a>: a text field that holds a number,
          formatted and parsed in the field's locale with <code>Intl.NumberFormat</code> (strict
          grouping), a visually hidden native number input for the form value and the browser's
          constraint messages, press-and-hold buttons, and Slider's step / commit pair with rollback
          (<a href={issue(67)}>#67</a>).
        </li>
        <li>
          <a href="/components/button">Button</a>: a button whose click is a transition, with{" "}
          <code>data-pending</code>, a second click ignored while the action is pending (
          <code>aria-disabled</code> meanwhile, never native <code>disabled</code>), per-submitter
          pending for <code>formAction</code>, and <code>focusableWhenDisabled</code> (
          <a href={issue(79)}>#79</a>). <strong>Breaking:</strong> <code>Toolbar.Button</code> is
          removed; use <code>Button</code> from <code>@funstack/ui/button</code>, which behaves the
          same inside a toolbar.
        </li>
        <li>
          Every pure trigger ignores re-entry: <code>Dialog.Close</code>, <code>Popover.Close</code>
          , <code>Menu.Item</code> and <code>Toast.Action</code> now behave like Button, ignoring a
          second click while their own action is pending, with <code>aria-disabled</code> meanwhile
          (<a href={issue(81)}>#81</a>). Behaviour change: before, a second click ran the action
          again.
        </li>
        <li>
          <code>disabled</code> on a link or component <code>render</code>: Toggle,
          ToggleGroup.Item, Menu.Trigger, Combobox.Trigger and Clear, NumberField.Increment and
          Decrement, and the Dialog and Popover Trigger and Close parts (where they handle the
          click) render <code>aria-disabled="true"</code> instead of native <code>disabled</code>,
          which means nothing on a link, as Button does (<a href={issue(83)}>#83</a>). Behaviour
          change for link and component renders only; a disabled link ToggleGroup.Item is now
          reached by the arrow keys. Form.Submit keeps native <code>disabled</code>.
        </li>
        <li>
          <a href="/components/context-menu">Context menu</a>: <code>Menu.ContextTrigger</code>, a
          region whose right-click, Shift+F10 or touch long-press opens a Menu at the pointer,
          placed with the library's first (positioning-only) shipped CSS; a Root may hold a Menu
          button and a context region sharing one menu (<a href={issue(45)}>#45</a>). Behaviour
          change for every Menu: a right- or middle-click outside now closes it.
        </li>
        <li>
          Placement where the popup is: <code>data-side</code> / <code>data-align</code> on Tooltip,
          Popover and Menu are the side the browser chose after a fallback flip while shown, and the
          new <a href="/components/tooltip#arrow">Tooltip.Arrow</a> follows it (
          <a href={issue(20)}>#20</a>). <code>align</code> start / end and the new{" "}
          <code>side="inline-start"</code> / <code>"inline-end"</code> follow the direction of an
          RTL page or container; submenus open on the inline-end side; Combobox follows an RTL
          container (<a href={issue(53)}>#53</a>); a context menu in RTL opens to the left of the
          pointer (<a href={issue(88)}>#88</a>). Behaviour changes: the attributes report the
          resolved side, and start / end mirror under RTL. Firefox misplaces anchored popups in a
          direction island (<a href={issue(89)}>#89</a>).
        </li>
        <li>
          <a href="/components/tooltip#skip-delay">Tooltip skip-delay</a>: while a tooltip is
          showing, the next one opens at once, page-wide, with no provider (
          <a href={issue(21)}>#21</a>). Behaviour change: moving between tooltips no longer waits.
        </li>
        <li>
          Context menu follow-ups (<a href={issue(88)}>#88</a>): press-drag-release (hold the button
          or finger, slide onto an item, release), a touch menu placed above the finger, a point
          menu closes when the page scrolls, and a wheel over any menu never scrolls the page. Touch
          is verified under Chromium's touch emulation; iOS and Android pending (
          <a href={issue(90)}>#90</a>).
        </li>
        <li>
          <a href="/concepts/content-security-policy">Content Security Policy</a>:{" "}
          <code>@funstack/ui/csp</code> exports <code>STYLE_SHA256</code>, the hashes of the two
          shipped stylesheets, and <code>{"<CSPProvider nonce>"}</code> (<a href={issue(88)}>#88</a>
          ).
        </li>
      </ul>

      <h3>Next</h3>
      <ul>
        <li>More components toward a full set.</li>
      </ul>

      <h3>Deferred</h3>
      <ul>
        <li>
          Directive-free (truly zero-JS) variants of platform-native parts (
          <a href={issue(19)}>#19</a>).
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
