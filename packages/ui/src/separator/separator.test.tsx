// Separator rows (design/components/separator.md, test plan in design/CHANGELOG.md, #169): the
// default `hr`, the vertical case, `decorative` (and that it wins over a `render` element's own
// role), a `render` element's `role="separator"` surviving while not decorative, the function
// props, `ref`, and the server render. The Directive row is in src/__tests__/directives.test.ts.
// Keyboard: none (not focusable in any case). No Async React: no state, action or pending.
import { act, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Separator } from "./index.js";
import type { SeparatorState } from "./index.js";

describe("Separator", () => {
  describe("roles and ARIA", () => {
    it("renders an hr with aria-orientation and data-orientation, horizontal by default", () => {
      render(<Separator data-testid="s" />);
      const separator = screen.getByRole("separator");
      expect(separator).toBe(screen.getByTestId("s"));
      expect(separator.tagName).toBe("HR");
      expect(separator).not.toHaveAttribute("role");
      expect(separator).toHaveAttribute("aria-orientation", "horizontal");
      expect(separator).toHaveAttribute("data-orientation", "horizontal");
      expect(separator).not.toHaveAttribute("tabindex");
    });

    it('orientation="vertical"', () => {
      render(<Separator orientation="vertical" />);
      const separator = screen.getByRole("separator");
      expect(separator).toHaveAttribute("aria-orientation", "vertical");
      expect(separator).toHaveAttribute("data-orientation", "vertical");
    });

    it('decorative renders role="none" and no aria-orientation; data-orientation stays', () => {
      render(<Separator decorative orientation="vertical" data-testid="s" />);
      expect(screen.queryByRole("separator")).toBeNull();
      const line = screen.getByTestId("s");
      expect(line.tagName).toBe("HR");
      expect(line).toHaveAttribute("role", "none");
      expect(line).not.toHaveAttribute("aria-orientation");
      expect(line).toHaveAttribute("data-orientation", "vertical");
    });

    it("is not focusable", () => {
      render(<Separator data-testid="s" />);
      const separator = screen.getByTestId("s");
      act(() => separator.focus());
      expect(document.activeElement).not.toBe(separator);
    });
  });

  describe("render", () => {
    it("a render element's role=separator survives while not decorative", () => {
      render(
        <Separator orientation="vertical" render={<div role="separator" data-testid="s" />} />,
      );
      const separator = screen.getByTestId("s");
      expect(separator.tagName).toBe("DIV");
      expect(separator).toHaveAttribute("role", "separator");
      expect(separator).toHaveAttribute("aria-orientation", "vertical");
      expect(separator).toHaveAttribute("data-orientation", "vertical");
    });

    it("decorative wins over a render element's role and aria-orientation", () => {
      render(
        <Separator
          decorative
          render={<div role="separator" aria-orientation="vertical" data-testid="s" />}
        />,
      );
      const line = screen.getByTestId("s");
      expect(line).toHaveAttribute("role", "none");
      expect(line).not.toHaveAttribute("aria-orientation");
      expect(line).toHaveAttribute("data-orientation", "horizontal");
    });

    it("owns aria-orientation and data-orientation over a render element's", () => {
      render(
        <Separator
          render={<hr aria-orientation="vertical" data-orientation="vertical" data-testid="s" />}
        />,
      );
      const separator = screen.getByTestId("s");
      expect(separator).toHaveAttribute("aria-orientation", "horizontal");
      expect(separator).toHaveAttribute("data-orientation", "horizontal");
    });

    it("the function form receives the props and the state", () => {
      const seen: SeparatorState[] = [];
      render(
        <Separator
          orientation="vertical"
          decorative
          render={(props, state) => {
            seen.push(state);
            return <span {...props} data-testid="s" />;
          }}
        />,
      );
      expect(seen.at(-1)).toEqual({ orientation: "vertical", decorative: true });
      const line = screen.getByTestId("s");
      expect(line.tagName).toBe("SPAN");
      expect(line).toHaveAttribute("role", "none");
    });
  });

  describe("function props and pass-through", () => {
    it("className and style receive { orientation, decorative }", () => {
      const classStates: SeparatorState[] = [];
      render(
        <Separator
          orientation="vertical"
          className={(s) => {
            classStates.push(s);
            return `line-${s.orientation}`;
          }}
          style={(s) => ({ opacity: s.decorative ? 0.5 : 1 })}
          data-testid="s"
        />,
      );
      expect(classStates.at(-1)).toEqual({ orientation: "vertical", decorative: false });
      const separator = screen.getByTestId("s");
      expect(separator).toHaveClass("line-vertical");
      expect(separator.style.opacity).toBe("1");
    });

    it("passes other props through and forwards ref; a render element's ref is attached too", () => {
      const ref = createRef<HTMLHRElement>();
      const elementRef = createRef<HTMLHRElement>();
      render(<Separator ref={ref} id="x" title="t" render={<hr ref={elementRef} />} />);
      const separator = screen.getByRole("separator");
      expect(ref.current).toBe(separator);
      expect(elementRef.current).toBe(separator);
      expect(separator).toHaveAttribute("id", "x");
      expect(separator).toHaveAttribute("title", "t");
    });
  });

  describe("server render", () => {
    // What a Server Component rendering the part produces: the part runs once, on the server, so
    // the function `className` is resolved there and only the HTML string reaches the client.
    const ui = (
      <div>
        <Separator className={(s) => `sep-${s.orientation}`} />
        <Separator orientation="vertical" decorative className="d" />
      </div>
    );

    it("renderToString carries every attribute before any script", () => {
      const html = renderToString(ui);
      expect(html).toContain(
        '<hr class="sep-horizontal" aria-orientation="horizontal" data-orientation="horizontal"/>',
      );
      expect(html).toContain('<hr class="d" role="none" data-orientation="vertical"/>');
    });

    it("hydrates without a mismatch", async () => {
      const host = document.createElement("div");
      host.innerHTML = renderToString(ui);
      document.body.append(host);
      const recoverable = vi.fn();
      let root: Root | undefined;
      await act(async () => {
        root = hydrateRoot(host, ui, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      // The jsdom project shares one window between files: leave no root behind.
      act(() => root?.unmount());
      host.remove();
    });
  });
});
