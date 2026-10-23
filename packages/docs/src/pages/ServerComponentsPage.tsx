import { CodeBlock } from "../components/CodeBlock.js";
import { ConceptExample, Term } from "../components/Concept.js";
import { Example } from "../components/Example.js";
import { PageHead } from "../components/PageHead.js";
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
        A Server Component can render every FUNSTACK UI <a href="/getting-started#part">part</a>{" "}
        directly. Which behaviour works before hydration depends on how much of it the platform
        does.
      </p>
      <p>
        <Term id="hydration">Hydration</Term> is the moment React attaches to server-rendered HTML
        in the browser: until then the page is plain HTML that the browser alone drives, and
        afterwards React's event handlers and state are live.
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
        so parts are client modules. The exceptions are <a href="/components/progress">Progress</a>{" "}
        and <a href="/components/meter">Meter</a>: their Roots have no <code>"use client"</code>{" "}
        (they only compute, then render a context provider created in a client module), so a Server
        Component renders the Root on the server, may pass it function props, and only the small
        context module and the parts reach the browser.
      </p>
      <p>
        Server-rendered ids inside FUNSTACK Static <code>defer()</code> need{" "}
        <code>@funstack/static</code> 1.3.4 or later; other frameworks that render several server
        payloads into one page must give each its own <code>identifierPrefix</code>, or ids from
        different payloads can collide.
      </p>

      <h3 id="js-free">What "JS-free" means</h3>
      <p>
        "JS-free" on this site (the{" "}
        <a href="/concepts/browser-owned-state#js-free-mode">JS-free mode</a> of a component, the
        native Tooltip path in Chromium) means two things: no behaviour JavaScript runs on the
        native path, because the browser does the interaction, and the server HTML works before
        hydration and without it. It does <strong>not</strong> mean "no client bundle". The parts
        are <code>"use client"</code> modules, so in a Server Components app they are shipped and
        hydrated with the page like any client component, whatever props they receive.
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
        works as is, to the extent described under <a href="#before-hydration">Before hydration</a>
        below. There is no separate directive-free variant of the parts: it was considered in{" "}
        <a href="https://github.com/uhyo/funstack-ui/issues/19">issue #19</a> and not built, since
        it would save those few KB but not the runtime. For a single form control, the component
        page has a <strong>Plain HTML</strong> section where that is an option: the HTML a Server
        Component can render instead, and what it gives up (for example{" "}
        <a href="/components/switch">Switch</a>).
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

      <h3 id="before-hydration">Before hydration</h3>
      <p>
        The server HTML of every part carries its markup, its ARIA attributes and its data
        attributes, so it is accessible and styled from the first paint. What the user can{" "}
        <em>do</em> before hydration depends on who performs the interaction:
      </p>
      <ul>
        <li>
          <strong>Behaviour the browser performs</strong> works before hydration and without
          JavaScript: a <code>&lt;details&gt;</code> that opens, a native input that toggles and
          posts with its form, a dialog opened by an invoker command, a tooltip shown on interest
          (where the engine implements <code>interestfor</code>). Components are built on these
          elements wherever the platform offers them (see{" "}
          <a href="/concepts/browser-owned-state">Browser-owned state</a>).
        </li>
        <li>
          <strong>Behaviour the library performs</strong> (a transition, an action, keyboard
          navigation the platform lacks, content rendered on demand) starts at hydration. Until then
          the part shows its server state and does nothing on interaction, or falls back to what the
          native element does.
        </li>
        <li>
          <strong>Changes the browser made before hydration are not lost.</strong> When a native
          element's state differs from the server's at hydration (an item opened, a box checked,
          text typed), the component reconciles on mount with one dispatch (for a continuous
          control, one step and one commit), with <code>details.reason === "platform"</code> (see{" "}
          <a href="/concepts/action-props">Action props</a>).
        </li>
        <li>
          <strong>Server Function actions</strong> on native form paths (a <code>formAction</code>,
          a form's <code>action</code>) submit before hydration through React's progressive
          enhancement.
        </li>
      </ul>
      <p>
        Each component page says exactly what works before hydration in its{" "}
        <strong>Before hydration</strong> section.
      </p>
      <ConceptExample component="Accordion" href="/components/accordion">
        <p>
          An Accordion without value props runs in JS-free mode: the browser owns every{" "}
          <code>&lt;details open&gt;</code>, so opening and closing, the exclusive group and
          find-in-page all work before hydration; hydration only adds arrow-key navigation and{" "}
          <code>disabled</code>. With value props (library mode) the native toggle still works
          before hydration, and items opened then are reconciled on mount with one{" "}
          <code>valueChangeAction</code> call.
        </p>
        <p>
          This FAQ is rendered by a Server Component in JS-free mode. It opens and closes before the
          page has hydrated, and in any page that works without JavaScript. (This site streams each
          page behind a Suspense boundary, which needs a small inline script to reveal it, so here
          it needs JavaScript enabled, but not the library's.)
        </p>
        <Example source={accordionFaqSource} fileName="AccordionFaq.tsx">
          <AccordionFaq />
        </Example>
      </ConceptExample>
    </div>
  );
}
