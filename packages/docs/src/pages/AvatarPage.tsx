import { CodeBlock } from "../components/CodeBlock.js";
import { Example, ExampleSource } from "../components/Example.js";
import { BehaviourIndex, BehaviourSection } from "../components/Concept.js";
import { DocPage } from "../components/DocPage.js";
import { PartFacts, PropsTable, Table } from "../components/Tables.js";
import { AvatarPeople } from "../examples/AvatarPeople.js";
import { functionProps, renderProp, stylingProps } from "./shared-props.js";

export function AvatarPage() {
  return (
    <DocPage
      title="Avatar"
      description="A picture of a person or a thing with initials or an icon in its place: the image is in the server HTML, the fallback sits under it, the name is on the Root, and React's commit wait for images under a ViewTransition still applies."
    >
      <p className="page-intro">
        A picture of a person or a thing, with something to show in its place when there is no
        picture or it does not load. It has no action and nothing pending: its one state, whether
        the image loaded, is a fact the browser owns, and the avatar mirrors it as{" "}
        <code>data-status</code>. The <code>&lt;img&gt;</code> is in the server HTML from the first
        render, the fallback is under it, and the name is on the Root, so the same avatar works
        before hydration, without script, and when the picture fails.
      </p>

      <Example file="AvatarPeople.tsx" css="avatar.css">
        <AvatarPeople />
      </Example>

      <BehaviourIndex />

      <h3 id="anatomy">Anatomy</h3>
      <CodeBlock>{`import { Avatar } from "@funstack/ui/avatar";

<Avatar.Root alt={user.name} className="avatar">           {/* span role="img" aria-label */}
  <Avatar.Image src={user.photoUrl} className="avatar-image" /> {/* img alt="" */}
  <Avatar.Fallback className="avatar-fallback">{initials(user.name)}</Avatar.Fallback>
</Avatar.Root>

// Next to the visible name: decorative.
<a href={\`/users/\${user.id}\`}>
  <Avatar.Root alt="" className="avatar">                    {/* span aria-hidden="true" */}
    <Avatar.Image src={user.photoUrl} />
    <Avatar.Fallback><UserIcon /></Avatar.Fallback>
  </Avatar.Root>
  {user.name}
</a>`}</CodeBlock>
      <Table
        head={["Part", "Element", "Rendered when"]}
        rows={[
          ["`Avatar.Root`", "`span`", "always"],
          [
            "`Avatar.Image`",
            '`img`, `alt=""`',
            "it has a `src` (or `srcSet`) and that source has not failed",
          ],
          ["`Avatar.Fallback`", "`span`", 'the status is not `"loaded"`'],
        ]}
      />
      <p>
        The library ships no CSS: stack the image over the fallback in one grid cell (see{" "}
        <a href="#recipes">Recipes</a>). While the image loads both are in the DOM and the picture
        paints over the initials when it arrives; nothing is swapped, so there is no{" "}
        <code>delay</code> prop.
      </p>

      <h3 id="props">Props</h3>
      <h4>
        <code>Avatar.Root</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "alt",
            type: "string",
            description:
              'Required. The avatar\'s text alternative, with the contract of `<img alt>`: who or what is pictured ("Jane Doe", not "avatar"), or `""` when the avatar is decoration next to text that already says it. Non-empty: the Root is `role="img"` with this `aria-label`, in every status. Empty: `aria-hidden="true"`.',
          },
          ...functionProps(
            "AvatarState",
            "The `Avatar.Image` and `Avatar.Fallback`, or a function of the state.",
          ),
          renderProp("span", "AvatarState"),
        ]}
      />
      <PartFacts
        state={"`AvatarState` is `{ status }`, shared by every part."}
        owned={"`role`, `aria-label`, `aria-hidden`, `data-status`."}
        note={
          "`role`, `aria-label`, `aria-labelledby` and `aria-hidden` are not in the props type: the name comes from `alt`. Everything else passes through to the `span`, `ref` included."
        }
      />
      <h4>
        <code>Avatar.Image</code>
      </h4>
      <PropsTable
        rows={[
          {
            name: "src",
            type: "string",
            description:
              'The picture. Without `src` and `srcSet` (or with `""`) the part renders nothing and the Fallback is the avatar. A new `src` keeps the same element: the browser paints the old picture until the new one is available.',
          },
          ...stylingProps("AvatarState"),
          {
            ...renderProp("img", "AvatarState"),
            description:
              "Replace the `<img>` (element form) or take over rendering (function form). It must render an `<img>` and pass the `ref` on: the part listens through it.",
          },
        ]}
      />
      <PartFacts
        state={"`AvatarState`."}
        owned={'`alt` (always `""`: the Root carries the name), `data-status`.'}
        note={
          "Every other `<img>` prop passes through: `srcSet`, `sizes`, `width`, `height`, `loading`, `decoding`, `fetchPriority`, `crossOrigin`, `referrerPolicy`, and your own `onLoad` / `onError` (see [Suspense](#suspense) for what an `onLoad` costs). No `children`."
        }
      />
      <h4>
        <code>Avatar.Fallback</code>
      </h4>
      <PropsTable
        rows={[
          ...functionProps("AvatarState", "Initials, an icon, or a function of the state."),
          renderProp("span", "AvatarState"),
        ]}
      />
      <PartFacts
        state={"`AvatarState`."}
        owned={"`data-status`."}
        note={
          'Not rendered at all once the status is `"loaded"`; a function `render` or `children` does not run then.'
        }
      />

      <h4>State</h4>
      <Table
        head={["`status`", "Meaning", "Image", "Fallback"]}
        rows={[
          [
            '`"idle"`',
            "No image has reported: the server render, the hydration render, no `Avatar.Image`, or one with no source.",
            "rendered if it has a source",
            "rendered",
          ],
          [
            '`"loading"`',
            'The image has a source and is not complete (also a `loading="lazy"` image off screen).',
            "rendered",
            "rendered, under it",
          ],
          ['`"loaded"`', "The image is available.", "rendered", "**not rendered**"],
          [
            '`"error"`',
            "The image's current source failed. It is not tried again; a different `src` mounts a new `<img>`.",
            "**not rendered**",
            "rendered",
          ],
        ]}
      />

      <h3 id="data-attributes">Data attributes</h3>
      <Table
        head={["Attribute", "On", "Meaning"]}
        rows={[
          [
            "`data-status`",
            "every part",
            '`"idle"`, `"loading"`, `"loaded"` or `"error"`: the same value as `state.status`.',
          ],
        ]}
      />

      <h3 id="keyboard-and-aria">Keyboard and ARIA</h3>
      <Table
        head={["Case", "Rendered", "Announced"]}
        rows={[
          [
            '`alt="Jane Doe"`, any status',
            '`span[role=img][aria-label="Jane Doe"]`',
            '"Jane Doe, image", once',
          ],
          ['`alt=""`, any status', "`span[aria-hidden=true]`", "nothing"],
        ]}
      />
      <ul>
        <li>
          The children of <code>role="img"</code> are presentational: the inner{" "}
          <code>&lt;img alt=""&gt;</code> and the fallback&apos;s text never add a second name, and
          the name does not change when the picture fails. With the name on the{" "}
          <code>&lt;img&gt;</code> instead, a failed picture would leave "JD" as the only thing a
          screen reader can read.
        </li>
        <li>
          So <strong>nothing interactive goes inside the Root</strong>. A link or a button wraps the
          Root; a presence badge that must be announced is a sibling.
        </li>
        <li>Not focusable, no keyboard interaction.</li>
        <li>
          Initials are text: give them text contrast when the avatar is not decorative for sighted
          users either.
        </li>
      </ul>

      <BehaviourSection
        id="transition-types"
        summary={
          "None, and no `transition` prop: the status changes in an urgent update, which starts no view transition. Animate the swap with CSS (the fade-in recipe below). A `<ViewTransition>` of your own around the avatar animates its mount, and makes React wait for the image (Suspense, below)."
        }
      />

      <BehaviourSection
        id="optimistic-and-pending"
        summary={
          "None: no action, nothing pending, nothing optimistic. The status is written with a plain `setState` from the image's native `load` / `error` events, never in a transition, so an unrelated pending action elsewhere in the app does not hold initials over a picture that has loaded."
        }
      />

      <BehaviourSection
        id="suspense"
        summary={
          "The avatar does not suspend and owns no boundary. React 19.3 already waits for images: when an `<img>` is inserted (or its `src` changes) in a transition under a `<ViewTransition>`, react-dom holds the commit until the image is ready or a short timeout passes. `Avatar.Image` is built so that this applies to it."
        }
      >
        <CodeBlock>{`// The card is revealed with the picture in place, or after the timeout with the initials.
<ViewTransition>
  <Suspense fallback={<ProfileSkeleton />}>
    <Profile />   {/* suspends on data, renders <Avatar.Root> */}
  </Suspense>
</ViewTransition>`}</CodeBlock>
        <ul>
          <li>
            React skips the wait for an image that has an <code>onLoad</code> prop or{" "}
            <code>loading="lazy"</code>. The part listens with native listeners through its ref and
            never renders <code>onLoad</code>, so the wait applies. Your own <code>onLoad</code> or{" "}
            <code>loading="lazy"</code> on <code>Avatar.Image</code> opts that image out, which is
            React&apos;s documented way to do so.
          </li>
          <li>
            When React waited and the picture arrived, the first status is already{" "}
            <code>"loaded"</code>: the fallback is never painted. When the timeout won, the avatar
            starts at <code>"loading"</code> with the initials under it.
          </li>
          <li>
            The library&apos;s own content regions with a <code>transition</code> prop (a{" "}
            <code>Tabs.Panel</code>, a <code>Dialog.Popup</code>) are under a{" "}
            <code>&lt;ViewTransition&gt;</code>, so switching to a panel waits for its avatars,
            bounded by the timeout, with <code>data-pending</code> on the trigger meanwhile. The
            timeout is one clock for the whole commit, not one per image.
          </li>
          <li>
            A library-owned Suspense wait was rejected: a server cannot load an image, so the server
            HTML would have no picture, and the wait would have no bound.
          </li>
        </ul>
      </BehaviourSection>

      <BehaviourSection
        id="browser-owned-state"
        summary={
          'The image\'s load state. The avatar mirrors it from `load` / `error` and from `img.complete` at mount, so a picture that finished before hydration (whose event no listener heard) is right in the hydration commit: `"loaded"`, or `"error"` for one that failed. A complete image with no natural width is decided by `img.decode()`.'
        }
      />

      <BehaviourSection
        id="before-hydration"
        summary={
          'The server HTML has the Root with its name, the `<img alt="">` and the Fallback, all `data-status="idle"`, so the browser starts the request from the HTML (react-dom also emits a `<link rel="preload" as="image">`). Without script the picture paints over the initials when it arrives, and a broken image with `alt=""` paints nothing, so the initials stay. Every part is a client module; a Server Component renders them with serialisable props.'
        }
      >
        <p>
          The status stays <code>"idle"</code> without script, so a stylesheet that hides the image
          while <code>[data-status="loading"]</code> never hides it before hydration. Use{" "}
          <code>@media (scripting: enabled)</code> for anything that depends on the status leaving{" "}
          <code>"idle"</code>.
        </p>
      </BehaviourSection>

      <h3 id="recipes">Recipes</h3>
      <h4>CSS</h4>
      <p>One grid cell, the image above the fallback:</p>
      <CodeBlock language="css">{`.avatar { display: inline-grid; inline-size: 2.5rem; aspect-ratio: 1; border-radius: 50%; overflow: clip; }
.avatar > * { grid-area: 1 / 1; }
.avatar-image { inline-size: 100%; block-size: 100%; object-fit: cover; }
.avatar-fallback { display: grid; place-items: center; background: var(--avatar-bg); }`}</CodeBlock>
      <h4>No flash of initials during a fast load</h4>
      <p>
        <code>:has(img)</code> is true exactly while a picture may still arrive (the part removes
        the <code>&lt;img&gt;</code> on error and renders none without a source), so the delay
        applies only then, and works before hydration:
      </p>
      <CodeBlock language="css">{`.avatar:has(img) .avatar-fallback { animation: avatar-fallback-in 1ms 400ms backwards; }
@keyframes avatar-fallback-in { from { opacity: 0; } }`}</CodeBlock>
      <h4>Fading the picture in</h4>
      <CodeBlock language="css">{`@media (scripting: enabled) {
  .avatar-image { transition: opacity 150ms; }
  .avatar-image[data-status="loading"] { opacity: 0; }
}`}</CodeBlock>
      <p>
        Transparent pictures (a PNG logo) let the initials show through until hydration removes the
        fallback: give <code>.avatar-image</code> a <code>background</code>. Tailwind:{" "}
        <code>data-[status=loading]:opacity-0</code>, <code>has-[img]:…</code>.
      </p>
      <ExampleSource file="avatar.css" />

      <h3 id="browser-notes">Browser notes</h3>
      <ul>
        <li>
          Chromium and Firefox give an SVG with no width, height or <code>viewBox</code> the default
          object size (300 × 150) as its natural size; it reports <code>"loaded"</code> like any
          other picture.
        </li>
      </ul>
      <h4>Not in this version</h4>
      <ul>
        <li>
          A group of overlapping avatars ("+3"): layout, in your CSS (negative margins on the Roots
          of a flex row).
        </li>
        <li>A presence or status badge part: a sibling of the Root, with its own text.</li>
        <li>Initials or a colour derived from a name.</li>
        <li>
          A retry of a failed source, and an <code>onStatusChange</code> handler (the status is in
          every function prop; your native <code>onError</code> passes through).
        </li>
      </ul>
    </DocPage>
  );
}
