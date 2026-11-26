# Avatar

Status: **proposed** (#171, part of #162). Not accepted, not implemented. History, the open
decisions and the test plan: `design/CHANGELOG.md`. Follows `design/conventions.md`; where this
document and the conventions disagree, the conventions win.

Inputs: `docs/vision.md`, `design/conventions.md` (1.1, 1.2, 2.6, 4.1, 5, 6, 7.1),
`design/components/separator.md` (how a small part accounts for itself), the React 19.3
reference for `<Suspense>` ("Waiting for an image to load") and the react-dom 19.3.1 source
(`maySuspendCommit`, `suspendInstance`), HTML (the `img` element, its rendering when it
represents nothing, `HTMLImageElement.complete` / `decode()`), prior art (Radix `Avatar`, Base
UI 1.9 `Avatar`, Ark UI `Avatar`; React Aria, Headless UI and Ariakit have none), notes in
`memo/architect/avatar-scrollarea-otp-notes.md`.

A picture of a person or a thing, with something to show in its place when there is no picture
or the picture does not load. It has no action and nothing pending: its one state, whether the
image loaded, is a fact the browser owns and the library mirrors. Section 2 says what the part
adds over `<img alt>`, so that the product owner can weigh it.

## Summary

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Shape | `Avatar.Root` (`span`), `Avatar.Image` (`img`), `Avatar.Fallback` (`span`), from `@funstack/ui/avatar`. |
| 2 | The image is in the server HTML | `Avatar.Image` renders its `<img>` from the first render, on the server too, so the browser's preload scanner starts the request and a page without JavaScript shows the picture. It is never held back until a script has preloaded it (Radix, and Base UI by default). |
| 3 | No timer, no delay prop | `Avatar.Fallback` is rendered until the image has loaded and sits **under** the image (the consumer's CSS stacks them). A loaded image paints over it; nothing is swapped in the DOM while the image loads, so there is no flash to delay. Showing nothing during a fast load is three lines of CSS (section 6). |
| 4 | Status | `"idle" \| "loading" \| "loaded" \| "error"`, a mirror of the image's load state, written urgently (conventions 2.6). `data-status` on every part, `state.status` in function props. No handler prop. |
| 5 | Listening | Native `load` / `error` listeners attached through the ref, plus a read of `img.complete` at mount for an image that finished before hydration. **Never the `onLoad` prop**: react-dom reads its presence as "this image opts out of the commit wait" (section 5). |
| 6 | Suspense | The library does not suspend on the image and owns no boundary. Inside a `<ViewTransition>`, React 19.3 itself holds a transition commit for an `<img>` (up to about half a second), and the part is built so that this applies to it. |
| 7 | Accessible name | On the Root: `alt` is required. Non-empty: `role="img"` and `aria-label`, one name in every state. Empty: `aria-hidden="true"`, a decorative avatar. The inner `<img>` always renders `alt=""`. |
| 8 | ViewTransition | No `transition` prop: the status is urgent, and an urgent update starts no view transition. The swap animates in CSS. |
| 9 | Directives | Every part file is `"use client"` (state, context). A Server Component renders all three with serialisable props. |
| 10 | Not this part | A group of overlapping avatars, a presence badge, initials computed from a name, a retry. |

---

## 1. Anatomy and usage

```tsx
import { Avatar } from "@funstack/ui/avatar";

<Avatar.Root alt={user.name} className="avatar">
  <Avatar.Image src={user.photoUrl} className="avatar-image" />
  <Avatar.Fallback className="avatar-fallback">{initials(user.name)}</Avatar.Fallback>
</Avatar.Root>

// Next to the visible name: decorative.
<a href={`/users/${user.id}`}>
  <Avatar.Root alt="" className="avatar">
    <Avatar.Image src={user.photoUrl} />
    <Avatar.Fallback><UserIcon /></Avatar.Fallback>
  </Avatar.Root>
  {user.name}
</a>
```

Server HTML of the first example (`user.photoUrl` is set):

```html
<span role="img" aria-label="Jane Doe" data-status="idle" class="avatar">
  <img src="/photos/jane.jpg" alt="" data-status="idle" class="avatar-image">
  <span data-status="idle" class="avatar-fallback">JD</span>
</span>
```

After the image loaded (hydrated):

```html
<span role="img" aria-label="Jane Doe" data-status="loaded" class="avatar">
  <img src="/photos/jane.jpg" alt="" data-status="loaded" class="avatar-image">
</span>
```

After it failed, or with `user.photoUrl` undefined (`data-status="error"` and `"idle"`):

```html
<span role="img" aria-label="Jane Doe" data-status="error" class="avatar">
  <span data-status="error" class="avatar-fallback">JD</span>
</span>
```

| Part | Element | Role | Rendered when | Library state rendered |
| --- | --- | --- | --- | --- |
| `Root` | `span` | `img` with `aria-label` (non-empty `alt`); none, with `aria-hidden="true"` (empty `alt`) | always | `data-status` |
| `Image` | `img` | presentational (`alt=""`) | `src` or `srcSet` is given and that source has not failed | `alt=""`, `data-status` |
| `Fallback` | `span` | none | the status is not `"loaded"` | `data-status` |

## 2. Why a part at all

An avatar with a picture that always loads is `<img alt>`, and the part adds nothing to it.
What the part is for:

- **The fallback.** CSS cannot select a broken image (no engine-neutral pseudo-class exists),
  so "show initials when the picture fails" needs script. The script is short, and the short
  version has a hole: an image that fails **before hydration** fires `error` when no listener
  is attached, and React's `onError` never hears it. The part reads `img.complete` at mount
  and closes it.
- **A picture that works without the script.** The two popular headless Avatars render the
  `<img>` only after a script has preloaded the same URL with `new Image()`, so the server HTML
  has no image, the request starts after hydration, and a page without JavaScript shows the
  fallback for ever. Here the `<img>` is in the HTML and the fallback is under it.
- **One accessible name.** With the name on the `<img>`, a failed image leaves "JD" as the
  only thing a screen reader can read. The Root carries the name in every state.
- **Staying out of React's way.** React 19.3 holds a view-transition commit for a new image
  unless the element has an `onLoad` prop. A hand-written avatar that listens with `onLoad`
  switches that off without knowing. Section 5.
- **A name.** Three of the six surveyed libraries ship one (#162), and a consumer's styled
  layer wants a unit called Avatar.

The alternative is a docs recipe: `<img>` with a ref callback that checks `complete` and
listens for `error`. The cost of the part is three small client files, a context and a docs
page. Open decision 1 in the changelog.

## 3. Props and types

```ts
export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

export interface AvatarState {
  /** The load state of the image the Root last heard from. */
  readonly status: AvatarStatus;
}

export interface AvatarRootProps
  extends Omit<
    ComponentPropsWithRef<"span">,
    "role" | "aria-label" | "aria-labelledby" | "aria-hidden" | "className" | "style" | "children"
  > {
  /**
   * The avatar's text alternative, with the contract of `<img alt>`: who or what is pictured,
   * or `""` when the avatar is decoration next to text that already says it.
   */
  alt: string;
  className?: StateValue<string | undefined, AvatarState>;
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  children?: StateValue<ReactNode, AvatarState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, AvatarState>;
}

export interface AvatarImageProps
  extends Omit<ComponentPropsWithRef<"img">, "alt" | "className" | "style" | "children"> {
  /** No `src` (and no `srcSet`): the part renders nothing and the Fallback is the avatar. */
  src?: string | undefined;
  className?: StateValue<string | undefined, AvatarState>;
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  /** Must render an `<img>` and pass the ref on. */
  render?: RenderProp<ComponentPropsWithRef<"img">, AvatarState>;
}

export interface AvatarFallbackProps
  extends Omit<ComponentPropsWithRef<"span">, "className" | "style" | "children"> {
  className?: StateValue<string | undefined, AvatarState>;
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  children?: StateValue<ReactNode, AvatarState>;
  render?: RenderProp<ComponentPropsWithRef<"span">, AvatarState>;
}

export const Avatar: {
  Root: (props: AvatarRootProps) => ReactNode;
  Image: (props: AvatarImageProps) => ReactNode;
  Fallback: (props: AvatarFallbackProps) => ReactNode;
};
```

Owned keys (conventions 1.2): on the Root `role`, `aria-label`, `aria-hidden`, `data-status`;
on the Image `alt`, `data-status`; on the Fallback `data-status`. Everything else passes
through, so `width`, `height`, `srcSet`, `sizes`, `loading`, `decoding`, `fetchPriority`,
`crossOrigin` and `referrerPolicy` on the Image are the element's own.

`alt` is **required** on the Root, which is stricter than React's type for `<img>`. An avatar
is the standard case of an image whose author must decide between a name and decoration, and a
default would decide wrongly for half of the call sites.

Not offered:

- **`delay` / `delayMs` on the Fallback.** Section 6: there is no swap to delay.
- **`onStatusChange`.** A consumer's native `onError` passes through. A consumer's `onLoad`
  passes through too, with the cost section 5 names. The status is in every function prop.
  A new `on*` handler needs a conventions amendment (2.1), and nothing asks for one yet.
- **`keepMounted` on the Image** (Base UI). The image is always mounted while it can show.
- **`transition`.** Section 7.

## 4. The status

| `status` | Meaning | Image | Fallback |
| --- | --- | --- | --- |
| `"idle"` | No image has reported: the server render, the hydration render, and an avatar with no `Avatar.Image` that has a source. | rendered if it has a source | rendered |
| `"loading"` | A mounted image has a source and is not complete. | rendered | rendered, under it |
| `"loaded"` | The image is available. | rendered | **not rendered** |
| `"error"` | The image's current source failed. | **not rendered** | rendered |

The Root holds `{ status, source }` in `useState`, where `source` identifies what the report
is about (the Image's `src` and `srcSet`). The Image reports:

- **At mount and whenever its source changes**, from a layout effect, so the first paint after
  hydration is already right:
  - no source: `"idle"`;
  - `img.complete` is false: `"loading"`;
  - `img.complete` with a non-zero `naturalWidth`: `"loaded"`;
  - `img.complete` with `naturalWidth === 0`: undecided. An image with no intrinsic size (some
    SVGs) and a broken image look the same here, so the part asks `img.decode()`: a resolved
    promise is `"loaded"`, a rejected one `"error"`. A complete image settles `decode()`
    without a request.
- **On the native `load` and `error` events**, through listeners added in the ref callback:
  `"loaded"` and `"error"`.

A report is dropped when the Image's source is no longer the one it was made for.

Every write is a plain `setState` from the event or the layout effect, never inside
`startTransition`: the DOM already holds the fact, nothing is awaited or optimistic, and a
status held by an unrelated pending action (conventions 2.3 item 5) would leave initials over
a loaded picture. This is the lane conventions 2.6 lists as "a mirror of a browser-owned
fact" (Field's validity mirror is the precedent).

Consequences:

- **A new `src`** remounts nothing. The browser keeps painting the previous picture until the
  new one is available, the status goes back to `"loading"`, and the Fallback is rendered
  under the image again, unseen.
- **A failed source** unmounts the `<img>` (not `hidden`, which a consumer's
  `display: block` would defeat). A different `src` mounts a new one. The same `src` is not
  tried again: no retry in v1.
- **`loading="lazy"`** off screen stays `"loading"`, and the Fallback shows, until the browser
  fetches it.
- **Two `Avatar.Image` parts in one Root** warn in development; the last report wins.

## 5. Suspense, and the commit wait React already has

The issue asks whether the Avatar can wait for its image with Suspense. Three ways to do it
were weighed.

**The library suspends** (`use()` on a cached promise per URL). Rejected:

- A server render cannot load an image, so the server HTML would be the Suspense fallback, and
  the `<img>` would exist only after hydration: decision 2 lost, and nothing at all without
  JavaScript.
- The wait has no bound. A slow or dead image host would hold the transition that mounted the
  avatar, and with it every other transition in the app (conventions 2.3 item 5).
- It needs a module-level promise cache keyed by URL, with no moment to evict.
- It makes the library the owner of a wait the consumer cannot see, against conventions 6
  ("consumers own Suspense boundaries").

**The library renders a boundary** around the image. Rejected by conventions 6: the one
library-owned boundary is Toast's, for a reason that does not apply here.

**React waits, and the part does not get in the way.** Chosen. React 19.3 treats an `<img>`
as able to hold a commit: when an image is inserted (or its `src` / `srcSet` changes) under a
`<ViewTransition>` in a transition, react-dom calls `decode()` on it and delays the commit,
and so the animation, until the image is ready or a timeout passes (the React reference says
500 ms; the 19.3.1 source waits up to 800 ms before the commit, or 50 ms when the estimated
bytes exceed what the connection can deliver, and up to 500 ms more before the animation). The
conditions on the element are the part's business:

```js
// react-dom 19.3.1, maySuspendCommit, for type === "img"
null != props.src && "" !== props.src && null == props.onLoad && "lazy" !== props.loading
```

- **The library puts no `onLoad` prop on the image.** Its listeners are native, added through
  the ref. With an `onLoad` prop, React would skip the wait for every avatar.
- A consumer's own `onLoad` or `loading="lazy"` on `Avatar.Image` is React's documented way
  to opt one image out, and works as such.

So the answer at the call site is the ordinary React one, with no Avatar API:

```tsx
// The card is revealed with the picture in place, or after the timeout with the initials.
<ViewTransition>
  <Suspense fallback={<ProfileSkeleton />}>
    <Profile />   {/* suspends on data, renders <Avatar.Root> */}
  </Suspense>
</ViewTransition>
```

What this means for the library's own parts: an avatar inside a content region that has a
`transition` prop (a `Tabs.Panel`, a `Dialog.Popup`) is under a `<ViewTransition>`, so
switching to that panel waits for the avatar's image, bounded by the timeout, with
`data-pending` on the trigger meanwhile. That is the behaviour the vision asks for. A list of
fifty avatars does not wait fifty times: the timeout is one clock for the whole commit, the
second wait (before the animation starts) counts only images in the viewport, and
`loading="lazy"` opts an image out altogether.

When React waited and the image arrived, it is complete by the time the part's layout effect
runs, the first report is `"loaded"`, and the Fallback is never painted. When the timeout won,
the first report is `"loading"` and the avatar behaves as in section 4.

## 6. CSS

The library ships no CSS. The two layers share one grid cell, the image above:

```css
.avatar { display: inline-grid; inline-size: 2.5rem; aspect-ratio: 1; border-radius: 50%; overflow: clip; }
.avatar > * { grid-area: 1 / 1; }
.avatar-image { inline-size: 100%; block-size: 100%; object-fit: cover; }
.avatar-fallback { display: grid; place-items: center; background: var(--avatar-bg); }
```

This is also the whole no-JavaScript story: the image paints over the initials when it
arrives. A broken image with `alt=""` "represents nothing", which HTML renders as an empty
inline element, so the initials stay visible with no script (a browser-test row checks the
three engines).

**No flash of initials during a fast load.** The Fallback is in the DOM from the first paint;
CSS decides when it becomes visible. `:has(img)` is true exactly while an image may still
arrive (the part unmounts the `<img>` on error and renders none without a source), so the
delay applies only then, and works before hydration:

```css
.avatar:has(img) .avatar-fallback { animation: avatar-fallback-in 1ms 400ms backwards; }
@keyframes avatar-fallback-in { from { opacity: 0; } }
```

**Fading the picture in** must not hide it without script:

```css
@media (scripting: enabled) {
  .avatar-image { transition: opacity 150ms; }
  .avatar-image[data-status="loading"] { opacity: 0; }
}
```

**Transparent pictures** (a PNG logo) let the initials show through until hydration removes
the Fallback. Give `.avatar-image` a `background` if the pictures can be transparent; the
initials are then hidden while loading as well.

Tailwind: `data-[status=loading]:opacity-0`, `has-[img]:…`.

## 7. ViewTransition

No part takes `transition` (conventions 5). The status changes in an urgent update, which
starts no view transition, and making it a transition to get one would bring back the held
status of section 4. A consumer's own `<ViewTransition>` around the avatar is what section 5
is about; it animates the avatar's mount, not its status.

## 8. Accessibility

| Case | Rendered | Announced |
| --- | --- | --- |
| `alt="Jane Doe"`, any status | `span[role=img][aria-label="Jane Doe"]` | "Jane Doe, image", once |
| `alt=""`, any status | `span[aria-hidden=true]` | nothing |

- The children of `role="img"` are presentational, so the inner `<img>` and the Fallback's
  text never add a second name, and the name does not change when the image fails.
- Because of that, **nothing interactive goes inside the Root**. A link or a button wraps the
  Root (its name then includes the avatar's `alt`, or is the visible text next to a decorative
  one); a presence badge that must be announced is a sibling.
- Not focusable, no keyboard interaction.
- `alt` describes who is pictured ("Jane Doe"), not the widget ("avatar").
- The Fallback's colours are the consumer's: initials are text and need text contrast when the
  avatar is not decorative for sighted users either.

## 9. Server rendering and before hydration

- The server renders the Root, the `<img>` (when a source is given) and the Fallback, all with
  `data-status="idle"`. The hydration render is the same, so there is no mismatch.
- The image request starts from the HTML. Nothing in the part delays or repeats it.
- At hydration the Image's layout effect reads the element: an image that already loaded makes
  the status `"loaded"` in the hydration commit itself, and one that already failed `"error"`,
  so neither waits for an event that has passed.
- Without JavaScript: section 6.

## 10. Server/client boundary

All three part files are `"use client"`: the Root holds state and renders a context, the Image
and the Fallback read it. A Server Component renders them with serialisable props; function
`className` / `style` / `children` / `render` need a client component (conventions 7.1).

A directive-free Avatar was considered: it would be the two stacked elements of section 6 and
no status. It is a recipe, not a part, since it adds nothing to the two elements.

## 11. Not in v1

- `Avatar.Group` (overlap, "+3"): layout, in the consumer's CSS.
- A presence or status badge part.
- Initials or a colour derived from a name.
- A retry of a failed source.
- `onStatusChange`.
