// Avatar rows (design/components/avatar.md; the test plan is in the #171 entries of
// design/CHANGELOG.md): the server HTML and hydration, the status from `complete` at mount and
// from native `load` / `error`, `decode()` for a complete image with no natural width, source
// changes and dropped late reports, the accessible name, no `onLoad` prop on the element, urgent
// status writes while an unrelated async action is pending, the two-images warning, function
// props, `render` and `ref`. The Directive rows are in src/__tests__/directives.test.ts; real
// loads, the commit wait under a ViewTransition and the no-script paint are browser rows
// (avatar.browser.test.tsx). Keyboard: none (not focusable).
//
// jsdom loads no image and has no `decode()`: `complete`, `naturalWidth` and `decode` are faked
// per element below.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, startTransition, StrictMode, useState } from "react";
import type { ComponentPropsWithRef } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { onCleanup } from "../__tests__/cleanups.js";
import { deferred, flushMicrotasks, hydrateFromServer } from "../__tests__/helpers.js";
import type { Deferred } from "../__tests__/helpers.js";
import { Avatar } from "./index.js";
import type { AvatarState } from "./index.js";

interface FakeImage {
  complete: boolean;
  naturalWidth: number;
}

/**
 * Fakes the load state of every `<img>`: `fake(img)` is its state (mutable), `initial` the state
 * an element has before a test touched it. `decode` is installed when `decodes` is given: each
 * call pushes a deferred the test settles.
 */
function fakeImages(initial: FakeImage = { complete: false, naturalWidth: 0 }, decodes = true) {
  const states = new WeakMap<HTMLImageElement, FakeImage>();
  const fake = (img: HTMLImageElement): FakeImage => {
    let state = states.get(img);
    if (state === undefined) {
      state = { ...initial };
      states.set(img, state);
    }
    return state;
  };
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockImplementation(function (
    this: HTMLImageElement,
  ) {
    return fake(this).complete;
  });
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockImplementation(function (
    this: HTMLImageElement,
  ) {
    return fake(this).naturalWidth;
  });
  const decodeCalls: Deferred<void>[] = [];
  if (decodes) {
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value() {
        const d = deferred();
        decodeCalls.push(d);
        return d.promise;
      },
    });
    onCleanup(() => {
      delete (HTMLImageElement.prototype as { decode?: unknown }).decode;
    });
  }
  /** Marks `img` complete (loaded or broken) and fires the event the browser would. */
  const finish = (img: HTMLImageElement, outcome: "load" | "error") => {
    Object.assign(fake(img), { complete: true, naturalWidth: outcome === "load" ? 40 : 0 });
    if (outcome === "load") fireEvent.load(img);
    else fireEvent.error(img);
  };
  return { fake, finish, decodeCalls };
}

const root = () => screen.getByTestId("root");
const img = () => root().querySelector("img");
const fallback = () => screen.queryByTestId("fallback");

function Basic({ src, alt = "Jane Doe" }: { src?: string | undefined; alt?: string }) {
  return (
    <Avatar.Root alt={alt} data-testid="root">
      <Avatar.Image src={src} data-testid="image" />
      <Avatar.Fallback data-testid="fallback">JD</Avatar.Fallback>
    </Avatar.Root>
  );
}

describe("Avatar", () => {
  describe("server render and hydration", () => {
    it("renders the Root, an <img alt> and the Fallback, all idle", () => {
      const html = renderToString(<Basic src="/jane.png" />);
      // react-dom's server renderer also emits a `<link rel="preload" as="image">` for it.
      expect(html).toContain(
        '<span data-testid="root" role="img" aria-label="Jane Doe" data-status="idle">' +
          '<img src="/jane.png" data-testid="image" alt="" data-status="idle"/>' +
          '<span data-testid="fallback" data-status="idle">JD</span></span>',
      );
    });

    it("renders no <img> without a source", () => {
      expect(renderToString(<Basic />)).not.toContain("<img");
      expect(renderToString(<Basic src="" />)).not.toContain("<img");
    });

    it("hydrates without a mismatch; an image still loading reports loading", async () => {
      fakeImages();
      const recoverable = vi.spyOn(console, "error");
      await hydrateFromServer(<Basic src="/jane.png" />);
      expect(recoverable).not.toHaveBeenCalled();
      expect(root()).toHaveAttribute("data-status", "loading");
      expect(img()).toHaveAttribute("data-status", "loading");
      expect(fallback()).toHaveAttribute("data-status", "loading");
    });

    it("an image that loaded before hydration is loaded in the hydration commit", async () => {
      fakeImages({ complete: true, naturalWidth: 40 });
      await hydrateFromServer(<Basic src="/jane.png" />, { flush: null });
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(img()).toHaveAttribute("data-status", "loaded");
      expect(fallback()).toBeNull();
    });

    it("an image that failed before hydration (no event heard) ends in error", async () => {
      const { decodeCalls } = fakeImages({ complete: true, naturalWidth: 0 });
      await hydrateFromServer(<Basic src="/broken.png" />);
      // Complete with no natural width: broken or sizeless, decided by decode().
      expect(root()).toHaveAttribute("data-status", "loading");
      expect(decodeCalls).toHaveLength(1);
      await act(async () => decodeCalls[0]!.reject(new Error("EncodingError")));
      expect(root()).toHaveAttribute("data-status", "error");
      expect(img()).toBeNull();
      expect(fallback()).toHaveAttribute("data-status", "error");
    });
  });

  describe("status", () => {
    it("load → loaded, the Fallback unmounted", () => {
      const { finish } = fakeImages();
      render(<Basic src="/jane.png" />);
      expect(root()).toHaveAttribute("data-status", "loading");
      expect(fallback()).not.toBeNull();
      act(() => finish(img()!, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(img()).toHaveAttribute("data-status", "loaded");
      expect(fallback()).toBeNull();
    });

    it("error → error, the <img> unmounted", () => {
      const { finish } = fakeImages();
      render(<Basic src="/broken.png" />);
      act(() => finish(img()!, "error"));
      expect(root()).toHaveAttribute("data-status", "error");
      expect(img()).toBeNull();
      expect(fallback()).toHaveAttribute("data-status", "error");
    });

    it("a complete image with no natural width whose decode() resolves is loaded (a sizeless SVG)", async () => {
      const { decodeCalls } = fakeImages({ complete: true, naturalWidth: 0 });
      render(<Basic src="/logo.svg" />);
      expect(root()).toHaveAttribute("data-status", "loading");
      await act(async () => decodeCalls[0]!.resolve());
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(img()).not.toBeNull();
    });

    it("without decode(), a complete image with no natural width is an error", () => {
      fakeImages({ complete: true, naturalWidth: 0 }, false);
      render(<Basic src="/broken.png" />);
      expect(root()).toHaveAttribute("data-status", "error");
      expect(img()).toBeNull();
    });

    it("a complete image with a natural width is loaded at mount", () => {
      fakeImages({ complete: true, naturalWidth: 40 });
      render(<Basic src="/cached.png" />);
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(fallback()).toBeNull();
    });

    it("no source: idle, no <img>, the Fallback shown", () => {
      fakeImages();
      render(<Basic />);
      expect(root()).toHaveAttribute("data-status", "idle");
      expect(img()).toBeNull();
      expect(fallback()).toHaveAttribute("data-status", "idle");
    });

    it("no Avatar.Image: idle", () => {
      render(
        <Avatar.Root alt="Jane" data-testid="root">
          <Avatar.Fallback data-testid="fallback">J</Avatar.Fallback>
        </Avatar.Root>,
      );
      expect(root()).toHaveAttribute("data-status", "idle");
    });

    it("an event while the element is not complete is dropped", () => {
      fakeImages();
      render(<Basic src="/jane.png" />);
      act(() => {
        fireEvent.load(img()!);
      });
      expect(root()).toHaveAttribute("data-status", "loading");
    });

    it("works in StrictMode", () => {
      const { finish } = fakeImages();
      render(
        <StrictMode>
          <Basic src="/jane.png" />
        </StrictMode>,
      );
      expect(root()).toHaveAttribute("data-status", "loading");
      act(() => finish(img()!, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
    });
  });

  describe("source changes", () => {
    function Switcher({ initial }: { initial: string }) {
      const [src, setSrc] = useState<string | undefined>(initial);
      return (
        <>
          <Basic src={src} />
          <button type="button" onClick={() => setSrc("/b.png")}>
            b
          </button>
          <button type="button" onClick={() => setSrc(undefined)}>
            none
          </button>
        </>
      );
    }

    it("a new src goes back to loading on the same element", () => {
      const { finish, fake } = fakeImages();
      render(<Switcher initial="/a.png" />);
      const first = img()!;
      act(() => finish(first, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(fallback()).toBeNull();
      // The browser starts the new request when the attribute changes: no longer complete.
      fake(first).complete = false;
      act(() => {
        fireEvent.click(screen.getByText("b"));
      });
      expect(img()).toBe(first);
      expect(first).toHaveAttribute("src", "/b.png");
      expect(root()).toHaveAttribute("data-status", "loading");
      // Rendered under the image again, unseen while the old picture is still painted.
      expect(fallback()).not.toBeNull();
      act(() => finish(first, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
    });

    it("a new src while the old one loads: loading, and the new load decides", () => {
      const { finish } = fakeImages();
      render(<Switcher initial="/a.png" />);
      act(() => {
        fireEvent.click(screen.getByText("b"));
      });
      expect(root()).toHaveAttribute("data-status", "loading");
      expect(fallback()).not.toBeNull();
      act(() => finish(img()!, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
    });

    it("a late decode() result for the old source is dropped", async () => {
      const { decodeCalls, fake } = fakeImages({ complete: true, naturalWidth: 0 });
      render(<Switcher initial="/a.svg" />);
      expect(decodeCalls).toHaveLength(1);
      // The new source is still loading.
      fake(img()!).complete = false;
      act(() => {
        fireEvent.click(screen.getByText("b"));
      });
      expect(root()).toHaveAttribute("data-status", "loading");
      await act(async () => decodeCalls[0]!.reject(new Error("old")));
      expect(root()).toHaveAttribute("data-status", "loading");
      expect(img()).not.toBeNull();
    });

    it("a new src after an error mounts a new <img>", () => {
      const { finish } = fakeImages();
      render(<Switcher initial="/a.png" />);
      const first = img()!;
      act(() => finish(first, "error"));
      expect(img()).toBeNull();
      act(() => {
        fireEvent.click(screen.getByText("b"));
      });
      const second = img();
      expect(second).not.toBeNull();
      expect(second).not.toBe(first);
      expect(root()).toHaveAttribute("data-status", "loading");
      act(() => finish(second!, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
    });

    it("removing the source goes back to idle", () => {
      const { finish } = fakeImages();
      render(<Switcher initial="/a.png" />);
      act(() => finish(img()!, "load"));
      act(() => {
        fireEvent.click(screen.getByText("none"));
      });
      expect(root()).toHaveAttribute("data-status", "idle");
      expect(img()).toBeNull();
      expect(fallback()).not.toBeNull();
    });

    it("unmounting the Image goes back to idle", () => {
      const { finish } = fakeImages();
      function Toggle() {
        const [shown, setShown] = useState(true);
        return (
          <>
            <Avatar.Root alt="J" data-testid="root">
              {shown && <Avatar.Image src="/a.png" />}
              <Avatar.Fallback data-testid="fallback">J</Avatar.Fallback>
            </Avatar.Root>
            <button type="button" onClick={() => setShown(false)}>
              hide
            </button>
          </>
        );
      }
      render(<Toggle />);
      act(() => finish(img()!, "load"));
      expect(fallback()).toBeNull();
      act(() => {
        fireEvent.click(screen.getByText("hide"));
      });
      expect(root()).toHaveAttribute("data-status", "idle");
      expect(fallback()).not.toBeNull();
    });
  });

  describe("accessible name", () => {
    it('a non-empty alt: role="img" with aria-label, in every status; the <img> is alt=""', () => {
      const { finish } = fakeImages();
      render(<Basic src="/broken.png" />);
      const avatar = screen.getByRole("img", { name: "Jane Doe" });
      expect(avatar).toBe(root());
      expect(avatar).not.toHaveAttribute("aria-hidden");
      expect(img()).toHaveAttribute("alt", "");
      act(() => finish(img()!, "error"));
      expect(screen.getByRole("img", { name: "Jane Doe" })).toBe(root());
      // Only the Root is exposed: the Fallback text adds no second name.
      expect(screen.getAllByRole("img")).toHaveLength(1);
    });

    it('alt="": aria-hidden, no role', () => {
      fakeImages();
      render(<Basic src="/a.png" alt="" />);
      expect(root()).toHaveAttribute("aria-hidden", "true");
      expect(root()).not.toHaveAttribute("role");
      expect(root()).not.toHaveAttribute("aria-label");
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("owns role, aria-label, aria-labelledby and aria-hidden over a render element's", () => {
      render(
        <>
          <span id="other">Someone else</span>
          <Avatar.Root
            alt="Jane"
            render={
              <span
                role="presentation"
                aria-label="x"
                aria-labelledby="other"
                aria-hidden="true"
                data-testid="root"
              />
            }
          />
        </>,
      );
      expect(root()).toHaveAttribute("role", "img");
      expect(root()).toHaveAttribute("aria-label", "Jane");
      // One naming route, `alt` (conventions 1.5): a second name would win over it.
      expect(root()).not.toHaveAttribute("aria-labelledby");
      expect(root()).toHaveAccessibleName("Jane");
      expect(root()).not.toHaveAttribute("aria-hidden");
    });

    it("owns alt and data-status on the Image", () => {
      fakeImages();
      render(
        <Avatar.Root alt="Jane" data-testid="root">
          <Avatar.Image src="/a.png" render={<img alt="nope" data-status="x" />} />
        </Avatar.Root>,
      );
      expect(img()).toHaveAttribute("alt", "");
      expect(img()).toHaveAttribute("data-status", "loading");
    });

    it("is not focusable", () => {
      render(<Basic />);
      act(() => root().focus());
      expect(document.activeElement).not.toBe(root());
    });
  });

  describe("no onLoad prop (React's commit wait)", () => {
    it("the element's props carry no onLoad and no onError", () => {
      fakeImages();
      const seen: Record<string, unknown>[] = [];
      render(
        <Avatar.Root alt="Jane">
          <Avatar.Image
            src="/a.png"
            render={(props: ComponentPropsWithRef<"img">) => {
              seen.push(props as Record<string, unknown>);
              return <img {...props} />;
            }}
          />
        </Avatar.Root>,
      );
      expect(seen.length).toBeGreaterThan(0);
      for (const props of seen) {
        expect(props).not.toHaveProperty("onLoad");
        expect(props).not.toHaveProperty("onError");
      }
    });

    it("a consumer's onLoad and onError pass through; the status follows too", () => {
      const { finish } = fakeImages();
      const onLoad = vi.fn();
      const onError = vi.fn();
      function Two() {
        const [src, setSrc] = useState("/a.png");
        return (
          <>
            <Avatar.Root alt="Jane" data-testid="root">
              <Avatar.Image src={src} onLoad={onLoad} onError={onError} />
            </Avatar.Root>
            <button type="button" onClick={() => setSrc("/b.png")}>
              b
            </button>
          </>
        );
      }
      render(<Two />);
      act(() => finish(img()!, "error"));
      expect(onError).toHaveBeenCalledTimes(1);
      expect(root()).toHaveAttribute("data-status", "error");
      act(() => {
        fireEvent.click(screen.getByText("b"));
      });
      act(() => finish(img()!, "load"));
      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(root()).toHaveAttribute("data-status", "loaded");
    });
  });

  describe("Async React", () => {
    it("the status commits while an unrelated async action is pending (urgent, not a transition)", async () => {
      const { finish } = fakeImages();
      const gate = deferred();
      function App() {
        const [label, setLabel] = useState("before");
        return (
          <>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await gate.promise;
                  startTransition(() => setLabel("after"));
                })
              }
            >
              {label}
            </button>
            <Basic src="/jane.png" />
          </>
        );
      }
      render(<App />);
      await act(async () => {
        fireEvent.click(screen.getByText("before"));
      });
      act(() => finish(img()!, "load"));
      // The unrelated action is still pending, the status is not held by it.
      expect(screen.getByText("before")).toBeInTheDocument();
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(fallback()).toBeNull();
      await act(async () => gate.resolve());
      expect(screen.getByText("after")).toBeInTheDocument();
    });

    it("a status change in the middle of a transition that renders the avatar is not held", async () => {
      const { finish } = fakeImages();
      const gate = deferred();
      function App() {
        const [n, setN] = useState(0);
        return (
          <>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await gate.promise;
                  startTransition(() => setN(1));
                })
              }
            >
              go
            </button>
            <Avatar.Root alt="J" data-testid="root" data-n={n}>
              <Avatar.Image src="/a.png" />
              <Avatar.Fallback data-testid="fallback">J</Avatar.Fallback>
            </Avatar.Root>
          </>
        );
      }
      render(<App />);
      await act(async () => {
        fireEvent.click(screen.getByText("go"));
      });
      act(() => finish(img()!, "error"));
      expect(root()).toHaveAttribute("data-status", "error");
      expect(root()).toHaveAttribute("data-n", "0");
      await act(async () => gate.resolve());
      await flushMicrotasks();
      expect(root()).toHaveAttribute("data-n", "1");
      expect(root()).toHaveAttribute("data-status", "error");
    });
  });

  describe("development warnings and errors", () => {
    it("two Images in one Root warn once", () => {
      fakeImages();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      render(
        <Avatar.Root alt="J">
          <Avatar.Image src="/a.png" />
          <Avatar.Image src="/b.png" />
        </Avatar.Root>,
      );
      const calls = error.mock.calls.filter((c) => String(c[0]).includes("more than one"));
      expect(calls).toHaveLength(1);
    });

    it("one Image does not warn", () => {
      fakeImages();
      const error = vi.spyOn(console, "error");
      render(
        <StrictMode>
          <Basic src="/a.png" />
        </StrictMode>,
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("Image and Fallback outside a Root throw", () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<Avatar.Image src="/a.png" />)).toThrow(
        "Avatar.Image must be rendered inside an Avatar.Root.",
      );
      expect(() => render(<Avatar.Fallback />)).toThrow(
        "Avatar.Fallback must be rendered inside an Avatar.Root.",
      );
    });
  });

  describe("function props, render and ref", () => {
    it("className, style and children receive { status } on every part", () => {
      const { finish } = fakeImages();
      const states: AvatarState[] = [];
      render(
        <Avatar.Root
          alt="J"
          data-testid="root"
          className={(s) => `root-${s.status}`}
          style={(s) => ({ opacity: s.status === "loaded" ? 1 : 0.5 })}
        >
          {(s) => {
            states.push(s);
            return (
              <>
                <Avatar.Image src="/a.png" className={(i) => `img-${i.status}`} />
                <Avatar.Fallback data-testid="fallback" className={(f) => `fb-${f.status}`}>
                  {(f) => `fallback ${f.status}`}
                </Avatar.Fallback>
              </>
            );
          }}
        </Avatar.Root>,
      );
      expect(root()).toHaveClass("root-loading");
      expect(root().style.opacity).toBe("0.5");
      expect(img()).toHaveClass("img-loading");
      expect(fallback()).toHaveClass("fb-loading");
      expect(fallback()).toHaveTextContent("fallback loading");
      act(() => finish(img()!, "load"));
      expect(root()).toHaveClass("root-loaded");
      expect(img()).toHaveClass("img-loaded");
      expect(states.at(-1)).toEqual({ status: "loaded" });
    });

    it("a function render of the Fallback does not run once loaded", () => {
      const { finish } = fakeImages();
      const renderFallback = vi.fn((props: ComponentPropsWithRef<"span">) => <i {...props} />);
      render(
        <Avatar.Root alt="J" data-testid="root">
          <Avatar.Image src="/a.png" />
          <Avatar.Fallback render={renderFallback}>J</Avatar.Fallback>
        </Avatar.Root>,
      );
      expect(root().querySelector("i")).toHaveTextContent("J");
      act(() => finish(img()!, "load"));
      renderFallback.mockClear();
      expect(root().querySelector("i")).toBeNull();
      expect(renderFallback).not.toHaveBeenCalled();
    });

    it("forwards refs on every part, a render element's ref too, and keeps listening", () => {
      const { finish } = fakeImages();
      const rootRef = createRef<HTMLSpanElement>();
      const imageRef = createRef<HTMLImageElement>();
      const elementRef = createRef<HTMLImageElement>();
      const fallbackRef = createRef<HTMLSpanElement>();
      render(
        <Avatar.Root alt="J" ref={rootRef} data-testid="root" id="r">
          <Avatar.Image src="/a.png" ref={imageRef} render={<img ref={elementRef} />} width={40} />
          <Avatar.Fallback ref={fallbackRef} data-testid="fallback" title="t" />
        </Avatar.Root>,
      );
      expect(rootRef.current).toBe(root());
      expect(root()).toHaveAttribute("id", "r");
      expect(imageRef.current).toBe(img());
      expect(elementRef.current).toBe(img());
      expect(img()).toHaveAttribute("width", "40");
      expect(fallbackRef.current).toBe(fallback());
      expect(fallback()).toHaveAttribute("title", "t");
      act(() => finish(img()!, "load"));
      expect(root()).toHaveAttribute("data-status", "loaded");
      expect(fallbackRef.current).toBeNull();
    });

    it("the Root's render function form receives the props and the state", () => {
      render(
        <Avatar.Root alt="J" render={(props, state) => <b {...props} data-s={state.status} />} />,
      );
      const b = screen.getByRole("img", { name: "J" });
      expect(b.tagName).toBe("B");
      expect(b).toHaveAttribute("data-s", "idle");
    });
  });
});
