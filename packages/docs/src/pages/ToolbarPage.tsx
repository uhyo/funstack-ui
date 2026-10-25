import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { ToolbarEditor } from "../examples/ToolbarEditor.js";
import { ToolbarVertical } from "../examples/ToolbarVertical.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function ToolbarPage() {
  return (
    <DocPage
      title="Toolbar"
      description="A WAI-ARIA toolbar with one Tab stop and arrow keys over any focusable children: toggles, menu buttons, links, inputs. No wrapper parts."
    >
      <p className="page-intro">
        A <code>role="toolbar"</code> container (WAI-ARIA APG Toolbar pattern) with one Tab stop and
        arrow keys between its controls. Its items are its focusable descendants, found in the DOM:
        a <a href="/components/toggle-group">ToggleGroup</a>, a{" "}
        <a href="/components/menu">Menu.Trigger</a>, a <a href="/components/toggle">Toggle</a>, a
        plain <code>&lt;button&gt;</code>, a link or an input all join the sequence without a
        wrapper. A command button is a <a href="/components/button">Button</a>, which stays
        focusable when disabled inside a toolbar.
      </p>

      <Example file="ToolbarEditor.tsx" css="toolbar.css">
        <ToolbarEditor />
      </Example>
      <p>
        Tab enters on the last focused control (Bold the first time). Left / Right walk every
        control in document order: both groups, the menu button, the three commands, the input.
        ArrowDown on Insert opens the menu. Copy is disabled but stays focusable, so it is
        announced. In the input, Left / Right move the caret and Tab leaves the toolbar (it is
        last).
      </p>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Button } from "@funstack/ui/button";
import { Toolbar } from "@funstack/ui/toolbar";

<Toolbar.Root aria-label="Formatting">
  <Button action={cut}>Cut</Button>
  <Toolbar.Separator />
  <ToggleGroup.Root aria-label="Text style">…</ToggleGroup.Root>
  <Menu.Root>…</Menu.Root>
</Toolbar.Root>`}</CodeBlock>
      <Table
        head={["Part", "Element", "Role"]}
        rows={[
          [
            "`Toolbar.Root`",
            '`<div role="toolbar" aria-orientation>`',
            "Finds its items in the DOM and moves focus between them.",
          ],
          [
            "`Toolbar.Separator`",
            "`<hr aria-orientation>`",
            "A divider, perpendicular to the toolbar. Not focusable.",
          ],
        ]}
      />
      <p>
        There are no <code>Toolbar.Link</code>, <code>Toolbar.Group</code> or{" "}
        <code>Toolbar.ToggleGroup</code> parts: put the element itself in the toolbar. A command is
        a <a href="/components/button">Button</a>; inside a toolbar its <code>disabled</code>{" "}
        renders <code>aria-disabled="true"</code> (it implies <code>focusableWhenDisabled</code>
        ), so it stays focusable and is announced. Do not pass <code>tabIndex</code> to toolbar
        items; the toolbar writes <code>tabindex</code> itself. An element with its own{" "}
        <code>tabIndex={"{-1}"}</code> stays out of the sequence.
      </p>

      <h3 id="props">Props</h3>
      <h4>Toolbar.Root</h4>
      <PropsTable
        rows={[
          {
            name: "orientation",
            type: '"horizontal" | "vertical"',
            default: '"horizontal"',
            description: "Axis of the arrow keys; also `aria-orientation`.",
          },
          {
            name: "loop",
            type: "boolean",
            default: "true",
            description: "Arrows wrap from the last item to the first.",
          },
          {
            name: "experimental_focusgroup",
            type: "boolean",
            default: "false",
            description: (
              <>
                Renders <code>focusgroup="toolbar inline|block wrap|nowrap"</code>; where the
                browser implements it (Chromium 150+), the browser owns the single Tab stop (with
                memory of the last focused item), the arrows, Home and End, and the library writes
                no <code>tabindex</code>. See{" "}
                <a href="/concepts/experimental">Experimental features</a>.
              </>
            ),
          },
          ...functionProps("ToolbarRootState"),
          renderProp("div", "ToolbarRootState"),
        ]}
      />
      <PartFacts
        state={"`ToolbarRootState` is `{ orientation }`."}
        owned={
          '`role` (`"toolbar"`), `aria-orientation`, `data-orientation`, `onKeyDown`, `onFocus`, `onBlur`, `onPointerDown`, `focusgroup` (with the flag), and the `tabindex` of its items.'
        }
        note={
          "There is no `disabled`: disable items individually, or wrap the toolbar in a `<fieldset disabled>`."
        }
      />

      <h4>Toolbar.Separator</h4>
      <PropsTable
        rows={[...stylingProps("ToolbarSeparatorState"), renderProp("hr", "ToolbarSeparatorState")]}
      />
      <PartFacts
        state={
          '`ToolbarSeparatorState` is `{ orientation }`: the separator\'s own orientation, `"vertical"` in a horizontal toolbar.'
        }
        owned={"`aria-orientation`, `data-orientation`."}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`data-orientation`", "Root", "The toolbar's orientation."],
          ["`data-orientation`", "Separator", "The separator's own (perpendicular) orientation."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Horizontal", "Vertical", "Effect"]}
        rows={[
          [
            "ArrowRight / ArrowLeft",
            "Next / previous item (swapped under `direction: rtl`)",
            "Ignored",
            "Moves focus; wraps if `loop`.",
          ],
          ["ArrowDown / ArrowUp", "Ignored", "Next / previous item", "Same."],
          ["Home / End", "First / last item", "Same", "Same."],
          [
            "Any of the above on a native radio",
            "",
            "",
            "The radio group's own: checks the next / previous radio, staying within the group (it wraps, except in Safari).",
          ],
          [
            "Tab / Shift+Tab on a native radio",
            "",
            "",
            "The checked radio of its group if focus is on another one; else the next / previous toolbar item while one exists.",
          ],
          [
            "Any of the above on a text-entry item",
            "",
            "",
            "Not handled: the item keeps its caret.",
          ],
          [
            "Tab / Shift+Tab on a text-entry item",
            "",
            "",
            "Next / previous toolbar item while one exists; otherwise leaves the toolbar.",
          ],
          [
            "Tab / Shift+Tab elsewhere",
            "",
            "",
            "Leaves the toolbar; re-entry lands on the last focused item.",
          ],
          [
            "Enter / Space on a `Button`",
            "",
            "",
            "Runs `action`, unless disabled or already pending.",
          ],
          [
            "A key the item handled itself",
            "",
            "",
            "Ignored by the toolbar (a `Menu.Trigger`'s ArrowDown opens its menu).",
          ],
        ]}
      />
      <p>
        Natively <code>disabled</code> controls are skipped; <code>aria-disabled</code> ones are
        reached. A popup rendered inside the toolbar (a <code>Menu.Popup</code>) is not part of the
        sequence: its items are the menu's.
      </p>

      <h4>A ToggleGroup inside a Toolbar</h4>
      <p>
        The group joins the toolbar's single sequence: Left / Right (or Up / Down when vertical)
        flow through its Items like any other items, and the other axis does nothing on them. The
        group's own <code>orientation</code>, <code>loop</code> and{" "}
        <code>experimental_focusgroup</code> are ignored there (with a development warning); it
        still renders <code>role="group"</code>, its label and its pending state.
      </p>

      <h4>A Menu.Trigger inside a Toolbar</h4>
      <Table
        head={[
          "Context",
          "Opens with the first item",
          "Opens with the last item",
          "Left to the Toolbar",
        ]}
        rows={[
          ["Horizontal Toolbar", "ArrowDown", "ArrowUp", "ArrowLeft / ArrowRight"],
          [
            "Vertical Toolbar",
            "ArrowRight (ArrowLeft under `direction: rtl`)",
            "–",
            "ArrowDown / ArrowUp",
          ],
        ]}
      />

      <Callout title="Label the toolbar">
        <p>
          A toolbar must have a name: pass <code>aria-label</code> or <code>aria-labelledby</code>.
          Name each ToggleGroup inside it too.
        </p>
      </Callout>
      <Callout title="One text-entry control, last">
        <p>
          An input, textarea, select, contenteditable or a control with role <code>textbox</code>,{" "}
          <code>combobox</code>, <code>spinbutton</code> or <code>slider</code> keeps its arrow
          keys, Home and End. From it, Tab and Shift+Tab move to the next and previous toolbar item
          while one exists (as Chromium's native <code>focusgroup</code> does). Following the APG,
          put at most one such control in a toolbar, and put it last.
        </p>
      </Callout>
      <Callout title="Radios inside a toolbar trap the arrow keys">
        <p>
          A group of native radios with one <code>name</code> (a{" "}
          <a href="/components/radio-group">RadioGroup</a> too) is one toolbar item. The toolbar's
          arrows land on its checked radio, or on its first radio when none is checked. On a radio,
          every arrow key is the radio group's: it checks as it moves and stays within the group
          (wrapping, except in Safari), so in a horizontal toolbar ArrowLeft / ArrowRight never
          leave the group (ArrowUp / ArrowDown in a vertical one). Leave it with Tab or Shift+Tab,
          which move to the next or previous toolbar item; from an unchecked radio they visit the
          checked one first. Both the JS path and Chromium's native <code>focusgroup</code> behave
          this way. Radios that share a <code>name</code> but belong to different forms (
          <code>form=</code>) are not told apart.
        </p>
        <p>
          For a one-of-several choice that is transparent to the toolbar's arrows (text alignment),
          use an <code>exclusive</code> <a href="/components/toggle-group">ToggleGroup</a>. For Up /
          Down within the group and Left / Right through the toolbar, as in the APG Toolbar example,
          build the group from <code>button[role="radio"]</code> elements with your own key
          handlers: custom radios are ordinary toolbar items.
        </p>
      </Callout>

      <BehaviourSection
        id="transition-types"
        summary={"None: the Toolbar has no state of its own."}
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={"None of its own: controls inside keep their own optimistic and pending state."}
      />

      <BehaviourSection
        id="suspense"
        summary={"Nothing specific: the Toolbar renders no content region."}
      />

      <BehaviourSection id="browser-owned-state" summary={"None."} />

      <BehaviourSection
        id="before-hydration"
        summary={
          "The toolbar writes `tabindex` from an effect, so the server HTML has none: before hydration every control is its own Tab stop, reachable and working with its native behaviour. After hydration there is one Tab stop."
        }
      />

      <h3 id="styling">Styling</h3>
      <CodeBlock language="css">{`.toolbar { display: flex; gap: .25rem; }
.toolbar[data-orientation="vertical"] { flex-direction: column; }
/* <hr> is a block; in a horizontal toolbar it is a vertical rule. */
.toolbar-separator { margin: 0; border: 0; background: var(--line); }
.toolbar-separator[data-orientation="vertical"] { inline-size: 1px; align-self: stretch; }
.toolbar-separator[data-orientation="horizontal"] { block-size: 1px; }
.toolbar-button[data-disabled] { opacity: .5; }
.toolbar-button[data-pending] { cursor: progress; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}`}</CodeBlock>
      <p>
        A <code>Button</code>'s <code>transition</code> animates the commit that ends its action
        with a view transition; keep the reduced-motion block above in your stylesheet. The Toolbar
        adds no view transition types of its own.
      </p>

      <h3 id="recipes">Recipes</h3>
      <h4>Vertical toolbar</h4>
      <Example file="ToolbarVertical.tsx">
        <ToolbarVertical />
      </Example>
      <p>
        Up / Down walk the tools. A <code>Menu.Trigger</code> in a vertical toolbar opens on the
        inline-end arrow: ArrowRight, or ArrowLeft under <code>direction: rtl</code>. Put its popup
        on that side: <code>side="inline-end"</code>, the right in LTR and the left in a
        right-to-left page or container. ArrowDown moves on to the next tool.
      </p>
    </DocPage>
  );
}
