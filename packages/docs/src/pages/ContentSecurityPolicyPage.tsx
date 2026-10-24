import { STYLE_SHA256 } from "@funstack/ui/csp";
import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { DocPage } from "../components/DocPage.js";
import { PropsTable, Table } from "../components/Tables.js";

const menuHash = `'sha256-${STYLE_SHA256["@funstack/ui/menu-point"]}'`;
const tooltipHash = `'sha256-${STYLE_SHA256["@funstack/ui/tooltip-warm"]}'`;

export function ContentSecurityPolicyPage() {
  return (
    <DocPage
      title="Content Security Policy"
      description="What a strict style-src needs for FUNSTACK UI: the SHA-256 of the two shipped stylesheets (STYLE_SHA256) or a nonce through CSPProvider, and style-src-attr for server-rendered inline styles."
    >
      <p className="page-intro">
        FUNSTACK UI ships no visual CSS, but it does use inline styles for placement and two tiny
        functional stylesheets. Under a <code>style-src</code> that lists nonces or hashes instead
        of <code>'unsafe-inline'</code>, here is what each needs. Everything is exported from{" "}
        <code>@funstack/ui/csp</code> (and the root entry).
      </p>

      <h3>What the library puts in the page</h3>
      <Table
        head={["Mechanism", "Example", "Under a strict style-src"]}
        rows={[
          [
            "Inline `style` set on the client",
            "the point of a context menu, `position-area` after an update",
            "Allowed: React writes the `style` prop through the CSSOM, which CSP does not govern.",
          ],
          [
            "Inline `style` in server-rendered HTML",
            "`position-area` of an anchored popup, Tooltip's `interest-delay-*`",
            "Blocked without `style-src-attr 'unsafe-inline'` (as for every library that renders inline styles). Blocked, the popup is placed by your stylesheet only until React updates the attribute, and a custom tooltip delay falls back to the browser's.",
          ],
          [
            "Hoisted `<style>` elements",
            "the two stylesheets below",
            "Blocked unless the text matches a `'sha256-…'` source or the element carries your nonce.",
          ],
        ]}
      />

      <h3>The shipped stylesheets and their hashes</h3>
      <p>
        Each is a constant string rendered as a React hoisted <code>&lt;style&gt;</code> (one per
        page, deduplicated by its <code>href</code>), only by the part that needs it. Their base64
        SHA-256 is exported as <code>STYLE_SHA256</code>, keyed by <code>href</code>; a test
        recomputes it from the CSS, so it cannot drift from what the parts render.
      </p>
      <Table
        head={["href", "Rendered by", "When", "style-src source"]}
        rows={[
          [
            "`@funstack/ui/menu-point`",
            "`Menu.Popup`",
            "On the client, the first time a menu opens at a point (`Menu.ContextTrigger`) without `side={null}`",
            `\`${menuHash}\``,
          ],
          [
            "`@funstack/ui/tooltip-warm`",
            "`Tooltip.Trigger`",
            "With `experimental_interestFor` only, during server rendering too",
            `\`${tooltipHash}\``,
          ],
        ]}
      />
      <CodeBlock language="bash">{`Content-Security-Policy: style-src 'self' ${menuHash} ${tooltipHash}; style-src-attr 'unsafe-inline'`}</CodeBlock>
      <CodeBlock>{`import { STYLE_SHA256 } from "@funstack/ui/csp";

const styleSources = Object.values(STYLE_SHA256).map((hash) => \`'sha256-\${hash}'\`);`}</CodeBlock>
      <p>
        Hashes need no code and suit static sites (FUNSTACK Static's output, a CDN): the values only
        change with a library release, so compute the header from <code>STYLE_SHA256</code> at build
        time rather than copying them.
      </p>

      <h3>Nonces: CSPProvider</h3>
      <p>
        With a per-response nonce, render <code>{"<CSPProvider nonce>"}</code> once around the app.
        Every part that renders a hoisted <code>&lt;style&gt;</code> puts the nonce on it. It is the
        library's only provider, and its prop is serialisable, so a Server Component layout that
        knows the nonce renders it directly.
      </p>
      <CodeBlock>{`import { CSPProvider } from "@funstack/ui/csp";

export function Layout({ nonce, children }: { nonce: string; children: React.ReactNode }) {
  return <CSPProvider nonce={nonce}>{children}</CSPProvider>;
}

// Server: pass the same value as React's style nonce.
renderToReadableStream(<App nonce={nonce} />, { nonce: { script: nonce, style: nonce } });`}</CodeBlock>
      <Callout kind="warning" title="Pass the same value as React's nonce.style">
        <p>
          During server rendering React (19.3) checks a hoisted <code>&lt;style&gt;</code> against
          the <code>nonce: {"{ style }"}</code> render option:
        </p>
        <ul>
          <li>Same value on the element and the option: written with the nonce.</li>
          <li>
            <strong>
              If you pass <code>nonce.style</code>, render <code>{"<CSPProvider>"}</code> with the
              same value; without it React drops the rule
            </strong>{" "}
            (the element has no nonce), and so does a different value.
          </li>
          <li>
            No <code>nonce</code> option, or the string form <code>nonce: "…"</code> (scripts only):
            the rule is written <strong>without</strong> a nonce, so a nonce policy blocks it in the
            browser.
          </li>
        </ul>
        <p>
          This matters for the tooltip stylesheet, which can render on the server; the menu
          stylesheet is only ever inserted on the client.
        </p>
      </Callout>
      <PropsTable
        rows={[
          {
            name: "nonce",
            type: "string",
            description:
              "The nonce of your `style-src`, forwarded as the `nonce` of every library `<style>`. Use the value you pass as React's `nonce.style`.",
          },
          {
            name: "children",
            type: "ReactNode",
            description: "Your app.",
          },
        ]}
      />
      <p>
        The library does not read a <code>&lt;meta property="csp-nonce"&gt;</code> on its own: the
        server render needs the value in props anyway.
      </p>

      <h3>If a stylesheet is blocked</h3>
      <ul>
        <li>
          <strong>Menu point rules</strong>: a context menu still opens at the pointer, but it never
          flips at the viewport edges.
        </li>
        <li>
          <strong>Tooltip skip-delay rule</strong>: on Chromium's native path (
          <code>experimental_interestFor</code>) the next tooltip waits its <code>delay</code>{" "}
          instead of opening at once (the Trigger's <code>var(--fsui-tooltip-warm, 0)</code> falls
          back to <code>0</code>, not to the browser's own delay). The JS path does not use the
          stylesheet.
        </li>
      </ul>
    </DocPage>
  );
}
