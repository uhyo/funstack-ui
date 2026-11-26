// Ships the platform attribute typings with this subpath (conventions 7.4). Type-only: the
// built JS has no import of it.
import "../internal/platform-attributes.js";
import { AvatarFallback } from "./avatar-fallback.js";
import { AvatarImage } from "./avatar-image.js";
import { AvatarRoot } from "./avatar-root.js";

/**
 * Avatar: a picture of a person or a thing, with something to show in its place. `Root` (a
 * `span` that carries the name: `role="img"` + `aria-label` from the required `alt`, or
 * `aria-hidden` for `alt=""`), `Image` (an `<img alt="">` in the server HTML from the first
 * render) and `Fallback` (rendered under the image until it has loaded). `data-status` /
 * `state.status` is `"idle" | "loading" | "loaded" | "error"`, an urgent mirror of the image. No
 * action, nothing pending; the image never gets an `onLoad` prop, so React's commit wait for
 * images under a `<ViewTransition>` applies to it.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export const Avatar = {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
} as const;

export type { AvatarRootProps, AvatarState, AvatarStatus } from "./avatar-root.js";
export type { AvatarImageProps } from "./avatar-image.js";
export type { AvatarFallbackProps } from "./avatar-fallback.js";
