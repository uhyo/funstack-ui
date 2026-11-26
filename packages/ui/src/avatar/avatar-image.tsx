"use client";
import { isValidElement, useCallback, useLayoutEffect, useRef } from "react";
import type { ComponentPropsWithRef, CSSProperties, Ref } from "react";
import { renderElement } from "../internal/render-element.js";
import { useMergedRefs } from "../internal/use-merged-refs.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { sourceKey, useAvatarContext } from "./avatar-context.js";
import type { AvatarState } from "./avatar-root.js";

/**
 * Props of `Avatar.Image`.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export interface AvatarImageProps extends Omit<
  ComponentPropsWithRef<"img">,
  "alt" | "className" | "style" | "children"
> {
  /** No `src` (and no `srcSet`): the part renders nothing and the Fallback is the avatar. */
  src?: string | undefined;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AvatarState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  /** Replace the default `<img>` (element form) or take over rendering (function form). Must
   * render an `<img>` and pass the ref on. */
  render?: RenderProp<ComponentPropsWithRef<"img">, AvatarState>;
}

/**
 * `Avatar.Image`: the picture, an `<img alt="">` (the Root carries the name). Rendered from the
 * first render, on the server too, while it has a source that has not failed. Owned keys: `alt`,
 * `data-status`.
 *
 * It listens with native `load` / `error` listeners and reads `img.complete` at mount, and
 * **never renders an `onLoad` prop**: react-dom's `maySuspendCommit` reads one as "this image
 * opts out of the commit wait" under a `<ViewTransition>` (design/components/avatar.md 5).
 *
 * @see https://ui.funstack.work/components/avatar
 */
export function AvatarImage({ className, style, render, ...rest }: AvatarImageProps) {
  const {
    status,
    source: reported,
    report,
    release,
    registerImage,
  } = useAvatarContext("Avatar.Image");
  const source = sourceKey(rest.src, rest.srcSet);
  const element = useRef<HTMLImageElement | null>(null);
  // The source the mounted element is loading, as of the last commit. Events and `decode()`
  // results are attributed to it; a report for an older source is dropped (design 4).
  const current = useRef<string | null>(source);

  useLayoutEffect(registerImage, [registerImage]);

  // Native listeners through the ref, never `onLoad` (design 5). An event is taken only while
  // the element is `complete`: a late event for a source the element no longer loads finds it
  // incomplete (its new request is running) and is dropped.
  const listen = useCallback(
    (img: HTMLImageElement) => {
      element.current = img;
      const settle = (status: "loaded" | "error") => {
        const key = current.current;
        if (key !== null && img.complete) report(key, status);
      };
      const onLoad = () => settle("loaded");
      const onError = () => settle("error");
      img.addEventListener("load", onLoad);
      img.addEventListener("error", onError);
      return () => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
        if (element.current === img) element.current = null;
      };
    },
    [report],
  );

  // At mount and on every source change, read the element: an image that finished before
  // hydration (or while react-dom held the commit for it) fired its event before any listener.
  useLayoutEffect(() => {
    current.current = source;
    if (source === null) return;
    const img = element.current;
    // The source failed already: the element is not rendered and the status stays "error".
    if (img === null) return;
    let live = true;
    if (!img.complete) {
      report(source, "loading");
    } else if (img.naturalWidth > 0) {
      report(source, "loaded");
    } else {
      // Complete with no natural width: broken, or an image with no intrinsic size (some SVGs).
      // `decode()` separates them without a request.
      report(source, "loading");
      const decided = (status: "loaded" | "error") => () => {
        if (live && current.current === source) report(source, status);
      };
      if (typeof img.decode === "function") {
        img.decode().then(decided("loaded"), decided("error"));
      } else {
        decided("error")();
      }
    }
    return () => {
      live = false;
      release(source);
    };
  }, [source, report, release]);

  const failed = source === null || (status === "error" && reported === source);

  // Stable, so that React does not re-attach the listeners on every status change. `useRender`'s
  // merge, inlined: once its source failed the element is not rendered at all, and a function
  // `render` must not run then.
  const ref = useMergedRefs<HTMLImageElement>(listen, rest.ref, elementRefOf(render));

  if (failed) return null;
  return renderElement<ComponentPropsWithRef<"img">, AvatarState>({
    defaultElement: "img",
    render,
    state: { status },
    className,
    style,
    children: undefined,
    props: rest,
    libraryProps: { alt: "", "data-status": status },
    ref: ref as Ref<unknown>,
  });
}

AvatarImage.displayName = "AvatarImage";

/** The `ref` of a `render` element, attached with the part's own (as `useRender` does). */
function elementRefOf(render: AvatarImageProps["render"]): Ref<HTMLImageElement> | undefined {
  return isValidElement<{ ref?: Ref<HTMLImageElement> }>(render) ? render.props.ref : undefined;
}
