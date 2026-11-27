import { CodeBlock } from "../components/CodeBlock.js";
import { Callout } from "../components/Callout.js";
import { Example } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { HoverCardMentions } from "../examples/HoverCardMentions.js";
import { HoverCardRepos } from "../examples/HoverCardRepos.js";
import { functionProps, renderProp } from "./shared-props.js";

export function HoverCardPage() {
  return (
    <DocPage
      title="HoverCard"
      description="A rich preview that appears when the user rests the pointer on a link or focuses it: the open is a transition, so the content loads on interest and the card appears when it is ready; every close is a fact."
    >
      <p className="page-intro">
        A preview card for a link: the pointer rests on it, or keyboard focus does, and after a
        delay a card appears next to it. Unlike a <a href="/components/tooltip">Tooltip</a> the card
        may hold links and buttons and is not the link's name or description; unlike a{" "}
        <a href="/components/popover">Popover</a> nothing is clicked to open it, and opening never
        moves focus. Showing interest starts a transition: <code>openChangeAction(true)</code> is
        awaited, the content mounts inside it and may suspend, and the link is{" "}
        <code>data-pending</code> meanwhile. If the user moves on before the data arrives, the open
        is cancelled and the card never appears. Fifty mentions on a page render fifty empty
        popovers and fetch nothing until one is hovered.
      </p>

      <Example file="HoverCardMentions.tsx" css="hover-card.css">
        <HoverCardMentions />
      </Example>
      <p>
        Hover a mention or Tab to it: the first time, the link shows a dotted underline while the
        profile loads, then the card appears complete. Loading starts on <code>pointerenter</code>{" "}
        and <code>focus</code>, while the 600 ms delay runs, through the Trigger's own event props.
      </p>

      <Callout kind="warning" title="Supplementary content only">
        <p>
          A touch user never sees the card (a tap follows the link), a screen reader user may never
          open it, and a keyboard user may Tab past before the delay. Whatever the card offers, its
          buttons included, must also be reachable where the link leads.
        </p>
      </Callout>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { HoverCard } from "@funstack/ui/hover-card";

<HoverCard.Root>                                          {/* no DOM: ids, state, timers */}
  <HoverCard.Trigger href="/u/ada">@ada</HoverCard.Trigger>   {/* a */}
  <HoverCard.Popup>                                       {/* div[popover=manual][role=group] */}
    <UserPreview login="ada" />                           {/* mounted on open; may suspend */}
  </HoverCard.Popup>
</HoverCard.Root>`}</CodeBlock>
      <ul>
        <li>
          <strong>Render the Popup right after the Trigger.</strong> Tab from the link then enters
          the open card in every engine, and Tab from the card's last control continues with what
          follows the link. Root renders no DOM, so the parts need not be siblings.
        </li>
        <li>
          <strong>
            Inside running text, render a <code>&lt;span&gt;</code> card:
          </strong>{" "}
          <code>render={"{<span />}"}</code> with phrasing content only (<code>img</code>,{" "}
          <code>a</code>, <code>button</code>, <code>span</code>), laid out with CSS: a{" "}
          <code>&lt;div&gt;</code> cannot follow a link inside a <code>&lt;p&gt;</code>. The other
          valid shape puts the Popup after the paragraph; Safari then does not put the card next in
          the Tab order when other focusable content sits between link and card.
        </li>
        <li>
          <strong>The Trigger is a link</strong> (or a router link through <code>render</code>), or
          a button whose click opens nothing of this kind. The card opens on interest only; the
          click is yours, and a press on the Trigger closes the card. A button that should open the
          same content on click is a <a href="/components/popover">Popover</a>.
        </li>
        <li>
          No Close, Title, Description or Arrow part, no Portal. One Trigger per Root; a card shared
          by many triggers is not offered (unmounted content makes many Roots cheap).
        </li>
      </ul>

      <h3 id="how-it-works">How it works</h3>
      <Table
        head={["What happens", "Channel", "`reason`", "`details.event`"]}
        rows={[
          [
            "Hover (not touch) or keyboard focus (`:focus-visible`) held for `delay`",
            "`openChangeAction(true)`",
            '`"activate"`',
            "the `pointerenter` or `focus` event (flagged path: the `beforetoggle` of the platform's interest show)",
          ],
          [
            "Lost interest, Escape or a press while the open is still pending",
            "`openChangeAction(false)`",
            '`"dismiss"`',
            "the `pointerleave`, `blur`, `focusout`, `loseinterest`, `keydown` or `pointerdown`",
          ],
          [
            "Lost interest while shown: the pointer left the link and the card, or focus left both, for `closeDelay`",
            "`onOpenChange(false)`",
            '`"dismiss"`',
            "the event that began the close delay (`pointerup` after a text selection dragged out); `loseinterest` on the flagged path",
          ],
          ["Escape while shown", "`onOpenChange(false)`", '`"dismiss"`', "the `keydown`"],
          [
            "A press outside the card while shown, the link included",
            "`onOpenChange(false)`",
            '`"dismiss"`',
            "the `pointerdown`",
          ],
          [
            "`disabled` became true while shown",
            "`onOpenChange(false)`",
            '`"dismiss"`',
            "`undefined`",
          ],
          [
            "Script `hidePopover()`; with `experimental_hint`, the browser's light dismiss or another hint",
            "`onOpenChange(false)`",
            '`"dismiss"`',
            "the `toggle` event",
          ],
        ]}
      />
      <ul>
        <li>
          <strong>The latest event wins.</strong> Any leave starts the close delay and any enter
          cancels it, as in Chromium's own interest handling: a card opened by keyboard focus closes
          when the pointer crosses it and leaves, and a card whose button you clicked closes when
          the pointer leaves.
        </li>
        <li>
          <strong>Every close the user causes is a fact.</strong> It is urgent: an unrelated action
          pending elsewhere in the app cannot keep the card over the page after the user left it. A
          controlled parent cannot veto it; keeping <code>open={"{true}"}</code> re-shows the card,
          without moving focus.
        </li>
        <li>
          <strong>No open until fresh interest.</strong> After Escape, after a press on the link and
          after the library returned focus to it, nothing opens the card until the pointer leaves
          and comes back, or focus leaves and returns.
        </li>
        <li>
          <strong>Nesting.</strong> A card never closes anything by opening (<code>manual</code>),
          and it follows its link in the DOM, so inside a modal Dialog, a Popover or a Menu it is
          not inert and a press in it is no light dismiss of the outer popup. A Menu, Popover or
          Tooltip opened from inside the card keeps it open, and so does a nested card.
        </li>
      </ul>

      <h3 id="props">Props</h3>
      <h4>
        <code>HoverCard.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "open",
            type: "boolean",
            description:
              "Controlled open state. Pass `onOpenChange` too: every close the user causes is a fact (development warns). `open` with `onOpenChange={() => {}}` pins a card open, for styling it.",
          },
          {
            name: "defaultOpen",
            type: "boolean",
            default: "false",
            description: "Initial open state when uncontrolled. Shown after hydration.",
          },
          {
            name: "openChangeAction",
            type: "ChangeAction<boolean, HoverCardOpenChangeDetails>",
            description: (
              <>
                Requests only. Awaited for <code>true</code> when the user shows interest: the card
                appears when it resolves and the content has rendered. Called with{" "}
                <code>false</code> only to cancel an open that has not appeared yet. Never called
                for the close of a shown card. Runs in the Root's transition; may be a Server
                Function. A rejection reaches the nearest Error Boundary{" "}
                <strong>above the Root</strong>, which takes the link with it: catch inside the
                action, or load in the content with an Error Boundary inside the Popup.
              </>
            ),
          },
          {
            name: "onOpenChange",
            type: "UrgentChangeHandler<boolean, HoverCardOpenChangeDetails>",
            description: (
              <>
                Facts only: the card was closed (lost interest, Escape, a press outside). Always{" "}
                <code>false</code>, with <code>reason: "dismiss"</code>. Called synchronously,
                outside any transition, not awaited. In controlled mode set state directly here (
                <code>onOpenChange={"{setOpen}"}</code>), never in <code>startTransition</code>. May
                return a promise; a rejection or a throw goes to <code>reportError</code>.
              </>
            ),
          },
          {
            name: "delay",
            type: "number",
            default: "600",
            description:
              "Milliseconds of interest (hover or keyboard focus) before the open is requested. Longer than Tooltip's 250 on purpose: a card loads data and, once open, puts its controls in the keyboard user's path.",
          },
          {
            name: "closeDelay",
            type: "number",
            default: "300",
            description:
              "Milliseconds from losing interest to the close: the time the pointer has to cross from the link into the card.",
          },
          {
            name: "disabled",
            type: "boolean",
            default: "false",
            description:
              "Interest never opens the card, and a shown card is closed. Does not disable the link, which still navigates; a controlled `open={true}` still shows the card.",
          },
          {
            name: "children",
            type: "ReactNode | ((state: HoverCardRootState) => ReactNode)",
            description:
              "The parts. The function form receives the optimistic state and must not suspend.",
          },
        ]}
      />
      <PartFacts
        state={
          '`HoverCardRootState` is `{ open, pending, disabled }`; `open` is optimistic. `HoverCardOpenChangeDetails` is `{ reason }` plus the virtual `event`; `reason` is `"activate"` for an open, `"dismiss"` for every close, `"platform"` for a card found open at hydration.'
        }
        owned={"nothing rendered: the Root has no element (no `ref`, `className` or `style`)."}
      />

      <h4>
        <code>HoverCard.Trigger</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "experimental_interestFor",
            type: "boolean",
            default: "false",
            description: (
              <>
                Chromium 142+. Writes <code>interestfor</code> (after hydration, through the ref)
                and renders <code>interest-delay-start</code> / <code>-end</code> from the Root's
                delays, so the browser decides when interest starts and ends, long-press on touch
                included. The library still owns the open, Escape and a press outside. Firefox and
                Safari ignore the attribute and run the JS path. See{" "}
                <a href="/concepts/experimental">Experimental features</a>.
              </>
            ),
          },
          ...functionProps(
            "HoverCardTriggerState",
            "Rendered from optimistic state; must not suspend.",
          ),
          renderProp("a", "HoverCardTriggerState"),
        ]}
      />
      <PartFacts
        state={
          "`HoverCardTriggerState` is `{ open, pending, disabled }`; `open` is optimistic, `pending` is true while an open (or its cancel) is in flight: the card is loading."
        }
        owned={
          "`data-open`, `data-pending`, `data-disabled`, and `interestfor` with `experimental_interestFor` (removed while disabled). No ARIA attribute: not `aria-describedby`, `aria-expanded`, `aria-haspopup` or `aria-details`."
        }
        note={
          "`href` and every other anchor prop pass through, and so do your `onPointerEnter`, `onFocus` and `onClick`: the library listens with `addEventListener`. The element must be focusable; a development warning fires when it is not (an `<a>` without `href`)."
        }
      />

      <h4>
        <code>HoverCard.Popup</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "side",
            type: '"top" | "bottom" | "left" | "right" | "inline-start" | "inline-end" | null',
            default: '"bottom"',
            description:
              "Placement relative to the Trigger through inline `position-area`, with `position-try-fallbacks` flipping it when it does not fit. `null` emits no inline placement and no `data-side` / `data-align`: your stylesheet owns placement.",
          },
          {
            name: "align",
            type: '"start" | "center" | "end"',
            default: '"center"',
            description: "Alignment along the side. Ignored when `side` is `null`.",
          },
          {
            name: "keepMounted",
            type: "boolean",
            default: "false",
            description:
              '`false`: the children are not rendered while closed; mounting them is part of the opening transition, so content that suspends holds the open. `true`: rendered in `<Activity mode="hidden">` while closed (pre-rendered at low priority). Suits a single prominent card, not a list of them.',
          },
          {
            name: "experimental_hint",
            type: "boolean",
            default: "false",
            description:
              'Renders `popover="hint"` instead of `"manual"` (Chrome 151+, Firefox 153+; Safari 27.2 treats it as manual): opening the card closes an open Tooltip, and the browser\'s light dismiss applies next to the library\'s.',
          },
          {
            name: "transition",
            type: "ViewTransitionClass",
            description:
              "Forwarded to a `<ViewTransition>` around the popover element: animates the opening commit, content swaps (a skeleton replaced by the content) and a controlled close. Closes the user causes are facts and animate with CSS only.",
          },
          ...functionProps(
            "HoverCardPopupState",
            "Content, or a function of the part's state. Rendered from committed state; may suspend.",
          ),
          {
            name: "render",
            type: "ReactElement | ((props, state: HoverCardPopupState) => ReactNode)",
            description:
              "A `<div>` (default) or a `<span>` for a card inside running text (phrasing content only).",
          },
        ]}
      />
      <PartFacts
        state={
          "`HoverCardPopupState` is `{ open, side, align }`; `open` is committed (`:popover-open` is the DOM truth); `side` / `align` are where the browser placed the card while it is shown, your props otherwise."
        }
        owned={
          '`id`, `popover` (`"manual"`, or `"hint"` with the flag), `data-side` / `data-align` (unless `side` is `null`).'
        }
        note={
          '`role="group"` is a default you can override: a card with real actions may pass `role="dialog"` with an `aria-label`. `onToggle` and `onBeforeToggle` are not accepted; use a `ref`. Every show is a no-focus show: the card is `inert` for the `showPopover()` call, so an `autofocus` inside it cannot take focus on hover.'
        }
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Hook", "On", "Meaning"]}
        rows={[
          ["`:popover-open`", "Popup", "The card is shown (DOM truth)."],
          [
            "`data-side`, `data-align`",
            "Popup",
            "While shown: where the browser placed the card (after any flip). Otherwise the requested placement. Absent with `side={null}`.",
          ],
          ["`data-open`", "Trigger", "Optimistic open state: from the dispatch of the open."],
          ["`data-pending`", "Trigger", "An open is in flight: the card is loading."],
          ["`data-disabled`", "Trigger", "The Root's `disabled`."],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Key", "Behaviour"]}
        rows={[
          [
            "Tab to the link",
            "The card opens after `delay` (keyboard focus is `:focus-visible`); focus stays on the link",
          ],
          [
            "Tab, card open",
            "Focus moves into the card, to its first focusable element; with none, to what follows",
          ],
          [
            "Tab from the card's last element",
            "Focus moves on; the card closes after `closeDelay`",
          ],
          ["Shift+Tab from the card's first element", "Back to the link; the card stays open"],
          ["Tab before `delay` has passed", "The open is cancelled; focus moves on"],
          [
            "Escape",
            "Closes the card (or cancels the coming one). With focus inside the card, focus returns to the link and the card does not re-open. Inside a Dialog or a toast only the card closes; a popover or tooltip open inside the card closes first. With a tooltip showing elsewhere too, the one that opened first closes. A `preventDefault()` on the Escape keeps the card open; `stopPropagation()` does not, and inside a modal Dialog it makes the dialog close on the same Escape (the browser closes it before the library can claim the key)",
          ],
          ["Enter on the link", "The link's own activation; the library does nothing"],
        ]}
      />
      <ul>
        <li>
          <strong>Tab enters the card</strong>, the platform's model for interest targets: a
          keyboard user who pauses on a link longer than <code>delay</code> has the card's controls
          in the way of the next link. That is why the delay is long, why Escape is cheap and why a
          card with many controls is the wrong component: content the user works in belongs in a{" "}
          <a href="/components/popover">Popover</a> that a click opens.
        </li>
        <li>
          <strong>Opening never moves focus.</strong> Lost interest and a press outside never focus
          the link either: focus inside a card that closes goes to <code>&lt;body&gt;</code>, or
          where the press landed.
        </li>
        <li>
          <strong>ARIA.</strong> The Trigger gets nothing: the card is not the link's description (a
          rich card read as one string is noise), and a link announced as "collapsed" on every
          mention would be worse. The card follows the link in the reading order. The Popup has{" "}
          <code>role="group"</code>, HTML-AAM's minimum role for a popover, which WebKit does not
          apply by itself. Nothing is announced when the card appears.
        </li>
        <li>
          <strong>WCAG 1.4.13.</strong> Dismissible (Escape, without moving pointer or focus),
          hoverable (the pointer may move into the card; <code>closeDelay</code> covers the gap),
          persistent (until interest is lost).
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "`fsui-hover-card` plus `fsui-hover-card-open` for an open, and `fsui-hover-card-close` for the cancel of an open that has not appeared. Every close of a shown card is a fact and starts no transition."
        }
      >
        <p>
          CSS is the animation to use for a HoverCard, because every close the user causes is a fact
          and only CSS animates those (the exit animates in Chromium and Safari, not in Firefox).{" "}
          <code>transition</code> earns its place for a skeleton swapped for the content and for a
          parent that drives <code>open</code> itself.
        </p>
        <CodeBlock language="css">{`.card {
  margin: 6px; inset: auto;
  opacity: 0;
  transition: opacity 120ms, display 120ms allow-discrete, overlay 120ms allow-discrete;
}
.card:popover-open { opacity: 1; }
@starting-style { .card:popover-open { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .card { transition: none; } }`}</CodeBlock>
      </BehaviourSection>

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "During `delay` nothing is rendered and nothing is pending. From the dispatch of the open the Trigger has `data-open` and `data-pending`; the card is hidden and its children unmounted until the action resolves and the content has rendered. Leaving meanwhile cancels the open: `openChangeAction(false)` supersedes it and nothing appears."
        }
      >
        <Example file="HoverCardRepos.tsx" css="hover-card.css">
          <HoverCardRepos />
        </Example>
        <ol>
          <li>
            Hover a repository: after 600 ms <code>openChangeAction(true, "activate")</code> runs
            (400 ms here) and the link is pending.
          </li>
          <li>
            It settles: the card appears with a skeleton (the Popup has a Suspense boundary of its
            own), and the summary swaps in when it has loaded.
          </li>
          <li>
            Leave before it settles: <code>openChangeAction(false, "dismiss")</code> cancels the
            open, and no card flashes under a pointer that has gone.
          </li>
          <li>
            Leave an open card, press Escape or click elsewhere: <code>onOpenChange</code> is called
            at once, with the event that caused it. The action is not called.
          </li>
        </ol>
        <p>
          <code>openChangeAction</code> may see <code>true</code>, <code>false</code>,{" "}
          <code>true</code> as the user leaves and comes back; only the last dispatch commits. An
          action that loads data should be idempotent or cached. There is no{" "}
          <code>whilePending</code>: no part of a HoverCard runs an action of its own.
        </p>
      </BehaviourSection>

      <BehaviourSection
        id="suspense"
        summary={
          "The children render from committed state, so they mount in the opening transition. Content that suspends holds the open (wait, then open: the default); a `<Suspense>` inside the Popup opens at once with a skeleton instead."
        }
      >
        <CodeBlock>{`<HoverCard.Popup className="card">
  <ErrorBoundary fallback={<span>Could not load the profile.</span>}>
    <UserPreview login="ada" />   {/* use(fetchUser("ada")) */}
  </ErrorBoundary>
</HoverCard.Popup>`}</CodeBlock>
        <ul>
          <li>
            <strong>Put the Error Boundary inside the Popup.</strong> A rejection of{" "}
            <code>openChangeAction</code> reaches the boundary above the Root, which takes the link
            with it; a failure inside the content only replaces the card's body.
          </li>
          <li>
            <strong>Start loading during the delay</strong> with the Trigger's own event props (
            <code>onPointerEnter</code>, <code>onFocus</code>). The library does not do this by
            itself: a pointer crossing a list of links would fetch for each of them.
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          "The card is a `manual` popover the library shows and hides. Opening is library-owned (a request); every close the user causes is browser-shaped: the library hides the card at once and reports the fact from the `toggle` event. With `experimental_interestFor` in Chromium the browser decides when interest starts and ends; the rest is the same code."
        }
      >
        <Table
          head={["Flags", "Chromium", "Firefox", "Safari"]}
          rows={[
            [
              "none",
              "`manual` + JS interest; Escape and a press outside by the library",
              "same",
              "same",
            ],
            [
              "`experimental_hint`",
              "`hint`: opening closes an open Tooltip; native light dismiss next to the library's",
              "as Chromium",
              "treated as `manual`",
            ],
            [
              "`experimental_interestFor`",
              "the platform's interest signal, long-press on touch",
              "ignored: JS path",
              "ignored: JS path",
            ],
          ]}
        />
      </BehaviourSection>

      <BehaviourSection
        id="before-hydration"
        summary={
          "The card opens only after hydration: interest is tracked by the library, and `interestfor` is written after hydration so that a hover before it cannot open an empty card. The server HTML has the link and the closed, empty card."
        }
      />

      <h3 id="recipes">Recipes</h3>
      <h4>From a Server Component, with a Server Function</h4>
      <CodeBlock>{`// A Server Component. \`recordPreview\` is a Server Function; it hears opens only.
<HoverCard.Root openChangeAction={recordPreview.bind(null, repo.id)}>
  <HoverCard.Trigger href={repo.url}>{repo.name}</HoverCard.Trigger>
  <HoverCard.Popup className="card">
    <RepoSummary repo={repo} />
  </HoverCard.Popup>
</HoverCard.Root>`}</CodeBlock>
      <h4>Controlled</h4>
      <CodeBlock>{`const [open, setOpen] = useState(false);

<HoverCard.Root open={open} openChangeAction={setOpen} onOpenChange={setOpen}>
  …
</HoverCard.Root>`}</CodeBlock>
      <p>
        <code>setOpen</code> in the action is a transition update, in the handler an urgent one.
        Never wrap the handler's update in <code>startTransition</code>.
      </p>
      <h4>A bridge over the gap</h4>
      <CodeBlock language="css">{`.card { margin: 6px; }
/* Extend the card's hit area over the gap, on the side that faces the link. */
.card[data-side="bottom"]::before { content: ""; position: absolute; inset: -6px 0 auto; height: 6px; }
.card[data-side="top"]::before { content: ""; position: absolute; inset: auto 0 -6px; height: 6px; }`}</CodeBlock>
      <h4>Both flags</h4>
      <CodeBlock>{`<HoverCard.Root delay={400}>
  <HoverCard.Trigger href="/u/ada" experimental_interestFor>@ada</HoverCard.Trigger>
  <HoverCard.Popup experimental_hint className="card">…</HoverCard.Popup>
</HoverCard.Root>`}</CodeBlock>

      <h3 id="not-included">Not included</h3>
      <ul>
        <li>
          <strong>Click to pin</strong> ("hover to preview, click to keep open"): one element that
          opens the same rich content on interest and on activation is against HTML's author
          guidance for interest invokers. A card that must stay is a{" "}
          <a href="/components/popover">Popover</a>.
        </li>
        <li>One card shared by many triggers, skip-delay between neighbouring cards.</li>
        <li>A safe-polygon pointer corridor (the bridge recipe above covers the gap).</li>
        <li>
          A long-press for touch on the JS path; anchoring to the hovered line of a wrapped link.
        </li>
        <li>
          <code>openOnFocus={"{false}"}</code>: keyboard focus opens the card on both paths.
        </li>
      </ul>
    </DocPage>
  );
}
