import { CodeBlock } from "../components/CodeBlock.js";
import { Callout, Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { PropsTable, Table } from "../components/Tables.js";
import { ToolbarEditor } from "../examples/ToolbarEditor.js";
import toolbarEditorSource from "../examples/ToolbarEditor.tsx?raw";
import { ToolbarVertical } from "../examples/ToolbarVertical.js";
import toolbarVerticalSource from "../examples/ToolbarVertical.tsx?raw";
import toolbarCss from "../examples/toolbar.css?raw";
import { functionProps, renderProp } from "./shared-props.js";

export function ToolbarPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Toolbar"
        description="A WAI-ARIA toolbar with one Tab stop and arrow keys over any focusable children: toggles, menu buttons, links, inputs. No wrapper parts."
      />
      <h2>Toolbar</h2>
      <p className="page-intro">
        A <code>role="toolbar"</code> container (WAI-ARIA APG Toolbar pattern) with one Tab stop and
        arrow keys between its controls. Its items are its focusable descendants, found in the DOM:
        a <a href="/components/toggle-group">ToggleGroup</a>, a{" "}
        <a href="/components/menu">Menu.Trigger</a>, a <a href="/components/toggle">Toggle</a>, a
        plain <code>&lt;button&gt;</code>, a link or an input all join the sequence without a
        wrapper. <code>Toolbar.Button</code> is a command button with an <code>action</code>.
      </p>

      <Example
        source={toolbarEditorSource}
        fileName="ToolbarEditor.tsx"
        css={toolbarCss}
        cssFileName="toolbar.css"
      >
        <ToolbarEditor />
      </Example>
      <p>
        Tab enters on the last focused control (Bold the first time). Left / Right walk every
        control in document order: both groups, the menu button, the three commands, the input.
        ArrowDown on Insert opens the menu. Copy is disabled but stays focusable, so it is
        announced. In the input, Left / Right move the caret and Tab leaves the toolbar (it is
        last).
      </p>
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
      <Callout title="Choices inside a toolbar: ToggleGroup, not radios">
        <p>
          For a one-of-several choice inside a toolbar (text alignment), use an{" "}
          <code>exclusive</code> <a href="/components/toggle-group">ToggleGroup</a>. Native radios
          (and <a href="/components/radio-group">RadioGroup</a>) currently behave differently on the
          JS path and the native <code>focusgroup</code> path inside a toolbar.
        </p>
      </Callout>

      <h3>Vertical toolbar</h3>
      <Example source={toolbarVerticalSource} fileName="ToolbarVertical.tsx">
        <ToolbarVertical />
      </Example>
      <p>
        Up / Down walk the tools. A <code>Menu.Trigger</code> in a vertical toolbar opens on the
        inline-end arrow: ArrowRight, or ArrowLeft under <code>direction: rtl</code>. Put its popup
        on that side: <code>side="right"</code>, or <code>side="left"</code> in a right-to-left
        page. ArrowDown moves on to the next tool.
      </p>

      <h3>Anatomy</h3>
      <CodeBlock>{`import { Toolbar } from "@funstack/ui/toolbar";

<Toolbar.Root aria-label="Formatting">
  <Toolbar.Button action={cut}>Cut</Toolbar.Button>
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
            "`Toolbar.Button`",
            '`<button type="button">`',
            "A command: `action` in its own transition, `data-pending`, focusable when disabled.",
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
        <code>Toolbar.ToggleGroup</code> parts: put the element itself in the toolbar. Do not pass{" "}
        <code>tabIndex</code> to toolbar items; the toolbar writes <code>tabindex</code> itself. An
        element with its own <code>tabIndex={"{-1}"}</code> stays out of the sequence.
      </p>

      <h3>Props</h3>
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
                browser implements it (Chromium 150+), the browser owns the Tab stop, the arrows,
                Home and End. See <a href="/concepts/experimental">Experimental features</a>.
              </>
            ),
          },
          ...functionProps("ToolbarRootState"),
          renderProp("div", "ToolbarRootState"),
        ]}
      />
      <p>
        <code>ToolbarRootState</code> is <code>{"{ orientation }"}</code>. There is no{" "}
        <code>disabled</code>: disable items individually, or wrap the toolbar in a{" "}
        <code>&lt;fieldset disabled&gt;</code>. <code>role</code>, <code>aria-orientation</code>,{" "}
        <code>onKeyDown</code>, <code>onFocus</code>, <code>onBlur</code> and{" "}
        <code>onPointerDown</code> are the library's and are not props.
      </p>

      <h4>Toolbar.Button</h4>
      <PropsTable
        rows={[
          {
            name: "action",
            type: "Action<[details: ToolbarButtonActionDetails]>",
            description:
              "Runs inside the button's own transition on click, Enter or Space. Sync or async (a Server Function too); rejections reach the nearest Error Boundary above the button.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              'Renders `aria-disabled="true"`: the button stays focusable and in the arrow-key sequence (APG), and never dispatches.',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to the button's `<ViewTransition default>`: animates the commit that ends the action.",
          },
          ...functionProps("ToolbarButtonState"),
          renderProp("button", "ToolbarButtonState"),
        ]}
      />
      <p>
        <code>ToolbarButtonState</code> is <code>{"{ pending, disabled }"}</code>. With{" "}
        <code>render={"{<a href />}"}</code> the link navigates before hydration and runs{" "}
        <code>action</code> after it; it gets no <code>type</code>.
      </p>

      <h4>Toolbar.Separator</h4>
      <PropsTable
        rows={[
          {
            name: "className",
            type: "string | ((state: ToolbarSeparatorState) => string | undefined)",
            description: "A class name, or a function of the separator's state.",
          },
          {
            name: "style",
            type: "CSSProperties | ((state: ToolbarSeparatorState) => CSSProperties | undefined)",
            description: "Inline style, or a function of the separator's state.",
          },
          renderProp("hr", "ToolbarSeparatorState"),
        ]}
      />
      <p>
        <code>ToolbarSeparatorState</code> is <code>{"{ orientation }"}</code>: the separator's own
        orientation, <code>"vertical"</code> in a horizontal toolbar.
      </p>

      <h3>Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          ["`data-orientation`", "Root", "The toolbar's orientation."],
          ["`data-orientation`", "Separator", "The separator's own (perpendicular) orientation."],
          ["`data-pending`", "Button", "Its `action` is in flight."],
          ["`data-disabled`", "Button", 'The `disabled` prop (with `aria-disabled="true"`).'],
        ]}
      />

      <h3>Keyboard</h3>
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
          ["Enter / Space on `Toolbar.Button`", "", "", "Runs `action`, unless disabled."],
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

      <h3>Before hydration</h3>
      <p>
        The toolbar writes <code>tabindex</code> from an effect, so the server HTML has none: before
        hydration every control is its own Tab stop, reachable and working with its native
        behaviour. After hydration there is one Tab stop.
      </p>

      <h3>Styling</h3>
      <CodeBlock language="css">{`.toolbar { display: flex; gap: .25rem; }
.toolbar[data-orientation="vertical"] { flex-direction: column; }
/* <hr> is a block; in a horizontal toolbar it is a vertical rule. */
.toolbar-separator { margin: 0; border: 0; background: var(--line); }
.toolbar-separator[data-orientation="vertical"] { inline-size: 1px; align-self: stretch; }
.toolbar-separator[data-orientation="horizontal"] { block-size: 1px; }
.toolbar-button[aria-disabled="true"] { opacity: .5; }
.toolbar-button[data-pending] { cursor: progress; }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}`}</CodeBlock>
      <p>
        <code>Toolbar.Button transition</code> animates the commit that ends its action with a view
        transition; keep the reduced-motion block above in your stylesheet. The Toolbar adds no view
        transition types of its own.
      </p>
    </div>
  );
}
