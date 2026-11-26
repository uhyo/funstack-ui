// Avatar browser rows (design/components/avatar.md; the "Owed before implementation" rows of the
// #171 entry in design/CHANGELOG.md): what jsdom cannot observe. Real loads and failures; the
// status after hydration of an image that finished before it (loaded, broken, and an SVG with no
// intrinsic size, which `decode()` separates from a broken one); react-dom's commit wait for an
// `Avatar.Image` under a `<ViewTransition>`, and its absence with a consumer `onLoad`; a broken
// `<img alt="">` painting nothing over the Fallback without script.
import { render, screen } from "@testing-library/react";
import { startTransition, useState, ViewTransition } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { addStyle, onCleanup, outsideAct } from "../__tests__/browser-helpers.js";
import { Avatar } from "./index.js";
import type { AvatarStatus } from "./index.js";

const css = `
.avatar { display: inline-grid; inline-size: 40px; block-size: 40px; overflow: clip; }
.avatar > * { grid-area: 1 / 1; }
.avatar-image { inline-size: 100%; block-size: 100%; object-fit: cover; }
.avatar-fallback { display: grid; place-items: center; background: rgb(0, 128, 0); }
`;

/** A fresh PNG (unique pixels, so no engine has it cached) as a blob URL. */
async function pngUrl(size = 64): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = `rgb(${Math.floor(Math.random() * 256)}, 0, ${Math.floor(Math.random() * 256)})`;
  context.fillRect(0, 0, size, size);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
  const url = URL.createObjectURL(blob);
  onCleanup(() => URL.revokeObjectURL(url));
  return url;
}

/** Bytes that are no image: the request succeeds and decoding fails, so `error` fires. */
function brokenUrl(): string {
  const url = URL.createObjectURL(
    new Blob([`not an image ${Math.random()}`], { type: "image/png" }),
  );
  onCleanup(() => URL.revokeObjectURL(url));
  return url;
}

/** An SVG with no width, height or viewBox: no intrinsic size (`naturalWidth` may be 0). */
const sizelessSvg = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${Math.random()} --></svg>`,
)}`;

function Basic({ src, alt = "Jane Doe" }: { src: string; alt?: string }) {
  return (
    <Avatar.Root alt={alt} className="avatar" data-testid="root">
      <Avatar.Image src={src} className="avatar-image" />
      <Avatar.Fallback className="avatar-fallback" data-testid="fallback" />
    </Avatar.Root>
  );
}

const root = () => screen.getByTestId("root");
const img = () => root().querySelector("img");

/** Server HTML in a fresh container, as the browser would parse it before any script. */
function serverHtml(ui: ReactNode): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToString(ui);
  document.body.append(container);
  onCleanup(() => container.remove());
  return container;
}

/** Hydrates `ui` into `container`; unmounted after the test. */
function hydrate(container: HTMLElement, ui: ReactNode): unknown[] {
  const recoverable: unknown[] = [];
  const hydrated: Root = hydrateRoot(container, ui, {
    onRecoverableError: (e) => recoverable.push(e),
  });
  onCleanup(() => hydrated.unmount());
  return recoverable;
}

describe("Avatar (browser)", () => {
  describe("real loads", () => {
    it("a loading image ends loaded; the Fallback goes", async () => {
      addStyle(css);
      const src = await pngUrl();
      render(<Basic src={src} />);
      await expect.poll(() => root().dataset["status"]).toBe("loaded");
      expect(img()).not.toBeNull();
      expect(screen.queryByTestId("fallback")).toBeNull();
    });

    it("a broken image reports error; the <img> is removed", async () => {
      addStyle(css);
      render(<Basic src={brokenUrl()} />);
      await expect.poll(() => root().dataset["status"]).toBe("error");
      expect(img()).toBeNull();
      expect(screen.getByTestId("fallback")).toHaveAttribute("data-status", "error");
    });

    it("an SVG with no intrinsic size is loaded, not an error", async () => {
      addStyle(css);
      render(<Basic src={sizelessSvg} />);
      await expect.poll(() => root().dataset["status"]).toBe("loaded");
      expect(img()).not.toBeNull();
    });
  });

  describe("status after hydration (the image finished before any listener)", () => {
    it.each([
      ["a loaded PNG", "loaded" as const, () => pngUrl()],
      ["a broken image", "error" as const, async () => brokenUrl()],
      ["an SVG with no intrinsic size", "loaded" as const, async () => sizelessSvg],
    ])("%s: %s", async (_name, expected: AvatarStatus, source) => {
      addStyle(css);
      const src = await source();
      const ui = <Basic src={src} />;
      const container = serverHtml(ui);
      const before = container.querySelector("img")!;
      await expect.poll(() => before.complete).toBe(true);
      // Let the load / error event go by with no listener attached.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(container.querySelector("[data-status]")).toHaveAttribute("data-status", "idle");
      const recoverable = hydrate(container, ui);
      await expect.poll(() => root().dataset["status"]).toBe(expected);
      expect(recoverable).toEqual([]);
      if (expected === "error") expect(img()).toBeNull();
      else expect(img()).toBe(before);
    });
  });

  describe("react-dom's commit wait under a ViewTransition", () => {
    async function mountInTransition(withOnLoad: boolean) {
      addStyle(css);
      const src = await pngUrl(512);
      const completeAtCommit: boolean[] = [];
      const statuses: (string | undefined)[] = [];
      function Host() {
        const [shown, setShown] = useState(false);
        return (
          <>
            <button type="button" onClick={() => startTransition(() => setShown(true))}>
              show
            </button>
            <ViewTransition>
              {shown && (
                <Avatar.Root
                  alt="J"
                  className="avatar"
                  data-testid="root"
                  ref={(el) => {
                    if (el === null) return;
                    const observer = new MutationObserver(() =>
                      statuses.push(el.dataset["status"]),
                    );
                    observer.observe(el, { attributeFilter: ["data-status"] });
                    return () => observer.disconnect();
                  }}
                >
                  <Avatar.Image
                    src={src}
                    className="avatar-image"
                    {...(withOnLoad && { onLoad: () => {} })}
                    ref={(el) => {
                      if (el !== null) completeAtCommit.push(el.complete);
                    }}
                  />
                  <Avatar.Fallback className="avatar-fallback" />
                </Avatar.Root>
              )}
            </ViewTransition>
          </>
        );
      }
      render(<Host />);
      await outsideAct(async () => {
        screen.getByRole("button", { name: "show" }).click();
        await expect.poll(() => screen.queryByTestId("root")).not.toBeNull();
        await expect.poll(() => root().dataset["status"]).toBe("loaded");
      });
      return { completeAtCommit, statuses };
    }

    it("without onLoad, React holds the commit until the image is ready: loaded at once", async () => {
      const { completeAtCommit, statuses } = await mountInTransition(false);
      expect(completeAtCommit[0]).toBe(true);
      // The first report is "loaded": the Fallback was never shown over a loading image.
      expect(statuses).not.toContain("loading");
      expect(statuses.at(-1)).toBe("loaded");
    });

    it("a consumer onLoad opts the image out: committed before it loaded", async () => {
      const { completeAtCommit, statuses } = await mountInTransition(true);
      expect(completeAtCommit[0]).toBe(false);
      expect(statuses).toContain("loading");
      expect(statuses.at(-1)).toBe("loaded");
    });
  });

  describe("without script", () => {
    /** The RGB of the pixel at (x, y) of a screenshot of `element`. */
    async function pixels(element: HTMLElement, points: [number, number][]): Promise<string[]> {
      const base64 = await page.screenshot({ element, save: false });
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const scale = image.naturalWidth / element.getBoundingClientRect().width;
      return points.map(([x, y]) => {
        const [r, g, b] = context.getImageData(
          Math.round(x * scale),
          Math.round(y * scale),
          1,
          1,
        ).data;
        return `${r},${g},${b}`;
      });
    }

    it('a broken <img alt=""> with CSS dimensions paints nothing over the Fallback', async () => {
      addStyle(css);
      const container = serverHtml(<Basic src={brokenUrl()} />);
      const image = container.querySelector("img")!;
      await expect.poll(() => image.complete).toBe(true);
      // Still in the DOM: no script removed it.
      expect(image.isConnected).toBe(true);
      const avatar = container.querySelector<HTMLElement>(".avatar")!;
      const points: [number, number][] = [
        [3, 3],
        [20, 20],
        [36, 3],
        [3, 36],
        [36, 36],
        [10, 30],
      ];
      expect(await pixels(avatar, points)).toEqual(points.map(() => "0,128,0"));
    });
  });
});
