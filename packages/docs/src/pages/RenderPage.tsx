import { CodeBlock } from "../components/CodeBlock.js";
import { DocPage } from "../components/DocPage.js";

export function RenderPage() {
  return (
    <DocPage
      title="Replacing the element: render"
      description="How the render prop replaces the element a FUNSTACK UI part renders: the element form, the function form, and how the part's props are merged into yours."
    >
      <p className="page-intro">
        Every <a href="/getting-started#part">part</a> that renders an element accepts{" "}
        <code>render</code>. Use it when the default element is not the one you want: a button from
        your design system, a link instead of a button. You don't need it to style a part; for that,
        see <a href="/getting-started">Getting started</a>.
      </p>

      <h3>Two forms</h3>
      <p>
        The element form replaces the default element and merges the library's props into it. The
        function form hands you the props and the state, and you render the element yourself.
      </p>
      <CodeBlock>{`// Element form: a design-system button. It must accept \`ref\` and spread its props.
<Toggle render={<MyButton variant="ghost" />}>Bold</Toggle>

// Function form: full control.
<Toggle render={(props, state) => <button {...props}>{state.pressed ? "On" : "Off"}</button>} />`}</CodeBlock>
      <p>
        On every component page, each part's props table is followed by two fixed lines:{" "}
        <strong>State</strong>, the object the function props and <code>render</code> receive, and{" "}
        <strong>Owned</strong>, the props the part sets itself, which a <code>render</code> element
        cannot override. Everything not listed passes through to the element.
      </p>
      <p>
        An owned key that is not one of the part&apos;s own props is also left out of its props
        type, in every mode, so passing it is a type error: the <code>role</code>, the ARIA state
        the part computes, <code>type</code>, a roving <code>tabIndex</code>, the invoker attributes
        of a Trigger, and every event handler the part passes to its element (in any mode).
        TypeScript checks a hyphenated attribute such as <code>aria-selected</code> only in an
        object typed as the props, not as a JSX attribute; at runtime the part&apos;s value wins
        either way. Three kinds of owned key stay in the type: the ARIA id lists the part merges
        with yours (marked &quot;token-merged&quot;), a key the part only removes in one case and
        otherwise passes through, and a key owned only inside another component (a control&apos;s{" "}
        <code>id</code> inside a <code>Field.Root</code>). For the raw event of a handler the part
        installs, put your handler on the <code>render</code> element (it runs first) or use{" "}
        <code>ref</code> with <code>addEventListener</code>.
      </p>

      <h3>Merge rules for the element form</h3>
      <ul>
        <li>
          <code>className</code> values are concatenated; <code>style</code> objects are merged (the
          element wins). Event handlers the part installs run after the element's own.
        </li>
        <li>
          Attributes the part computes (its <code>role</code>, ARIA state, ids, <code>data-*</code>{" "}
          state) always win. ARIA id lists (<code>aria-describedby</code>,{" "}
          <code>aria-labelledby</code>, <code>aria-controls</code>) are merged instead.
        </li>
        <li>
          Everything else, the element wins. <code>type="button"</code> is added when the rendered
          element is a <code>&lt;button&gt;</code> or a component (which may render one), and left
          out for another HTML element such as <code>&lt;a&gt;</code>.
        </li>
      </ul>
    </DocPage>
  );
}
