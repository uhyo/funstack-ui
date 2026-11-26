import { Callout } from "../components/Callout.js";
import { CodeBlock } from "../components/CodeBlock.js";
import { Example } from "../components/Example.js";
import { DocPage } from "../components/DocPage.js";
import { Table } from "../components/Tables.js";
import { ScrollAreaNotes } from "../examples/ScrollAreaNotes.js";

export function ScrollAreaPage() {
  return (
    <DocPage
      title="Scroll areas"
      description="There is no ScrollArea part: a native scroller with scrollbar-width, scrollbar-color and scrollbar-gutter, edge fades from a scroll-driven animation, and a Tab stop for content with nothing focusable. A recipe, run in Chromium, Firefox and WebKit."
    >
      <p className="page-intro">
        FUNSTACK UI has no ScrollArea part, by decision. A ScrollArea in other libraries hides the
        native scrollbar and draws one out of <code>div</code>s, because restyling a scrollbar once
        needed a different hack per engine. Today the standard properties work in all three engines,
        the fades at the edges are a scroll-driven animation, and the one gap a native scroller
        still has (keyboard access in Safari) is an attribute. This page is the recipe: plain CSS
        and HTML, no JavaScript, no part.
      </p>

      <Example file="ScrollAreaNotes.tsx" css="scroll-area.css">
        <ScrollAreaNotes />
      </Example>
      <p>
        This example is a Server Component with no library code in it. Scroll either list: the fade
        at an edge appears once there is content beyond it.
      </p>

      <h3 id="scrollbar">The scrollbar</h3>
      <CodeBlock language="css">{`.scroll-area {
  overflow: auto;
  scrollbar-width: thin;                      /* auto | thin | none */
  scrollbar-color: var(--thumb) transparent;  /* thumb, then track */
  scrollbar-gutter: stable;                   /* space for the bar before the content overflows */
  overscroll-behavior: contain;               /* reaching an end does not scroll the page */
}
.scroll-area:hover,
.scroll-area:focus-visible { scrollbar-color: var(--thumb-strong) transparent; }`}</CodeBlock>
      <Table
        head={["Property", "Chrome", "Firefox", "Safari"]}
        rows={[
          ["`scrollbar-width`", "121", "64", "18.2"],
          ["`scrollbar-color`", "121", "64", "26.2"],
          ["`scrollbar-gutter`", "94", "97", "18.2"],
        ]}
      />
      <ul>
        <li>
          <code>scrollbar-gutter: stable</code> reserves the bar&apos;s space where scrollbars take
          space (classic scrollbars on Windows and most Linux desktops), so the content does not
          shift when it starts to overflow. Where scrollbars overlay the content (macOS by default,
          mobile) it reserves nothing.
        </li>
        <li>
          The user&apos;s settings keep working: "always show scroll bars", the system scrollbar
          size, forced colours. A drawn bar loses all three.
        </li>
        <li>
          <code>thin</code> is the only size: its pixels, and the thumb&apos;s shape, are the
          engine&apos;s.
        </li>
      </ul>

      <h4 id="webkit-scrollbar">A rounded thumb in Chromium and desktop Safari</h4>
      <p>
        <code>::-webkit-scrollbar</code> and its relatives still exist in Chromium and desktop
        Safari (not in Firefox; iOS honours only <code>display: none</code>), and give the thumb a
        radius and an inset. Chromium ignores them as soon as <code>scrollbar-width</code> or{" "}
        <code>scrollbar-color</code> is not <code>auto</code>, so choose one or the other per
        engine:
      </p>
      <CodeBlock language="css">{`.scroll-area::-webkit-scrollbar { inline-size: 10px; block-size: 10px; }
.scroll-area::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 5px; background: var(--thumb) padding-box; }

/* Firefox, and any engine without the pseudo-elements. */
@supports not selector(::-webkit-scrollbar) {
  .scroll-area { scrollbar-width: thin; scrollbar-color: var(--thumb) transparent; }
}`}</CodeBlock>
      <p>
        The pseudo-elements are non-standard: forced colours and the user&apos;s scrollbar settings
        do not reach a thumb drawn with them either. <strong>iOS Safari</strong> matches the
        selector (so the <code>@supports not selector(…)</code> block does not apply there) but
        honours only <code>display: none</code> on it, so iOS gets neither the drawn thumb nor the
        standard properties: its overlay scrollbar stays the system&apos;s. If you want{" "}
        <code>scrollbar-color</code> on iOS, use the standard properties everywhere instead.
      </p>

      <h3 id="edge-fades">Edge fades</h3>
      <p>
        A fade at an edge that has more content beyond it, with no script: a scroll-driven animation
        moves two registered lengths that a mask gradient uses. When nothing overflows the timeline
        is inactive, the lengths keep their initial <code>0px</code>, and no fade is drawn. Each
        fade grows over the first (and last) <code>2rem</code> of scrolling, whatever the length of
        the content.
      </p>
      <CodeBlock language="css">{`@property --scroll-fade-start { syntax: "<length>"; inherits: false; initial-value: 0px; }
@property --scroll-fade-end   { syntax: "<length>"; inherits: false; initial-value: 0px; }

@supports (animation-timeline: scroll()) {
  .scroll-fade {
    mask-image: linear-gradient(to bottom,
      transparent, #000 var(--scroll-fade-start),
      #000 calc(100% - var(--scroll-fade-end)), transparent);
    /* The shorthand resets the timeline: the timeline and the ranges come after it. */
    animation: scroll-fade-start linear both, scroll-fade-end linear both;
    animation-timeline: scroll(self), scroll(self);
    animation-range: 0 2rem, calc(100% - 2rem) 100%;
  }
}
@keyframes scroll-fade-start { from { --scroll-fade-start: 0px; } to { --scroll-fade-start: 2rem; } }
@keyframes scroll-fade-end   { from { --scroll-fade-end: 2rem; } to { --scroll-fade-end: 0px; } }`}</CodeBlock>
      <Table
        head={["Feature", "Chrome", "Firefox", "Safari"]}
        rows={[
          ["Scroll-driven animations (`animation-timeline: scroll()`)", "115", "159", "26"],
          ["`@property`", "85", "128", "16.4"],
          ["`mask-image` (unprefixed)", "120", "53", "15.4"],
        ]}
      />
      <ul>
        <li>
          Keep the <code>@supports</code>. In an engine without scroll timelines the animations
          would run once on the document clock and keep their end values: a permanent fade over the
          top of the content.
        </li>
        <li>
          The mask also fades the ends of a classic scrollbar, which is part of the masked box. If
          that matters, put the scroller inside a wrapper and draw the fades as overlays in the
          wrapper&apos;s background colour, driven by a named timeline (<code>scroll-timeline</code>{" "}
          on the scroller, <code>timeline-scope</code> on the wrapper; <code>timeline-scope</code>{" "}
          is Chrome 116, Firefox 159, Safari 26). That variant is a sketch: the browser test below
          does not run it.
        </li>
        <li>
          The fade is a mask, not motion: <code>prefers-reduced-motion</code> needs nothing here.
        </li>
      </ul>

      <h3 id="keyboard">Keyboard access</h3>
      <p>
        A keyboard user scrolls a scroller by focusing something inside it. When the content has
        nothing focusable (text, images), Chrome (since 132, per the update note in Chrome&apos;s{" "}
        <a href="https://developer.chrome.com/blog/keyboard-focusable-scrollers">
          Keyboard focusable scrollers
        </a>{" "}
        post: first announced for 130, then pushed back) and Firefox make the scroller itself a Tab
        stop; <strong>Safari does not</strong> (WebKit bug 277290), so there the content is out of
        reach. Make such a scroller focusable, and give it a role and a name so that the Tab stop is
        announced as something:
      </p>
      <CodeBlock language="html">{`<!-- Only when the content has nothing focusable. -->
<div class="scroll-area" tabindex="0" role="region" aria-label="Release notes">…</div>`}</CodeBlock>
      <ul>
        <li>
          Once focused, the arrow keys and Page Up / Page Down scroll it, in every engine (the
          browser&apos;s own scrolling keys; no script).
        </li>
        <li>
          Give it a visible focus ring, but <strong>not on the scroller itself</strong> when it has
          the edge fades: the mask fades its own outline away at an edge with content beyond it.
          Draw the ring on a frame around it instead:
          <CodeBlock language="css">{`.scroll-area:focus-visible { outline: none; }
.scroll-frame:has(> .scroll-area:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }`}</CodeBlock>
        </li>
        <li>
          Do not add it when the content has links, buttons or fields: Tab reaches them and the
          browser scrolls each into view, and the extra Tab stop is noise.
        </li>
        <li>
          <code>role="region"</code> with a name makes it a landmark. For a scroller that is a minor
          part of the page, <code>role="group"</code> with the same name avoids adding to the
          landmark list.
        </li>
        <li>
          Whether the content has something focusable is a decision about your content, which you
          make better than a measuring script would. That is why this is not a part that adds{" "}
          <code>tabindex</code> when it overflows.
        </li>
      </ul>

      <h3 id="why-no-part">Why there is no part</h3>
      <p>What a native scroller still cannot do:</p>
      <ul>
        <li>a thumb shape (radius, inset, exact thickness) in Firefox and on iOS;</li>
        <li>
          an overlay scrollbar that takes no layout space on a platform whose scrollbars are
          classic, or one that hides until hover there.
        </li>
      </ul>
      <p>What a drawn scrollbar costs:</p>
      <ul>
        <li>
          the user&apos;s settings stop applying ("always show scroll bars", scrollbar size, forced
          colours, where a <code>div</code> thumb is a background colour that disappears);
        </li>
        <li>
          a small pointer target unless you size it, and track clicks and drag behaviour that are
          reimplemented, never quite native;
        </li>
        <li>script on every scroll and resize to place and size the thumb;</li>
        <li>nothing for assistive technology: every library that draws one hides it from it.</li>
      </ul>
      <p>
        And there is nothing asynchronous in it: no state the library would own, no action, nothing
        pending. If you need a drawn bar anyway, a dedicated scrollbar library is a better home for
        it than a headless kit.
      </p>

      <Callout title="Checked in three engines">
        <p>
          The stylesheet of the example above is run by a browser test in Chromium, Firefox and
          WebKit (<code>scroll-area-recipe.browser.test.tsx</code> in the repository): the computed
          scrollbar properties, a gutter that is reserved before the content overflows where the bar
          takes space, the fade lengths at the top, in the middle and at the bottom, no fade without
          overflow, no fade at all in an engine without scroll timelines, the focusable region
          scrolled with the arrow keys and Page Down, and its focus ring on the frame. The Firefox
          the test runs (Playwright's build, 157) hides every scrollbar and predates scroll
          timelines, so there it checks the no-gutter and no-fade branches; the fade branch was run
          in it once with the feature&apos;s preference on. The <code>::-webkit-scrollbar</code> and
          overlay variants above are not run.
        </p>
      </Callout>
    </DocPage>
  );
}
