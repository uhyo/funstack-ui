"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithRef, CSSProperties, ReactNode } from "react";
import type { DataAttributes } from "../internal/render-element.js";
import type { RenderProp, StateValue } from "../internal/types.js";
import { useRender } from "../internal/use-render.js";
import { AvatarContext } from "./avatar-context.js";
import type { AvatarContextValue } from "./avatar-context.js";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The load state of the avatar's image (design/components/avatar.md 4): `"idle"` until an image
 * with a source reports (the server render and the hydration render too), `"loading"` while it
 * is not complete, `"loaded"` once it is available, `"error"` when its current source failed.
 */
export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

/** The state every Avatar part receives. */
export interface AvatarState {
  /** The load state of the image the Root last heard from. */
  readonly status: AvatarStatus;
}

/**
 * Props of `Avatar.Root`.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export interface AvatarRootProps extends Omit<
  ComponentPropsWithRef<"span">,
  "role" | "aria-label" | "aria-labelledby" | "aria-hidden" | "className" | "style" | "children"
> {
  /**
   * The avatar's text alternative, with the contract of `<img alt>`: who or what is pictured, or
   * `""` when the avatar is decoration next to text that already says it. Non-empty: the Root is
   * `role="img"` with this `aria-label`, in every status. Empty: `aria-hidden="true"`.
   */
  alt: string;
  /** Class name, or a function of the part's state that returns one. */
  className?: StateValue<string | undefined, AvatarState>;
  /** Inline style, or a function of the part's state that returns one. */
  style?: StateValue<CSSProperties | undefined, AvatarState>;
  /** Content (an `Avatar.Image` and an `Avatar.Fallback`), or a function of the part's state. */
  children?: StateValue<ReactNode, AvatarState>;
  /** Replace the default `<span>` (element form) or take over rendering (function form). */
  render?: RenderProp<ComponentPropsWithRef<"span">, AvatarState>;
}

interface Report {
  readonly status: AvatarStatus;
  readonly source: string | null;
}

const IDLE: Report = { status: "idle", source: null };

/**
 * `Avatar.Root`: a `span` that names the avatar and holds the image's status. Owned keys
 * (conventions 1.5): `role`, `aria-label`, `aria-labelledby` (always absent: the one naming route
 * is `alt`, and a second name would win over it), `aria-hidden`, `data-status`. The status is a mirror of a browser-owned fact,
 * written urgently (conventions 2.6), never inside a transition.
 *
 * @see https://ui.funstack.work/components/avatar
 */
export function AvatarRoot({ alt, className, style, children, render, ...rest }: AvatarRootProps) {
  const [report, setReport] = useState<Report>(IDLE);
  const images = useRef(0);
  const warned = useRef(false);

  const write = useCallback((source: string, status: Exclude<AvatarStatus, "idle">) => {
    setReport((prev) =>
      prev.source === source && prev.status === status ? prev : { status, source },
    );
  }, []);
  const release = useCallback((source: string) => {
    setReport((prev) => (prev.source === source ? IDLE : prev));
  }, []);
  const registerImage = useCallback(() => {
    images.current += 1;
    if (isDev && images.current > 1 && !warned.current) {
      warned.current = true;
      console.error(
        "Avatar.Root: more than one Avatar.Image is rendered in one Avatar.Root. The status " +
          "follows whichever image reported last; render one Avatar.Image per Root.",
      );
    }
    return () => {
      images.current -= 1;
    };
  }, []);

  const context = useMemo<AvatarContextValue>(
    () => ({
      status: report.status,
      source: report.source,
      report: write,
      release,
      registerImage,
    }),
    [report, write, release, registerImage],
  );

  const state: AvatarState = useMemo(() => ({ status: report.status }), [report.status]);

  const named = alt !== "";
  const libraryProps: Partial<ComponentPropsWithRef<"span">> & DataAttributes = {
    role: named ? "img" : undefined,
    "aria-label": named ? alt : undefined,
    // Owned and absent, so a `render` element's own cannot take the name from `alt`.
    "aria-labelledby": undefined,
    "aria-hidden": named ? undefined : true,
    "data-status": report.status,
  };

  const element = useRender<ComponentPropsWithRef<"span">, AvatarState>({
    defaultElement: "span",
    render,
    state,
    className,
    style,
    children,
    props: rest,
    libraryProps,
  });

  return <AvatarContext value={context}>{element}</AvatarContext>;
}

AvatarRoot.displayName = "AvatarRoot";
