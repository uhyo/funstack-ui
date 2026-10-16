import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
import { Table } from "../components/Tables.js";
import { AccordionFaq } from "../examples/AccordionFaq.js";
import accordionFaqSource from "../examples/AccordionFaq.tsx?raw";

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
        Every part is a client module today, including the Accordion parts: compound parts find
        their Root through context, and a Server Component cannot read context. Directive-free
        variants are tracked in{" "}
        <a href="https://github.com/uhyo/funstack-ui/issues/19">issue #19</a>.
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
          ["Toggle", "Markup and ARIA. Pressing needs JavaScript."],
        ]}
      />
      <p>
        This FAQ is rendered by a Server Component in JS-free mode. It opens and closes with
        JavaScript disabled:
      </p>
      <Example source={accordionFaqSource} fileName="AccordionFaq.tsx">
        <AccordionFaq />
      </Example>
    </div>
  );
}
