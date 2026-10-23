import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";
import { AccordionFaq } from "../examples/AccordionFaq.js";
import accordionFaqSource from "../examples/AccordionFaq.tsx?raw";
import { DialogConfirm } from "../examples/DialogConfirm.js";
import dialogConfirmSource from "../examples/DialogConfirm.tsx?raw";

export function ServerComponentsPage() {
  return (
    <div className="learn-content">
      <PageHead
        title="Server Components"
        description="FUNSTACK UI parts are client modules that Server Components can render directly. Some behaviour works before hydration."
      />
      <h2>Server Components</h2>
      <p className="page-intro">
        A Server Component can render every FUNSTACK UI part directly. Which behaviour works before
        hydration depends on how much of it the platform does.
      </p>

      <h3>
        Per-file <code>"use client"</code>
      </h3>
      <p>
        The package is built unbundled: one output file per source file, and every file that uses a
        client-only API keeps its <code>"use client"</code> directive. The component namespaces (
        <code>Tabs</code>, <code>Accordion</code>, ...) are plain objects of client references, so
        this works in a Server Component:
      </p>
      <CodeBlock>{`// app/settings.tsx: a Server Component, no "use client"
import { Tabs } from "@funstack/ui/tabs";

export function Settings() {
  return (
    <Tabs.Root defaultValue="general">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="general">General</Tabs.Tab>
        <Tabs.Tab value="billing">Billing</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="general"><GeneralSettings /></Tabs.Panel>
      <Tabs.Panel value="billing"><BillingSettings /></Tabs.Panel>
    </Tabs.Root>
  );
}`}</CodeBlock>
      <p>
        Compound parts find their Root through context, and a Server Component cannot read context,
        so parts are client modules, including the Accordion and Dialog parts. The exceptions are{" "}
        <a href="/components/progress">Progress</a> and <a href="/components/meter">Meter</a>: their
        Roots have no <code>"use client"</code> (they only compute, then render a context provider
        created in a client module), so a Server Component renders the Root on the server, may pass
        it function props, and only the small context module and the parts reach the browser.
      </p>
      <p>
        Server-rendered ids inside FUNSTACK Static <code>defer()</code> need{" "}
        <code>@funstack/static</code> 1.3.4 or later; other frameworks that render several server
        payloads into one page must give each its own <code>identifierPrefix</code>, or ids from
        different payloads can collide.
      </p>

      <h3>What "JS-free" means</h3>
      <p>
        "JS-free" on this site (the JS-free modes of Accordion and Dialog, the native Tooltip path
        in Chromium) means two things: no behaviour JavaScript runs on the native path, because the
        browser does the interaction, and the server HTML works before hydration and without it. It
        does <strong>not</strong> mean "no client bundle". The parts are <code>"use client"</code>{" "}
        modules, so in a Server Components app they are shipped and hydrated with the page like any
        client component, whatever props they receive.
      </p>
      <p>
        For scale, measured on FUNSTACK Static (the stack this site is built with): a page whose
        Server Components render no client component at all still loads about 76 KB gzip of
        framework runtime (React, react-dom and the RSC client) and hydrates the document. The parts
        add a few KB on top: about 5 KB gzip for Accordion or Tooltip, 4 KB for Switch and 2 KB for
        Progress, and less each when several share internals. Other RSC hosts were not measured;
        Next.js App Router and Waku also boot a client runtime on every page.
      </p>
      <p>
        Where a page really ships no JavaScript, such as server rendering or a static prerender that
        is never hydrated (<code>react-dom/static</code> <code>prerender</code>,{" "}
        <code>renderToString</code>), <code>"use client"</code> has no effect and the parts' HTML
        works as is: a JS-free Accordion opens and closes, and a Switch is a native checkbox that
        posts with its form. There is no separate directive-free variant of the parts: it was
        considered in <a href="https://github.com/uhyo/funstack-ui/issues/19">issue #19</a> and not
        built, since it would save those few KB but not the runtime. For a single form control, the{" "}
        <a href="/components/switch">Switch</a>, <a href="/components/checkbox">Checkbox</a>,{" "}
        <a href="/components/radio-group">RadioGroup</a>, <a href="/components/select">Select</a>,{" "}
        <a href="/components/slider">Slider</a> and{" "}
        <a href="/components/number-field">NumberField</a> pages show the plain HTML a Server
        Component can render instead, and what it gives up.
      </p>

      <h3>Actions from the server</h3>
      <p>
        A Server Component can only pass serialisable props, so it cannot pass a plain function as
        an action. It can pass a Server Function, which works directly because <code>details</code>{" "}
        serialises cleanly (see <a href="/concepts/action-props">Action props</a>):
      </p>
      <CodeBlock>{`import { Accordion } from "@funstack/ui/accordion";
import { saveOpenSections } from "./actions"; // "use server"

<Accordion.Root defaultValue={user.openSections} valueChangeAction={saveOpenSections}>
  ...
</Accordion.Root>`}</CodeBlock>

      <h3>Before hydration</h3>
      <Table
        head={["Component", "Works before hydration"]}
        rows={[
          [
            "Accordion, JS-free mode",
            "Everything: open and close, Enter and Space, the `exclusive` group (`<details name>`), find-in-page, CSS animation. Hydration only adds arrow-key navigation and `disabled`.",
          ],
          [
            "Accordion, library mode",
            'The native toggle. Items opened before hydration are reconciled on mount with one `valueChangeAction` call (`reason: "platform"`).',
          ],
          [
            "Tooltip",
            "With `experimental_interestFor` and `experimental_hint` in Chromium: the whole tooltip (it is plain HTML). Elsewhere the JS path attaches at hydration. The ARIA relation is in the HTML either way.",
          ],
          [
            "Tabs",
            'Markup and ARIA. With `keepMounted="until-found"`, hidden panels are in the HTML and searchable. Switching tabs needs JavaScript.',
          ],
          [
            "Button",
            "A `commandfor` / `command` Button runs its command, a Server Function `formAction` submits (React's progressive enhancement) and a `render={<a href>}` link navigates. An `action` Button needs JavaScript; a Server Function is a valid `action` once hydrated.",
          ],
          ["Toggle", "Markup and ARIA. Pressing needs JavaScript."],
          [
            "Dialog, JS-free mode",
            'Everything for a modal dialog: open (`command="show-modal"`), Escape, Close buttons (`command="request-close"`), `<form method="dialog">`, focus and focus return, `autoFocus` in server-rendered markup (`initialFocus` after hydration), CSS animation. A `Dialog.Form` with a Server Function action submits with React\'s progressive enhancement. Hydration adds `initialFocus`, `lightDismiss` and closing after a form action. A non-modal dialog needs JavaScript to open.',
          ],
          [
            "Dialog, library mode",
            'The Trigger opens the dialog natively, but its content is not in the HTML. On hydration the dialog is reconciled with one `openChangeAction(true)` call (`reason: "platform"`) and the content mounts.',
          ],
          [
            "Switch, Checkbox, RadioGroup, CheckboxGroup",
            'They are native inputs: clicking, Space, arrow keys between radios, labels, `required` and form submission all work. On hydration a changed value is reconciled with one action call (`reason: "platform"`, one per group). `Checkbox indeterminate` and a mixed `CheckboxGroup.Parent` are drawn from `data-indeterminate` but announced as unchecked until hydration; a Parent clicked before hydration counts as "check all" of its values. A required CheckboxGroup keeps the server\'s `required` attributes until hydration.',
          ],
          [
            "Select",
            'A native select: picking, the keyboard, typeahead, `required` and form submission all work, and with `appearance: base-select` the browser copies the selected option into `Select.Value` before hydration. On hydration a changed value is reconciled with one `valueChangeAction` call (`reason: "platform"`).',
          ],
          [
            "Progress, Meter",
            "Everything: there is no behaviour. The HTML carries the role, the values, `aria-valuetext`, the data attributes and the custom property, and your CSS draws the bar from the first paint. The Root is itself a Server Component.",
          ],
          [
            "Combobox",
            'A plain text field: typing works and the form posts the default selection (and the raw text, if the Input has a `name`). The listbox never opens before hydration. Text typed then is kept and reported once through `inputValueChangeAction` (`reason: "platform"`).',
          ],
        ]}
      />
      <p>
        This FAQ is rendered by a Server Component in JS-free mode. It opens and closes before the
        page has hydrated, and in any page that works without JavaScript. (This site streams each
        page behind a Suspense boundary, which needs a small inline script to reveal it, so here it
        needs JavaScript enabled, but not the library's.)
      </p>
      <Example source={accordionFaqSource} fileName="AccordionFaq.tsx">
        <AccordionFaq />
      </Example>
      <p>
        So is this confirmation dialog. Every button in it is a native invoker or a form submit:
      </p>
      <Example source={dialogConfirmSource} fileName="DialogConfirm.tsx">
        <DialogConfirm />
      </Example>
    </div>
  );
}
